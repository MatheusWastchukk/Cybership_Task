import axios, { type AxiosError } from "axios";
import { CarrierIntegrationError } from "../../common/errors.js";
import type { HttpClient, HttpRequest, HttpResponse } from "./types.js";

function flattenHeaders(h: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return out;
}

export class AxiosHttpClient implements HttpClient {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const timeoutMs = req.timeoutMs ?? 30_000;
    try {
      const res = await axios.request({
        method: req.method,
        url: req.url,
        headers: req.headers,
        data: req.body,
        timeout: timeoutMs,
        validateStatus: () => true,
        transformResponse: [(data) => data],
        responseType: "text",
      });

      let parsed: unknown = res.data;
      if (typeof res.data === "string" && res.data.length > 0) {
        try {
          parsed = JSON.parse(res.data) as unknown;
        } catch {
          parsed = res.data;
        }
      }

      return {
        status: res.status,
        headers: flattenHeaders(res.headers as Record<string, string | string[] | undefined>),
        body: parsed,
      };
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const ax = e as AxiosError;
        if (ax.code === "ECONNABORTED" || ax.code === "ETIMEDOUT") {
          throw new CarrierIntegrationError({
            code: "TIMEOUT",
            message: `HTTP request timed out after ${timeoutMs}ms`,
            context: { url: req.url },
            cause: e,
          });
        }
        if (
          ax.code === "ERR_NETWORK" ||
          ax.code === "ECONNREFUSED" ||
          ax.message?.includes("Network Error")
        ) {
          throw new CarrierIntegrationError({
            code: "NETWORK_ERROR",
            message: "Network error while calling carrier API",
            context: { url: req.url },
            cause: e,
          });
        }
      }
      throw new CarrierIntegrationError({
        code: "UNKNOWN",
        message: "Unexpected HTTP client error",
        context: { url: req.url },
        cause: e,
      });
    }
  }
}
