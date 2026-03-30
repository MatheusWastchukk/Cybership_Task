import type { RateQuote } from "../../core/domain.js";
import type { ValidatedRateRequest } from "../../common/validation.js";
import type { UpsParty, UpsRateRequestPayload } from "./ups.types.js";

const DEFAULT_PACKAGING = "02";

function partyFromAddress(addr: ValidatedRateRequest["origin"], fallbackName: string): UpsParty {
  const name = addr.name ?? addr.companyName ?? fallbackName;
  return {
    Name: name,
    Address: {
      AddressLine: addr.addressLines,
      City: addr.city,
      StateProvinceCode: addr.stateOrProvince,
      PostalCode: addr.postalCode,
      CountryCode: addr.countryCode,
    },
  };
}

export function toUpsShopRateRequest(
  req: ValidatedRateRequest,
  shipperNumber: string,
  shipperDisplayName: string,
): UpsRateRequestPayload {
  const shipFrom = partyFromAddress(req.origin, "Ship From");
  const shipTo = partyFromAddress(req.destination, "Ship To");

  const packages = req.packages.map((p) => ({
    PackagingType: { Code: p.packagingTypeCode ?? DEFAULT_PACKAGING },
    Dimensions: {
      UnitOfMeasurement: { Code: p.dimensions.unit },
      Length: String(p.dimensions.length),
      Width: String(p.dimensions.width),
      Height: String(p.dimensions.height),
    },
    PackageWeight: {
      UnitOfMeasurement: { Code: p.weight.unit },
      Weight: String(p.weight.value),
    },
  }));

  const shipment: UpsRateRequestPayload["RateRequest"]["Shipment"] = {
    Shipper: {
      Name: shipperDisplayName,
      ShipperNumber: shipperNumber,
    },
    ShipFrom: shipFrom,
    ShipTo: shipTo,
    Package: packages,
  };

  if (req.serviceCode) {
    shipment.Service = { Code: req.serviceCode };
  }

  return {
    RateRequest: {
      Request: {
        RequestOption: "Shop",
        TransactionReference: { CustomerContext: "cybership-carrier-integration" },
      },
      Shipment: shipment,
    },
  };
}

export function ratedShipmentsToDomainQuotes(
  carrierId: string,
  rated: Array<{
    Service: { Code: string; Description?: string };
    BillingWeight?: { UnitOfMeasurement?: { Code: string }; Weight: string };
    TotalCharges: { CurrencyCode: string; MonetaryValue: string };
  }>,
): RateQuote[] {
  return rated.map((r) => ({
    carrierId,
    serviceCode: r.Service.Code,
    serviceName: r.Service.Description,
    totalCharges: {
      currencyCode: r.TotalCharges.CurrencyCode,
      value: r.TotalCharges.MonetaryValue,
    },
    billingWeight:
      r.BillingWeight !== undefined
        ? {
            unit: r.BillingWeight.UnitOfMeasurement?.Code ?? "",
            value: r.BillingWeight.Weight,
          }
        : undefined,
    rawCarrierReference: {
      serviceCode: r.Service.Code,
    },
  }));
}
