import { describe, expect, it } from "vitest";
import { MvolaValidationError } from "../src/errors";
import { assertAmount, assertCallbackUrl, assertReference, normalizeMsisdn, sanitizeDescription } from "../src/validation";

describe("validation", () => {
  it("normalises Madagascar numbers and rejects the rest", () => {
    expect(normalizeMsisdn("034 35 000 03", "x")).toBe("0343500003");
    expect(normalizeMsisdn("+261343500003", "x")).toBe("0343500003");
    expect(normalizeMsisdn("261343500003", "x")).toBe("0343500003");
    for (const bad of ["123", "034350000", "abc", "0343500003; DROP", ""]) expect(() => normalizeMsisdn(bad, "x")).toThrow(MvolaValidationError);
  });

  it("amount must be a positive integer", () => {
    expect(() => assertAmount(1000)).not.toThrow();
    for (const bad of [0, -5, 10.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => assertAmount(bad)).toThrow(MvolaValidationError);
  });

  it("sanitises the description to MVola's allowed characters and 50 chars", () => {
    expect(sanitizeDescription("Commande #42 — café!")).toBe("Commande 42 caf");
    expect(sanitizeDescription("a_b-c.d,e")).toBe("a_b-c.d,e");
    expect(sanitizeDescription("x".repeat(80))).toHaveLength(50);
    expect(() => sanitizeDescription("###")).toThrow(MvolaValidationError);
  });

  it("references are strict identifiers", () => {
    expect(() => assertReference("order-42_a.b,c")).not.toThrow();
    for (const bad of ["", "x".repeat(51), "a/b", "a&b", "a\nb", "é"]) expect(() => assertReference(bad)).toThrow(MvolaValidationError);
  });

  it("callback URL: https, no credentials, at most ONE query parameter", () => {
    expect(() => assertCallbackUrl("https://api.example.com/webhook")).not.toThrow();
    expect(() => assertCallbackUrl("https://api.example.com/webhook?ref=abc.def")).not.toThrow();
    expect(() => assertCallbackUrl("http://localhost:3000/webhook?ref=abc")).not.toThrow();
    expect(() => assertCallbackUrl("https://api.example.com/webhook?ref=abc&sig=def")).toThrow(/at most one query parameter/);
    expect(() => assertCallbackUrl("http://api.example.com/webhook")).toThrow(/https/);
    expect(() => assertCallbackUrl("https://user:pass@api.example.com/webhook")).toThrow(/credentials/);
    expect(() => assertCallbackUrl("not a url")).toThrow(MvolaValidationError);
  });
});
