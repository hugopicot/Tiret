import { describe, expect, it, vi } from "vitest";
import { runAfterSuccessfulSave } from "./safeLifecycle";

describe("runAfterSuccessfulSave", () => {
  it("waits for the save before quitting", async () => {
    const order: string[] = [];
    const save = vi.fn(async () => {
      order.push("save");
    });
    const quit = vi.fn(async () => {
      order.push("quit");
    });

    await expect(runAfterSuccessfulSave(save, quit)).resolves.toBe(true);
    expect(order).toEqual(["save", "quit"]);
  });

  it("keeps the app open when saving fails", async () => {
    const quit = vi.fn(async () => undefined);
    const result = await runAfterSuccessfulSave(
      async () => Promise.reject(new Error("disk full")),
      quit,
    );

    expect(result).toBe(false);
    expect(quit).not.toHaveBeenCalled();
  });
});
