import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/ids";

describe("isUuid", () => {
  it.each([
    "eae49bc8-5ffc-4bff-bdc8-d7f27e8781ff",
    "00000000-0000-0000-0000-000000000000",
    "EAE49BC8-5FFC-4BFF-BDC8-D7F27E8781FF",
  ])("accepts a canonical UUID: %s", (value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    "not-a-real-id",
    "eae49bc85ffc4bffbdc8d7f27e8781ff",
    "eae49bc8-5ffc-4bff-bdc8-d7f27e8781ff-extra",
    "",
  ])("rejects an unsafe UUID route value: %s", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});
