export type CountryCode = string;

export interface Address {
  name?: string;
  companyName?: string;
  addressLines: string[];
  city: string;
  stateOrProvince?: string;
  postalCode: string;
  countryCode: CountryCode;
}

export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  unit: "IN" | "CM";
}

export interface PackageWeight {
  value: number;
  unit: "LBS" | "KGS";
}

export interface ShipmentPackage {
  packagingTypeCode?: string;
  dimensions: PackageDimensions;
  weight: PackageWeight;
}

export interface RateRequest {
  origin: Address;
  destination: Address;
  packages: ShipmentPackage[];
  serviceCode?: string;
}

export interface MoneyAmount {
  currencyCode: string;
  value: string;
}

export interface RateQuote {
  carrierId: string;
  serviceCode: string;
  serviceName?: string;
  totalCharges: MoneyAmount;
  billingWeight?: {
    unit: string;
    value: string;
  };
  rawCarrierReference?: Record<string, unknown>;
}
