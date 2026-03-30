import { z } from "zod";
import { CarrierIntegrationError } from "../../common/errors.js";
import type { HttpClient } from "../http/types.js";

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.union([z.string(), z.number()]),
  status: z.string().optional(),
});

export interface OAuthClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
  refreshSkewSeconds: number;
}

interface CachedToken {
  accessToken: string;
  expiresAtEpochMs: number;
}

export class OAuthTokenManager {
  private cache: CachedToken | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly cfg: OAuthClientCredentialsConfig,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAtEpochMs) {
      return this.cache.accessToken;
    }
    return this.fetchAndCacheToken();
  }

  private async fetchAndCacheToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
    });

    const auth = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`, "utf8").toString(
      "base64",
    );

    const res = await this.http.request({
      method: "POST",
      url: this.cfg.tokenUrl,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: body.toString(),
      timeoutMs: this.cfg.timeoutMs,
    });

    if (res.status === 429) {
      throw new CarrierIntegrationError({
        code: "RATE_LIMITED",
        message: "OAuth token endpoint rate limited",
        context: { status: res.status },
      });
    }

    if (res.status < 200 || res.status >= 300) {
      throw new CarrierIntegrationError({
        code: "AUTH_ERROR",
        message: "Failed to obtain OAuth access token",
        context: { status: res.status },
        cause: res.body,
      });
    }

    if (typeof res.body !== "object" || res.body === null) {
      throw new CarrierIntegrationError({
        code: "MALFORMED_RESPONSE",
        message: "OAuth token response was not JSON object",
        context: { status: res.status },
      });
    }

    const parsed = tokenResponseSchema.safeParse(res.body);
    if (!parsed.success) {
      throw new CarrierIntegrationError({
        code: "MALFORMED_RESPONSE",
        message: "OAuth token response failed schema validation",
        context: { status: res.status },
        cause: parsed.error,
      });
    }

    const expiresInSec =
      typeof parsed.data.expires_in === "number"
        ? parsed.data.expires_in
        : Number.parseInt(String(parsed.data.expires_in), 10);
    if (!Number.isFinite(expiresInSec) || expiresInSec <= 0) {
      throw new CarrierIntegrationError({
        code: "MALFORMED_RESPONSE",
        message: "Invalid expires_in from OAuth token response",
        context: { status: res.status },
      });
    }

    const skewMs = this.cfg.refreshSkewSeconds * 1000;
    const ttlMs = Math.max(expiresInSec * 1000 - skewMs, 5_000);
    this.cache = {
      accessToken: parsed.data.access_token,
      expiresAtEpochMs: Date.now() + ttlMs,
    };

    return this.cache.accessToken;
  }
}
