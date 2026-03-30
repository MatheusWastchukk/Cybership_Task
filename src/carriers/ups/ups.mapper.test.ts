import { describe, it, expect } from "vitest";
import { toUpsShopRateRequest } from "./ups.mapper.js";
import type { ValidatedRateRequest } from "../../common/validation.js";

const baseReq: ValidatedRateRequest = {
  origin: {
    addressLines: ["1 Origin Rd"],
    city: "Austin",
    stateOrProvince: "TX",
    postalCode: "78701",
    countryCode: "US",
  },
  destination: {
    addressLines: ["2 Dest Ave"],
    city: "Denver",
    stateOrProvince: "CO",
    postalCode: "80202",
    countryCode: "US",
  },
  packages: [
    {
      dimensions: { length: 1, width: 2, height: 3, unit: "IN" },
      weight: { value: 4, unit: "LBS" },
    },
  ],
};

describe("ups.mapper", () => {
  it("includes Service when serviceCode is set on the domain request", () => {
    const payload = toUpsShopRateRequest(
      { ...baseReq, serviceCode: "03" },
      "SHIP123",
      "My Brand",
    );
    expect(payload.RateRequest.Shipment.Service).toEqual({ Code: "03" });
  });

  it("omits Service when serviceCode is not set on the domain request", () => {
    const payload = toUpsShopRateRequest(baseReq, "SHIP123", "My Brand");
    expect(payload.RateRequest.Shipment.Service).toBeUndefined();
  });
});
