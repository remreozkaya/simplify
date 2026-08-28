import { describe, expect, it } from "vitest";

import {
  emailOnlySchema,
  loginSchema,
  signupSchema,
} from "@/lib/auth/validation";

describe("authentication form validation", () => {
  it("rejects an empty email", () => {
    expect(emailOnlySchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(emailOnlySchema.safeParse({ email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("rejects a short signup password", () => {
    expect(
      signupSchema.safeParse({
        email: "student@example.com",
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    expect(
      signupSchema.safeParse({
        email: "student@example.com",
        password: "long-enough-password",
        confirmPassword: "different-password",
      }).success,
    ).toBe(false);
  });

  it("accepts a valid signup form", () => {
    expect(
      signupSchema.safeParse({
        email: " student@example.com ",
        password: "long-enough-password",
        confirmPassword: "long-enough-password",
      }).success,
    ).toBe(true);
  });

  it("accepts a valid login form", () => {
    expect(
      loginSchema.safeParse({
        email: "student@example.com",
        password: "password",
        remember: true,
        next: "/curriculum",
      }).success,
    ).toBe(true);
  });
});
