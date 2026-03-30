import type { ShippingCarrier } from "../core/carrier.js";
import type { RateQuote, RateRequest } from "../core/domain.js";

export class CarrierRateService {
  constructor(private readonly carriers: ShippingCarrier[]) {}

  async getRatesFrom(carrierId: string, request: RateRequest): Promise<RateQuote[]> {
    const c = this.carriers.find((x) => x.carrierId === carrierId);
    if (!c) {
      throw new Error(`Unknown carrier: ${carrierId}`);
    }
    return c.getRates(request);
  }
}
