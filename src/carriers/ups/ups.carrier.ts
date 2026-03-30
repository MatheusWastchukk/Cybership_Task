import type { ShippingCarrier } from "../../core/carrier.js";
import type { RateQuote, RateRequest } from "../../core/domain.js";
import type { AppConfig } from "../../config/env.js";
import type { HttpClient } from "../../infra/http/types.js";
import { OAuthTokenManager } from "../../infra/auth/oauth-token-manager.js";
import { parseRateRequest } from "../../common/validation.js";
import { UpsRatingClient } from "./ups-rating.client.js";

export interface UpsCarrierOptions {
  http: HttpClient;
  config: AppConfig;
  shipperDisplayName?: string;
}

export class UpsCarrier implements ShippingCarrier {
  readonly carrierId = "ups";
  private readonly rating: UpsRatingClient;

  constructor(opts: UpsCarrierOptions) {
    const tokens = new OAuthTokenManager(opts.http, {
      tokenUrl: opts.config.UPS_OAUTH_TOKEN_URL,
      clientId: opts.config.UPS_CLIENT_ID,
      clientSecret: opts.config.UPS_CLIENT_SECRET,
      timeoutMs: opts.config.REQUEST_TIMEOUT_MS,
      refreshSkewSeconds: 60,
    });
    this.rating = new UpsRatingClient(
      opts.http,
      tokens,
      opts.config,
      opts.shipperDisplayName ?? "Shipper",
    );
  }

  async getRates(request: RateRequest): Promise<RateQuote[]> {
    const validated = parseRateRequest(request);
    return this.rating.getShopRates(validated);
  }
}
