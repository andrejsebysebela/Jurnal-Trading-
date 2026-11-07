import { describe, expect, it, vi } from "vitest";
import { fail, GENERIC_ERROR } from "./result";

describe("fail()", () => {
  it("keeps user-facing messages", () => {
    expect(fail("Account not found.").error).toBe("Account not found.");
  });
  it("hides database internals", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(fail(new Error('duplicate key value violates unique constraint "trades_user_id_fingerprint_key"')).error).toBe(GENERIC_ERROR);
    expect(fail('new row violates row-level security policy for table "tags"').error).toBe(GENERIC_ERROR);
    expect(fail(new Error("column trades.foo does not exist")).error).toBe(GENERIC_ERROR);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
