# Carrier Integration Service

Backend take-home: a **TypeScript** module that integrates with the **UPS Rating API** (Shop) to return normalized rate quotes. The design targets a production-style boundary—additional carriers (FedEx, USPS, DHL) and operations (labels, tracking, address validation) can be added without rewriting the existing UPS rating path.

**Reference:** [UPS Rating API (developer.ups.com)](https://developer.ups.com/tag/Rating?loc=en_US)

No UPS API key is required to verify the work: integration tests stub HTTP and use documentation-shaped payloads.

---

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm** 9+

---

## How to run

```bash
npm install
npm test
```

```bash
npm run build
```

Compiled output is written to `dist/`.

### Optional: live UPS API

Fill in `.env` from `.env.example`, then:

```bash
npm run demo
```

The demo calls the real UPS endpoints using `AxiosHttpClient` (network and credentials required).

---

## Design decisions

### Domain vs carrier API

Callers depend only on **`RateRequest`** and **`RateQuote`** (`src/core/domain.ts`). UPS request/response JSON lives under `src/carriers/ups/` behind a mapper and Zod schemas, so internal types stay stable if the carrier payload changes.

### Extensibility

- **`ShippingCarrier`** (`src/core/carrier.ts`) is the port; **`UpsCarrier`** is the UPS adapter. A new carrier is a new folder under `src/carriers/` implementing the same port—FedEx would not require edits inside `ups/`.
- **`UpsRatingClient`** isolates the Rating (Shop) call. Another UPS operation (e.g. labels) can be a separate client class reusing **`HttpClient`** and **`OAuthTokenManager`** without changing rating code.
- Rating URL is built from configuration (`UPS_API_BASE_URL`, `UPS_RATING_VERSION`), not a single hardcoded string in business logic.

### Authentication

OAuth **client credentials**: tokens are obtained over HTTP, cached in memory with a TTL derived from `expires_in` and a refresh skew, and refreshed transparently before expiry. A **401** on the rating call invalidates the cache, fetches a new token, and retries the rating request once.

### Validation and errors

- **Zod** validates rate requests before any outbound call (`src/common/validation.ts`).
- Responses from the token and rating endpoints are validated/parsed with Zod where structured.
- Failures surface as **`CarrierIntegrationError`** with a stable **`code`** (`VALIDATION_ERROR`, `AUTH_ERROR`, `HTTP_ERROR`, `TIMEOUT`, `RATE_LIMITED`, `MALFORMED_RESPONSE`, `NETWORK_ERROR`, `UNKNOWN`). Exceptions are not swallowed at the carrier boundary.

### HTTP abstraction

**`HttpClient`** is injected. Tests use **`StubHttpClient`**; production/demo uses **`AxiosHttpClient`** (timeouts and network errors mapped to structured errors).

---

## Project layout

```
src/
  core/           Domain types and carrier ports
  common/         Shared errors and Zod validation
  config/         Environment loading
  infra/          HTTP client, OAuth token manager
  carriers/ups/   UPS adapter, mapper, rating client, API-oriented schemas
  services/       Optional multi-carrier facade
  cli/            Minimal demo entrypoint
  test-utils/     Stubs and doc-style fixtures for tests
```

---

## Tests

Integration tests (`src/carriers/ups/*.integration.test.ts`) exercise the stack end-to-end with stubbed HTTP:

- Request bodies built from domain models match expected UPS-shaped JSON.
- Success responses map to **`RateQuote[]`** (including a single `RatedShipment` object vs array).
- OAuth: acquisition, reuse, **time-based refresh after expiry**, 401-driven refresh and rating retry, OAuth **429**.
- Errors: **4xx** / **5xx**, malformed JSON/object bodies, validation without calling HTTP, **TIMEOUT** (Axios mapping via unit test).

```bash
npm run test:watch   # watch mode during development
```

---

## Configuration

Copy **`.env.example`** to **`.env`** and set values. Nothing secret is hardcoded in source.

| Variable | Purpose |
|----------|---------|
| `UPS_CLIENT_ID` | OAuth client id |
| `UPS_CLIENT_SECRET` | OAuth client secret |
| `UPS_API_BASE_URL` | REST API base (e.g. CIE `https://wwwcie.ups.com/api` or production `https://onlinetools.ups.com/api`) |
| `UPS_OAUTH_TOKEN_URL` | Token endpoint (e.g. `https://wwwcie.ups.com/security/v1/oauth/token`) |
| `UPS_SHIPPER_NUMBER` | UPS shipper account (ShipperNumber) |
| `UPS_RATING_VERSION` | API version segment (e.g. `v2409`) |
| `REQUEST_TIMEOUT_MS` | HTTP timeout in milliseconds |

---

## What I would improve with more time

- Short-lived **quote caching** (Redis or similar) for repeated lanes.
- **Observability**: metrics, structured logging, and trace correlation beyond `transId`.
- A second **carrier implementation** behind `ShippingCarrier` and/or additional **UPS operations** sharing auth.
- **Contract tests** against an OpenAPI snapshot of the Rating API if available.

---