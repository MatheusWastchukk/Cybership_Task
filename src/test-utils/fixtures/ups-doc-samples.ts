export const SAMPLE_OAUTH_TOKEN_RESPONSE = {
  token_type: "Bearer",
  issued_at: "1541549550",
  client_id: "masked",
  access_token: "eyJraWQiOiI...",
  expires_in: "14399",
  status: "approved",
} as const;

export const SAMPLE_RATE_SUCCESS_RESPONSE = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: "1",
        Description: "Success",
      },
    },
    RatedShipment: [
      {
        Service: {
          Code: "03",
          Description: "UPS Ground",
        },
        BillingWeight: {
          UnitOfMeasurement: {
            Code: "LBS",
          },
          Weight: "10.0",
        },
        TotalCharges: {
          CurrencyCode: "USD",
          MonetaryValue: "85.00",
        },
      },
      {
        Service: {
          Code: "02",
          Description: "UPS 2nd Day Air",
        },
        BillingWeight: {
          UnitOfMeasurement: {
            Code: "LBS",
          },
          Weight: "10.0",
        },
        TotalCharges: {
          CurrencyCode: "USD",
          MonetaryValue: "142.75",
        },
      },
    ],
  },
} as const;

export const SAMPLE_RATE_SINGLE_SHIPMENT_RESPONSE = {
  RateResponse: {
    Response: {
      ResponseStatus: { Code: "1", Description: "Success" },
    },
    RatedShipment: {
      Service: { Code: "01", Description: "UPS Next Day Air" },
      BillingWeight: {
        UnitOfMeasurement: { Code: "LBS" },
        Weight: "5.0",
      },
      TotalCharges: { CurrencyCode: "USD", MonetaryValue: "199.99" },
    },
  },
} as const;
