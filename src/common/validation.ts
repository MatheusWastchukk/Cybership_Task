import { z } from "zod";
import { CarrierIntegrationError } from "./errors.js";

const nonEmptyString = z.string().trim().min(1);

export const addressSchema = z.object({
  name: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  addressLines: z.array(nonEmptyString).min(1),
  city: nonEmptyString,
  stateOrProvince: z.string().trim().optional(),
  postalCode: nonEmptyString,
  countryCode: nonEmptyString.length(2),
});

export const packageDimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  unit: z.enum(["IN", "CM"]),
});

export const packageWeightSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(["LBS", "KGS"]),
});

export const shipmentPackageSchema = z.object({
  packagingTypeCode: z.string().trim().optional(),
  dimensions: packageDimensionsSchema,
  weight: packageWeightSchema,
});

export const rateRequestSchema = z.object({
  origin: addressSchema,
  destination: addressSchema,
  packages: z.array(shipmentPackageSchema).min(1),
  serviceCode: z.string().trim().optional(),
});

export type ValidatedRateRequest = z.infer<typeof rateRequestSchema>;

export function parseRateRequest(input: unknown): ValidatedRateRequest {
  const r = rateRequestSchema.safeParse(input);
  if (!r.success) {
    throw new CarrierIntegrationError({
      code: "VALIDATION_ERROR",
      message: "Invalid rate request",
      context: { detail: r.error.message },
      cause: r.error,
    });
  }
  return r.data;
}
