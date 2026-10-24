import { Agent, request as undiciRequest } from "undici";
import { assertAllowedUrl, type ResolvedAddress } from "./network";
import type { ScanLimits } from "@leaklens/shared";

export const SCANNER_USER_AGENT = "LeakLensScanner/1.0 (+https://leaklens.com/about-scanner)";

export class ResponseTruncatedError extends Error {
  code = "RESPONSE_TRUNCATED";
  constructor(
    message: string,
    public bytesRead: number,
    public limit: number
  ) {
    super(message);
    this.name = "ResponseTruncatedError";
  }
}

export class RequestTimeoutError extends Error {
  code = "REQUEST_TIMEOUT";
  constructor(
    message: string,
    public timeoutMs: number
  ) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export interface SafeResponse {
  body: string;
  bytes: number;
  headers: Headers;
  status: number;
  url: string;
}

/**
 * Creates an Undici Agent whose DNS resolution is strictly pinned
 * to pre-validated public IP addresses. This eliminates DNS rebinding TOCTOU attacks.
 */
function createPinnedAgent(pinnedAddress: ResolvedAddress): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, [{ address: pinnedAddress.address, family: pinnedAddress.family }]);
      },
    },
    pipelining: 0,
    keepAliveTimeout: 1000,
  });
}

/**
 * Performs a security-hardened HTTP request:
 * 1. Scope lock: targets only the verified hostname
 * 2. SSRF guard: pre-resolves DNS and blocks private/cloud/multicast IPs
 * 3. DNS rebinding prevention: pins TCP connection directly to the validated IP
 * 4. Redirect control: follows redirects manually, re-checking SSRF & scope on every hop
 * 5. Size limits: streams response and aborts immediately if maxResponseBytes is exceeded
 * 6. Timeout: hard timeout abort
 * 7. Identification: sends official LeakLens scanner User-Agent
 */
export async function safeFetchText(
  input: string,
  verifiedHostname: string,
  limits: ScanLimits,
  init?: RequestInit
): Promise<SafeResponse> {
  let currentTarget = input;

  for (let redirect = 0; redirect <= limits.maxRedirects; redirect += 1) {
    const { url, resolvedAddresses } = await assertAllowedUrl(currentTarget, verifiedHostname);
    const pinnedIp = resolvedAddresses[0]!;
    const dispatcher = createPinnedAgent(pinnedIp);

    const controller = new AbortController();
    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limits.requestTimeoutMs);

    try {
      const method = (init?.method || "GET") as "GET" | "HEAD" | "POST" | "OPTIONS";
      const headersRecord: Record<string, string> = {
        "user-agent": SCANNER_USER_AGENT,
        accept: "text/html,application/javascript,text/plain,application/json;q=0.8,*/*;q=0.1",
        host: url.host,
      };

      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((val, key) => {
            headersRecord[key.toLowerCase()] = val;
          });
        } else if (Array.isArray(init.headers)) {
          for (const [key, val] of init.headers) {
            headersRecord[key.toLowerCase()] = val;
          }
        } else {
          for (const [key, val] of Object.entries(init.headers)) {
            if (typeof val === "string") headersRecord[key.toLowerCase()] = val;
          }
        }
      }

      const response = await undiciRequest(url.toString(), {
        method,
        dispatcher,
        signal: controller.signal,
        headers: headersRecord,
      });

      // Handle redirects manually
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const locationHeader = response.headers["location"];
        const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
        if (!location) {
          throw new Error("Redirect response did not include a location header.");
        }
        currentTarget = new URL(location, url).toString();
        // Discard response body and continue redirect loop
        await response.body.dump();
        continue;
      }

      // Check declared content length header
      const rawLength = response.headers["content-length"];
      const declaredLength = Number(Array.isArray(rawLength) ? rawLength[0] : rawLength || 0);
      if (declaredLength > limits.maxResponseBytes) {
        await response.body.dump();
        throw new ResponseTruncatedError(
          `Response declared size (${declaredLength} bytes) exceeds limit of ${limits.maxResponseBytes} bytes.`,
          declaredLength,
          limits.maxResponseBytes
        );
      }

      // Read response stream with strict byte counting
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      for await (const chunk of response.body) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buf.byteLength;

        if (totalBytes > limits.maxResponseBytes) {
          controller.abort();
          throw new ResponseTruncatedError(
            `Response stream exceeded limit of ${limits.maxResponseBytes} bytes.`,
            totalBytes,
            limits.maxResponseBytes
          );
        }
        chunks.push(buf);
      }

      const bodyBuffer = Buffer.concat(chunks);
      const headers = new Headers();
      for (const [key, val] of Object.entries(response.headers)) {
        if (Array.isArray(val)) {
          for (const item of val) headers.append(key, item);
        } else if (typeof val === "string") {
          headers.set(key, val);
        }
      }

      return {
        body: bodyBuffer.toString("utf8"),
        bytes: bodyBuffer.byteLength,
        headers,
        status: response.statusCode,
        url: url.toString(),
      };
    } catch (error) {
      if (timedOut) {
        throw new RequestTimeoutError(
          `Request to ${currentTarget} timed out after ${limits.requestTimeoutMs}ms.`,
          limits.requestTimeoutMs
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
      await dispatcher.destroy();
    }
  }

  throw new Error(`Target exceeded maximum redirect limit of ${limits.maxRedirects}.`);
}

/**
 * Helper to determine if an error was caused by response truncation or network timeout,
 * so scanning pipelines can report `could_not_test` instead of `passed`.
 */
export function isTruncatedOrTimeout(error: unknown): {
  isTruncated: boolean;
  isTimeout: boolean;
  reason: string;
} {
  if (error instanceof ResponseTruncatedError) {
    return {
      isTruncated: true,
      isTimeout: false,
      reason: `Response exceeded configured size limit (${error.message})`,
    };
  }
  if (error instanceof RequestTimeoutError) {
    return {
      isTruncated: false,
      isTimeout: true,
      reason: `Request timed out (${error.message})`,
    };
  }
  return {
    isTruncated: false,
    isTimeout: false,
    reason: error instanceof Error ? error.message : "Unknown request error",
  };
}
