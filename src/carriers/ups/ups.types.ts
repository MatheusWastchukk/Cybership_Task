import { z } from "zod";

export const upsMoneySchema = z.object({
  CurrencyCode: z.string(),
  MonetaryValue: z.string(),
});

export const upsRatedShipmentSchema = z.object({
  Service: z.object({
    Code: z.string(),
    Description: z.string().optional(),
  }),
  BillingWeight: z
    .object({
      UnitOfMeasurement: z.object({ Code: z.string() }).optional(),
      Weight: z.string(),
    })
    .optional(),
  TotalCharges: upsMoneySchema,
});

export const upsRateResponseSchema = z.object({
  RateResponse: z.object({
    Response: z
      .object({
        ResponseStatus: z
          .object({
            Code: z.string(),
            Description: z.string().optional(),
          })
          .optional(),
        Alert: z
          .union([
            z.array(
              z.object({
                Code: z.string().optional(),
                Description: z.string().optional(),
              }),
            ),
            z.object({
              Code: z.string().optional(),
              Description: z.string().optional(),
            }),
          ])
          .optional(),
      })
      .optional(),
    RatedShipment: z.union([upsRatedShipmentSchema, z.array(upsRatedShipmentSchema)]),
  }),
});

export type UpsRateResponse = z.infer<typeof upsRateResponseSchema>;

export interface UpsRateRequestPayload {
  RateRequest: {
    Request: {
      RequestOption: "Shop" | "Rate";
      TransactionReference?: { CustomerContext?: string };
    };
    Shipment: {
      Shipper: {
        Name: string;
        ShipperNumber: string;
      };
      ShipFrom: UpsParty;
      ShipTo: UpsParty;
      Service?: { Code: string };
      Package: UpsPackage[];
    };
  };
}

export interface UpsParty {
  Name: string;
  Address: {
    AddressLine: string[];
    City: string;
    StateProvinceCode?: string;
    PostalCode: string;
    CountryCode: string;
  };
}

export interface UpsPackage {
  PackagingType: { Code: string };
  Dimensions: {
    UnitOfMeasurement: { Code: string };
    Length: string;
    Width: string;
    Height: string;
  };
  PackageWeight: {
    UnitOfMeasurement: { Code: string };
    Weight: string;
  };
}
