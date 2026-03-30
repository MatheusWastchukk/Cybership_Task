import type { RateQuote, RateRequest } from "./domain.js";

export interface ShippingCarrier {
  readonly carrierId: string;
  getRates(request: RateRequest): Promise<RateQuote[]>;
}

export interface LabelPurchaseCarrier {
  readonly carrierId: string;
}
