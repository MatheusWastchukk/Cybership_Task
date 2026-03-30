import { describe, it, expect, beforeEach, vi } from "vitest";
import { CarrierIntegrationError, isCarrierIntegrationError } from "../../common/errors.js";
import { loadConfig, resetConfigCache } from "../../config/env.js";
import { StubHttpClient } from "../../test-utils/stub-http-client.js";
import {
  SAMPLE_OAUTH_TOKEN_RESPONSE,
  SAMPLE_RATE_SINGLE_SHIPMENT_RESPONSE,
  SAMPLE_RATE_SUCCESS_RESPONSE,
} from "../../test-utils/fixtures/ups-doc-samples.js";
import { UpsCarrier } from "./ups.carrier.js";
import { OAuthTokenManager } from "../../infra/auth/oauth-token-manager.js";

function createTestConfig() {
  return loadConfig({
    UPS_CLIENT_ID: "test-client-id",
    UPS_CLIENT_SECRET: "test-client-secret",
    UPS_API_BASE_URL: "https://api-stub.ups.local/api",
    UPS_OAUTH_TOKEN_URL: "https://api-stub.ups.local/security/v1/oauth/token",
    UPS_SHIPPER_NUMBER: "1X2Y3Z",
    UPS_RATING_VERSION: "v2409",
    REQUEST_TIMEOUT_MS: "5000",
  });
}

const validRateRequest = {
  origin: {
    name: "Acme Warehouse",
    addressLines: ["123 Industrial Pkwy"],
    city: "Atlanta",
    stateOrProvince: "GA",
    postalCode: "30309",
    countryCode: "US",
  },
  destination: {
    name: "Happy Dog Pet Supplies",
    addressLines: ["100 Main St"],
    city: "Timonium",
    stateOrProvince: "MD",
    postalCode: "21093",
    countryCode: "US",
  },
  packages: [
    {
      dimensions: { length: 10, width: 30, height: 45, unit: "IN" as const },
      weight: { value: 5, unit: "LBS" as const },
    },
  ],
};

