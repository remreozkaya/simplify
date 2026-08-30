import { describe, expect, it } from "vitest";

import { applySessionPersistence } from "@/lib/auth/cookies";

describe("remember-me cookie policy", () => {
  it("keeps provider persistence when remember me is selected", () => {
    expect(
      applySessionPersistence({ maxAge: 3600, path: "/" }, true),
    ).toEqual({ maxAge: 3600, path: "/" });
  });

  it("uses browser-session cookies when remember me is not selected", () => {
    expect(
      applySessionPersistence(
        { maxAge: 3600, expires: new Date("2030-01-01"), path: "/" },
        false,
      ),
    ).toEqual({ path: "/" });
  });
});
