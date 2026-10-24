import { describe, expect, it } from "vitest";
import { isTruncatedOrTimeout, RequestTimeoutError, ResponseTruncatedError, SCANNER_USER_AGENT } from "./http";
import { containsRawSecret, maskSecret } from "./masking";

describe("SCANNER_USER_AGENT", () => {
  it("matches required identifiable user agent format", () => {
    expect(SCANNER_USER_AGENT).toBe("LeakLensScanner/1.0 (+https://leaklens.com/about-scanner)");
  });
});

describe("isTruncatedOrTimeout", () => {
  it("identifies ResponseTruncatedError and returns clear could_not_test reason", () => {
    const error = new ResponseTruncatedError("Stream exceeded 2000000 bytes", 2000500, 2000000);
    const result = isTruncatedOrTimeout(error);
    expect(result.isTruncated).toBe(true);
    expect(result.isTimeout).toBe(false);
    expect(result.reason).toContain("Response exceeded");
  });

  it("identifies RequestTimeoutError and returns clear timeout reason", () => {
    const error = new RequestTimeoutError("Request timed out", 10000);
    const result = isTruncatedOrTimeout(error);
    expect(result.isTruncated).toBe(false);
    expect(result.isTimeout).toBe(true);
    expect(result.reason).toContain("timed out");
  });

  it("handles generic errors cleanly", () => {
    const error = new Error("Connection reset");
    const result = isTruncatedOrTimeout(error);
    expect(result.isTruncated).toBe(false);
    expect(result.isTimeout).toBe(false);
    expect(result.reason).toBe("Connection reset");
  });
});

describe("maskSecret", () => {
  it("masks secret tokens retaining prefix and suffix while discarding middle bytes", () => {
    const raw = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";
    const masked = maskSecret(raw);
    expect(masked).not.toContain("abcdefghijklmnop");
    expect(masked).toBe("sk-proj-••••••••••••3456");
  });

  it("handles short or empty tokens safely", () => {
    expect(maskSecret("short")).toBe("••••••••");
    expect(maskSecret("")).toBe("••••••••");
  });

  it("containsRawSecret correctly checks for credential presence", () => {
    const secret = "ghp_1234567890abcdefghijklmnopqrstuv";
    expect(containsRawSecret({ token: secret }, secret)).toBe(true);
    expect(containsRawSecret({ token: maskSecret(secret) }, secret)).toBe(false);
  });
});
