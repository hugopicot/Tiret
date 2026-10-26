import { describe, expect, it, vi } from "vitest";
import { retryDatabaseBusy } from "./database";

describe("SQLite busy retry", () => {
  it("retries a transient database lock", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("(code: 5) database is locked"))
      .mockRejectedValueOnce(new Error("SQLITE_BUSY"))
      .mockResolvedValue("saved");

    await expect(retryDatabaseBusy(operation, [0, 0])).resolves.toBe("saved");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not hide a non-retryable write error", async () => {
    const failure = new Error("disk full");
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(failure);

    await expect(retryDatabaseBusy(operation, [0])).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("reports a persistent database lock", async () => {
    const failure = new Error("database is locked");
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(failure);

    await expect(retryDatabaseBusy(operation, [0, 0])).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
