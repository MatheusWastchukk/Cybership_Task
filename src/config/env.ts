import "dotenv/config";
import { z } from "zod";
import { CarrierIntegrationError } from "../common/errors.js";

const envSchema = z.object({
  UPS_CLIENT_ID: z.string().min(1),
  UPS_CLIENT_SECRET: z.string().min(1),
  UPS_API_BASE_URL: z.string().url(),
  UPS_OAUTH_TOKEN_URL: z.string().url(),
  UPS_SHIPPER_NUMBER: z.string().min(1),
  UPS_RATING_VERSION: z.string().default("v2409"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function loadConfig(overrides?: Partial<Record<string, string>>): AppConfig {
  const raw = {
    UPS_CLIENT_ID: overrides?.UPS_CLIENT_ID ?? process.env.UPS_CLIENT_ID,
    UPS_CLIENT_SECRET: overrides?.UPS_CLIENT_SECRET ?? process.env.UPS_CLIENT_SECRET,
    UPS_API_BASE_URL: overrides?.UPS_API_BASE_URL ?? process.env.UPS_API_BASE_URL,
    UPS_OAUTH_TOKEN_URL: overrides?.UPS_OAUTH_TOKEN_URL ?? process.env.UPS_OAUTH_TOKEN_URL,
    UPS_SHIPPER_NUMBER: overrides?.UPS_SHIPPER_NUMBER ?? process.env.UPS_SHIPPER_NUMBER,
    UPS_RATING_VERSION: overrides?.UPS_RATING_VERSION ?? process.env.UPS_RATING_VERSION,
    REQUEST_TIMEOUT_MS: overrides?.REQUEST_TIMEOUT_MS ?? process.env.REQUEST_TIMEOUT_MS,
  };

  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CarrierIntegrationError({
      code: "VALIDATION_ERROR",
      message: "Invalid environment configuration",
      context: { detail: parsed.error.message },
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function getConfig(): AppConfig {
  if (!cached) {
    cached = loadConfig();
  }
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
