import { describe, expect, it, vi } from "vitest";

import { Vault0ApiClient } from "../src/main/core/vault0-api-client";

describe("Vault0ApiClient", () => {
  it("retries on transient 5xx and eventually returns JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("upstream down", { status: 503, statusText: "Service Unavailable" }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projects: [{ id: "p1" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new Vault0ApiClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 500,
      retries: 1,
      retryDelayMs: 0,
    });

    const payload = await client.requestJson<{ projects: Array<{ id: string }> }>(
      "http://localhost:3000/",
      "/api/projects",
    );

    expect(payload.projects[0]?.id).toBe("p1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails with explicit timeout error when upstream does not answer", async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          signal.addEventListener("abort", () => {
            const abortError = new Error("aborted");
            Object.assign(abortError, { name: "AbortError" });
            reject(abortError);
          });
        }
      });
    });

    const client = new Vault0ApiClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 10,
      retries: 0,
      retryDelayMs: 0,
    });

    await expect(client.requestJson("http://localhost:3000", "/api/tickets?projectId=p1")).rejects.toThrow(
      "timeout",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails fast on client errors without retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("missing ticket", { status: 404, statusText: "Not Found" }));

    const client = new Vault0ApiClient({
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 500,
      retries: 2,
      retryDelayMs: 0,
    });

    await expect(client.requestJson("http://localhost:3000", "/api/tickets/DOES-NOT-EXIST")).rejects.toThrow(
      "/api/tickets/DOES-NOT-EXIST",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
