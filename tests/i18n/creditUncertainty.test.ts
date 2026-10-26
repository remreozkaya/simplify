import { expect, it } from "vitest";
import { formatCredits } from "@/lib/i18n";

it("preserves an unresolved credit amount rather than displaying zero", () => {
  expect(formatCredits(null)).toBe("—");
  expect(formatCredits(0)).toBe("0.00");
  expect(formatCredits(3.5)).toBe("3.50");
});
