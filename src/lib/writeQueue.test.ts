import { describe, expect, it } from "vitest";
import { SerialWriteQueue } from "./writeQueue";

describe("SerialWriteQueue", () => {
  it("keeps writes in their original order", async () => {
    const queue = new SerialWriteQueue();
    const events: string[] = [];

    const first = queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      events.push("first");
    });
    const second = queue.enqueue(async () => {
      events.push("second");
    });

    await Promise.all([first, second]);
    await queue.flush();
    expect(events).toEqual(["first", "second"]);
  });

  it("reports a failed write instead of claiming the queue is saved", async () => {
    const queue = new SerialWriteQueue();
    const failure = new Error("disk full");

    await expect(queue.enqueue(async () => Promise.reject(failure))).rejects.toBe(failure);
    await expect(queue.flush()).rejects.toBe(failure);
  });
});
