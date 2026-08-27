import { describe, expect, it } from "vitest";
import { isLocalAuthBypassEnabled } from "@/lib/auth/local-config";

describe("local auth bypass configuration", () => {
  it("remains disabled when neither switch is set", () => {
    expect(isLocalAuthBypassEnabled({})).toBe(false);
  });

  it("remains disabled when only local development is enabled", () => {
    expect(isLocalAuthBypassEnabled({ LOCAL_DEV: "true" })).toBe(false);
  });

  it("remains disabled when only the bypass switch is enabled", () => {
    expect(isLocalAuthBypassEnabled({ LOCAL_AUTH_BYPASS: "true" })).toBe(
      false
    );
  });

  it("is enabled only when both switches are exactly true", () => {
    expect(
      isLocalAuthBypassEnabled({
        LOCAL_DEV: "true",
        LOCAL_AUTH_BYPASS: "true",
      })
    ).toBe(true);
  });
});
