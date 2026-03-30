import type { HttpClient, HttpRequest, HttpResponse } from "../infra/http/types.js";

type Handler = (req: HttpRequest) => HttpResponse | Promise<HttpResponse>;

export class StubHttpClient implements HttpClient {
  readonly requests: HttpRequest[] = [];
  private readonly queue: Handler[] = [];

  enqueue(handler: Handler): void {
    this.queue.push(handler);
  }

  enqueueJsonResponse(status: number, body: unknown, headers?: Record<string, string>): void {
    this.enqueue(() => ({
      status,
      headers: { "content-type": "application/json", ...headers },
      body,
    }));
  }

  reset(): void {
    this.requests.length = 0;
    this.queue.length = 0;
  }

  async request(req: HttpRequest): Promise<HttpResponse> {
    this.requests.push(req);
    const next = this.queue.shift();
    if (!next) {
      throw new Error("StubHttpClient: no queued response for request");
    }
    return next(req);
  }
}