describe("UPS carrier integration (stubbed HTTP)", () => {
  beforeEach(() => {
    resetConfigCache();
  });

  it("builds the rating payload from domain models and normalizes a success response", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueueJsonResponse(200, structuredClone(SAMPLE_RATE_SUCCESS_RESPONSE));

    const carrier = new UpsCarrier({ http, config: createTestConfig(), shipperDisplayName: "Acme Inc" });
    const quotes = await carrier.getRates(validRateRequest);

    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({
      carrierId: "ups",
      serviceCode: "03",
      serviceName: "UPS Ground",
      totalCharges: { currencyCode: "USD", value: "85.00" },
    });

    expect(http.requests).toHaveLength(2);
    const [, ratingReq] = http.requests;
    expect(ratingReq.method).toBe("POST");
    expect(ratingReq.url).toBe("https://api-stub.ups.local/api/rating/v2409/Shop");
    expect(ratingReq.headers?.Authorization).toMatch(/^Bearer /);

    const body = ratingReq.body as {
      RateRequest: {
        Shipment: {
          Shipper: { ShipperNumber: string };
          ShipFrom: { Address: { PostalCode: string } };
          ShipTo: { Address: { PostalCode: string } };
          Package: Array<{ PackageWeight: { Weight: string } }>;
        };
      };
    };
    expect(body.RateRequest.Shipment.Shipper.ShipperNumber).toBe("1X2Y3Z");
    expect(body.RateRequest.Shipment.ShipFrom.Address.PostalCode).toBe("30309");
    expect(body.RateRequest.Shipment.ShipTo.Address.PostalCode).toBe("21093");
    expect(body.RateRequest.Shipment.Package[0].PackageWeight.Weight).toBe("5");
  });

  it("normalizes a single RatedShipment object when the API returns a non-array", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueueJsonResponse(200, structuredClone(SAMPLE_RATE_SINGLE_SHIPMENT_RESPONSE));

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    const quotes = await carrier.getRates(validRateRequest);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].serviceCode).toBe("01");
  });

  it("reuses the cached OAuth token on a second getRates call", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueueJsonResponse(200, structuredClone(SAMPLE_RATE_SUCCESS_RESPONSE));
    http.enqueueJsonResponse(200, structuredClone(SAMPLE_RATE_SUCCESS_RESPONSE));

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    await carrier.getRates(validRateRequest);
    await carrier.getRates(validRateRequest);

    expect(http.requests).toHaveLength(3);
    expect(http.requests[0].url).toContain("oauth/token");
    expect(http.requests[1].url).toContain("/Shop");
    expect(http.requests[2].url).toContain("/Shop");
  });

  it("acquires a new OAuth token after the cached token expires (time-based refresh)", async () => {
    const dateNow = vi.spyOn(Date, "now");
    const t0 = 1_700_000_000_000;
    dateNow.mockReturnValue(t0);

    const http = new StubHttpClient();
    const tokenBody = { ...SAMPLE_OAUTH_TOKEN_RESPONSE, expires_in: "120", access_token: "tok-1" };
    http.enqueueJsonResponse(200, tokenBody);
    http.enqueueJsonResponse(200, structuredClone(SAMPLE_RATE_SUCCESS_RESPONSE));
    http.enqueueJsonResponse(200, { ...tokenBody, access_token: "tok-2" });
    http.enqueueJsonResponse(200, structuredClone(SAMPLE_RATE_SUCCESS_RESPONSE));

    try {
      const carrier = new UpsCarrier({ http, config: createTestConfig() });
      await carrier.getRates(validRateRequest);

      dateNow.mockReturnValue(t0 + 60_001);
      await carrier.getRates(validRateRequest);

      expect(http.requests.filter((r) => r.url.includes("oauth"))).toHaveLength(2);
      expect(http.requests.filter((r) => r.url.includes("/Shop"))).toHaveLength(2);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("on 401 from rating, refreshes the token and retries the request once", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE, access_token: "token-v1" });
    http.enqueueJsonResponse(401, { response: { errors: [{ code: "GTW-401" }] } });
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE, access_token: "token-v2" });
    http.enqueueJsonResponse(200, structuredClone(SAMPLE_RATE_SUCCESS_RESPONSE));

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    const quotes = await carrier.getRates(validRateRequest);

    expect(quotes.length).toBeGreaterThan(0);
    expect(http.requests).toHaveLength(4);
    const authHeaders = http.requests
      .filter((r) => r.url.includes("/Shop"))
      .map((r) => r.headers?.Authorization);
    expect(authHeaders[0]).toBe("Bearer token-v1");
    expect(authHeaders[1]).toBe("Bearer token-v2");
  });

  it("fails with VALIDATION_ERROR without calling HTTP for an invalid payload", async () => {
    const http = new StubHttpClient();
    const carrier = new UpsCarrier({ http, config: createTestConfig() });

    await expect(
      carrier.getRates({
        ...validRateRequest,
        destination: { ...validRateRequest.destination, countryCode: "USA" },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(http.requests).toHaveLength(0);
  });

  it("maps 429 to RATE_LIMITED", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueueJsonResponse(429, { message: "Too Many Requests" });

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    try {
      await carrier.getRates(validRateRequest);
      expect.fail("expected error");
    } catch (e) {
      expect(isCarrierIntegrationError(e)).toBe(true);
      expect((e as CarrierIntegrationError).code).toBe("RATE_LIMITED");
    }
  });

  it("maps 4xx (except handled auth/retry paths) to HTTP_ERROR or AUTH_ERROR", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueueJsonResponse(400, { error: "Bad Request" });

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    await expect(carrier.getRates(validRateRequest)).rejects.toMatchObject({
      code: "HTTP_ERROR",
    });
  });

  it("maps 5xx to HTTP_ERROR", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueueJsonResponse(503, { fault: true });

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    await expect(carrier.getRates(validRateRequest)).rejects.toMatchObject({
      code: "HTTP_ERROR",
    });
  });

  it("maps an incompatible JSON body to MALFORMED_RESPONSE", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueueJsonResponse(200, { unexpected: true });

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    await expect(carrier.getRates(validRateRequest)).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
  });

  it("maps a non-JSON rating response body to MALFORMED_RESPONSE", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { ...SAMPLE_OAUTH_TOKEN_RESPONSE });
    http.enqueue(() => ({
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html>not json</html>",
    }));

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    await expect(carrier.getRates(validRateRequest)).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
  });

  it("maps OAuth token endpoint 429 to RATE_LIMITED before rating is called", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(429, { message: "Too Many Requests" });

    const carrier = new UpsCarrier({ http, config: createTestConfig() });
    await expect(carrier.getRates(validRateRequest)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(http.requests).toHaveLength(1);
  });

  it("OAuthTokenManager surfaces AUTH_ERROR when the token endpoint returns 401", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(401, { error: "invalid_client" });

    const mgr = new OAuthTokenManager(http, {
      tokenUrl: "https://api-stub.ups.local/oauth",
      clientId: "x",
      clientSecret: "y",
      timeoutMs: 5000,
      refreshSkewSeconds: 60,
    });

    await expect(mgr.getAccessToken()).rejects.toMatchObject({ code: "AUTH_ERROR" });
  });

  it("OAuthTokenManager surfaces MALFORMED_RESPONSE when token JSON is invalid", async () => {
    const http = new StubHttpClient();
    http.enqueueJsonResponse(200, { access_token: 123 });

    const mgr = new OAuthTokenManager(http, {
      tokenUrl: "https://api-stub.ups.local/oauth",
      clientId: "x",
      clientSecret: "y",
      timeoutMs: 5000,
      refreshSkewSeconds: 60,
    });

    await expect(mgr.getAccessToken()).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});
