import { describe, it, expect, vi, afterEach } from "vitest";
import axios, { AxiosError } from "axios";
import { AxiosHttpClient } from "./axios-client.js";

describe("AxiosHttpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps axios timeout to TIMEOUT", async () => {
    const err = new AxiosError("timeout");
    err.code = "ECONNABORTED";
    vi.spyOn(axios, "request").mockRejectedValue(err);

    const client = new AxiosHttpClient();
    await expect(
      client.request({ method: "GET", url: "https://example.test", timeoutMs: 1 }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
