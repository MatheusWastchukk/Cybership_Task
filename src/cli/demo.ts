import { loadConfig } from "../config/env.js";
import { AxiosHttpClient } from "../infra/http/axios-client.js";
import { UpsCarrier } from "../carriers/ups/ups.carrier.js";

async function main() {
  const config = loadConfig();
  const http = new AxiosHttpClient();
  const carrier = new UpsCarrier({ http, config, shipperDisplayName: "Demo Shipper" });

  const quotes = await carrier.getRates({
    origin: {
      name: "Origin",
      addressLines: ["123 Main St"],
      city: "Atlanta",
      stateOrProvince: "GA",
      postalCode: "30309",
      countryCode: "US",
    },
    destination: {
      name: "Destination",
      addressLines: ["456 Oak Ave"],
      city: "Baltimore",
      stateOrProvince: "MD",
      postalCode: "21201",
      countryCode: "US",
    },
    packages: [
      {
        dimensions: { length: 10, width: 10, height: 10, unit: "IN" },
        weight: { value: 5, unit: "LBS" },
      },
    ],
  });

  console.log(JSON.stringify(quotes, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
