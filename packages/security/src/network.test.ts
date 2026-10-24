import { describe, expect, it } from "vitest";
import { isBlockedAddress, normaliseTarget, UnsafeTargetError } from "./network";

describe("normaliseTarget", () => {
  it("normalises standard public URLs", () => {
    expect(normaliseTarget("https://Example.com/test").toString()).toBe("https://example.com/test");
    expect(normaliseTarget("example.com").toString()).toBe("https://example.com/");
  });

  it("rejects non-standard ports", () => {
    expect(() => normaliseTarget("https://example.com:8443")).toThrow(UnsafeTargetError);
    expect(() => normaliseTarget("http://example.com:8080")).toThrow(UnsafeTargetError);
  });

  it("rejects userinfo / credential tricks", () => {
    expect(() => normaliseTarget("https://user:pass@example.com")).toThrow(UnsafeTargetError);
    expect(() => normaliseTarget("http://good@evil.com")).toThrow(UnsafeTargetError);
  });

  it("rejects integer, decimal, octal and hex IP hostnames", () => {
    // 2130706433 is decimal for 127.0.0.1
    expect(() => normaliseTarget("http://2130706433")).toThrow(UnsafeTargetError);
    expect(() => normaliseTarget("http://0x7f000001")).toThrow(UnsafeTargetError);
    expect(() => normaliseTarget("http://0177.0.0.1")).toThrow(UnsafeTargetError);
  });

  it("rejects non-public single-word hostnames", () => {
    expect(() => normaliseTarget("http://localhost")).toThrow(UnsafeTargetError);
    expect(() => normaliseTarget("http://intranet")).toThrow(UnsafeTargetError);
  });
});

describe("isBlockedAddress", () => {
  it("blocks private IPv4 ranges", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.0.0.1")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true); // Cloud metadata
    expect(isBlockedAddress("100.64.0.1")).toBe(true); // CGNAT
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
    expect(isBlockedAddress("224.0.0.1")).toBe(true); // Multicast
  });

  it("allows routable public IPv4 addresses", () => {
    expect(isBlockedAddress("93.184.216.34")).toBe(false); // example.com
    expect(isBlockedAddress("1.1.1.1")).toBe(false);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });

  it("blocks private IPv6 ranges", () => {
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("::")).toBe(true);
    expect(isBlockedAddress("fc00::1")).toBe(true);
    expect(isBlockedAddress("fd12:3456:789a::1")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
  });

  it("blocks IPv4-mapped IPv6 addresses targeting private networks", () => {
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isBlockedAddress("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedAddress("0:0:0:0:0:ffff:192.168.1.1")).toBe(true);
  });
});
