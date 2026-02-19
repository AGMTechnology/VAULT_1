type Vault0ApiClientOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

type RequestJsonOptions = {
  timeoutMs?: number;
  retries?: number;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeNamed = error as { name?: string };
  return maybeNamed.name === "AbortError";
}

export class Vault0ApiClient {
  private readonly fetchImpl: typeof fetch;

  private readonly timeoutMs: number;

  private readonly retries: number;

  private readonly retryDelayMs: number;

  constructor(options?: Vault0ApiClientOptions) {
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.retries = options?.retries ?? 1;
    this.retryDelayMs = options?.retryDelayMs ?? 120;
  }

  async requestJson<T>(
    baseUrl: string,
    route: string,
    init?: RequestInit,
    options?: RequestJsonOptions,
  ): Promise<T> {
    const normalizedBase = normalizeBaseUrl(baseUrl);
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const retries = options?.retries ?? this.retries;
    const maxAttempts = Math.max(1, retries + 1);

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await this.fetchImpl(`${normalizedBase}${route}`, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          const requestError = new Error(
            `VAULT_0 API error ${response.status} on ${route}: ${body || response.statusText}`,
          ) as Error & { retryable?: boolean };
          requestError.retryable = response.status >= 500;

          throw requestError;
        }

        return (await response.json()) as T;
      } catch (error) {
        const normalizedError = (() => {
          if (isAbortError(error)) {
            return new Error(`VAULT_0 API timeout after ${timeoutMs}ms on ${route}`);
          }
          if (error instanceof Error) {
            return error;
          }
          return new Error(String(error));
        })();

        const retryable = (() => {
          if (isAbortError(error)) {
            return true;
          }
          if (error && typeof error === "object" && "retryable" in error) {
            return Boolean((error as { retryable?: boolean }).retryable);
          }
          return true;
        })();

        lastError = normalizedError;
        if (!retryable) {
          break;
        }
        if (retryable && attempt < maxAttempts) {
          await delay(this.retryDelayMs);
          continue;
        }
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    throw lastError ?? new Error(`VAULT_0 API request failed on ${route}`);
  }
}
