import { describe, expect, it } from "vitest";

import {
  getRouteDecision,
  getSafeAuthCallbackPath,
  getSafeNextPath,
} from "@/lib/auth/redirects";

describe("authentication redirects", () => {
  it("accepts internal next paths", () => {
    expect(getSafeNextPath("/curriculum?plan=42")).toBe(
      "/curriculum?plan=42",
    );
  });

  it("rejects external and protocol-relative next URLs", () => {
    expect(getSafeNextPath("https://evil.example/phish")).toBe("/");
    expect(getSafeNextPath("//evil.example/phish")).toBe("/");
    expect(getSafeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("limits callback targets to verification and password reset", () => {
    expect(getSafeAuthCallbackPath("/reset-password")).toBe(
      "/reset-password",
    );
    expect(getSafeAuthCallbackPath("/curriculum")).toBe("/verify-email");
  });

  it("redirects an unauthenticated protected route to login", () => {
    expect(getRouteDecision("/curriculum", "?plan=42", false)).toEqual({
      type: "login",
      next: "/curriculum?plan=42",
    });
  });

  it("allows authenticated users into the application", () => {
    expect(getRouteDecision("/curriculum", "", true)).toEqual({
      type: "allow",
    });
  });

  it("redirects authenticated users away from login and signup", () => {
    expect(getRouteDecision("/login", "", true)).toEqual({ type: "app" });
    expect(getRouteDecision("/signup", "", true)).toEqual({ type: "app" });
  });
});
