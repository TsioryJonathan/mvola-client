import { describe, expect, it } from "vitest";
import { MvolaValidationError } from "../src/errors";
import { assertAmount, assertMsisdn, assertReference, sanitizeDescription } from "../src/validation";

describe("validation", () => {
  it("numbers are sent as given, only empty values are rejected", () => {
    expect(assertMsisdn(" 0343500003 ", "x")).toBe("0343500003");
    for (const bad of ["", "   ", undefined as unknown as string]) expect(() => assertMsisdn(bad, "x")).toThrow(MvolaValidationError);
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
});
