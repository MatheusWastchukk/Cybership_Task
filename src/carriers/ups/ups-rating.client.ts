import { CarrierIntegrationError } from "../../common/errors.js";
import type { ValidatedRateRequest } from "../../common/validation.js";
import type { RateQuote } from "../../core/domain.js";
import type { AppConfig } from "../../config/env.js";
import type { HttpClient } from "../../infra/http/types.js";
import { OAuthTokenManager } from "../../infra/auth/oauth-token-manager.js";
import { upsRateResponseSchema } from "./ups.types.js";
import { ratedShipmentsToDomainQuotes, toUpsShopRateRequest } from "./ups.mapper.js";

export class UpsRatingClient {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: OAuthTokenManager,
    private readonly config: AppConfig,
    private readonly shipperDisplayName: string,
  ) {}

  private ratingUrl(): string {
    const base = this.config.UPS_API_BASE_URL.replace(/\/$/, "");
    const v = this.config.UPS_RATING_VERSION.replace(/^\//, "");
    return `${base}/rating/${v}/Shop`;
  }

  async getShopRates(validated: ValidatedRateRequest): Promise<RateQuote[]> {
    const payload = toUpsShopRateRequest(
      validated,
      this.config.UPS_SHIPPER_NUMBER,
      this.shipperDisplayName,
    );
    return this.postRating(payload, { retryOn401: true });
  }

  private async postRating(
    payload: ReturnType<typeof toUpsShopRateRequest>,
    opts: { retryOn401: boolean },
  ): Promise<RateQuote[]> {
    const token = await this.tokens.getAccessToken();
    const res = await this.http.request({
      method: "POST",
      url: this.ratingUrl(),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        transId: `cybership-${Date.now()}`,
        transactionSrc: "cybership",
      },
      body: payload,
      timeoutMs: this.config.REQUEST_TIMEOUT_MS,
    });

    if (res.status === 401 && opts.retryOn401) {
      this.tokens.invalidate();
      await this.tokens.getAccessToken();
      return this.postRating(payload, { retryOn401: false });
    }

    if (res.status === 429) {
      throw new CarrierIntegrationError({
        code: "RATE_LIMITED",
        message: "UPS Rating API rate limited",
        context: { status: res.status },
        cause: res.body,
      });
    }

    if (res.status < 200 || res.status >= 300) {
      throw new CarrierIntegrationError({
        code: res.status === 401 || res.status === 403 ? "AUTH_ERROR" : "HTTP_ERROR",
        message: `UPS Rating API returned status ${res.status}`,
        context: { status: res.status },
        cause: res.body,
      });
    }

    const parsed = upsRateResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      throw new CarrierIntegrationError({
        code: "MALFORMED_RESPONSE",
        message: "UPS Rating response failed validation",
        context: { status: res.status },
        cause: parsed.error,
      });
    }

    const rs = parsed.data.RateResponse.RatedShipment;
    const list = Array.isArray(rs) ? rs : [rs];
    return ratedShipmentsToDomainQuotes("ups", list);
  }
}
