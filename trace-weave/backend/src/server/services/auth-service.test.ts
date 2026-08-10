import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./auth-service";

describe("auth service", () => {
  it("hashes passwords with a unique salt and verifies them safely", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");

    expect(first.hash).toHaveLength(128);
    expect(first.salt).toHaveLength(32);
    expect(first).not.toEqual(second);
    await expect(
      verifyPassword("correct horse battery staple", first.hash, first.salt),
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", first.hash, first.salt)).resolves.toBe(false);
  });
});
