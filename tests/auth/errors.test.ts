import { describe, expect, it } from "vitest";

import {
  classifyAuthError,
  getLoginErrorMessage,
} from "@/lib/auth/errors";

describe("safe authentication error mapping", () => {
  it("maps bad credentials to one generic message", () => {
    const kind = classifyAuthError({
      status: 400,
      code: "invalid_credentials",
      message: "Invalid login credentials",
    });
    expect(kind).toBe("invalid_credentials");
    expect(getLoginErrorMessage(kind)).toBe("Invalid email or password.");
  });

  it("recognizes unverified and rate-limited requests", () => {
    expect(
      classifyAuthError({ code: "email_not_confirmed", status: 400 }),
    ).toBe("unverified");
    expect(classifyAuthError({ status: 429 })).toBe("rate_limited");
  });

  it("does not expose unknown provider messages", () => {
    const kind = classifyAuthError({
      status: 500,
      message: "internal database connection details",
    });
    expect(getLoginErrorMessage(kind)).toBe(
      "Unable to sign in right now. Try again.",
    );
  });
});
