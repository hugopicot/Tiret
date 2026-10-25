import { describe, expect, it } from "vitest";
import { runInTransaction, type SqlExecutor } from "./database";

class FakeDatabase implements SqlExecutor {
  readonly queries: string[] = [];

  async execute(query: string): Promise<void> {
    this.queries.push(query);
  }
}

describe("runInTransaction", () => {
  it("commits a complete write", async () => {
    const database = new FakeDatabase();

    await runInTransaction(database, async () => {
      await database.execute("WRITE NOTE");
    });

    expect(database.queries).toEqual(["BEGIN IMMEDIATE", "WRITE NOTE", "COMMIT"]);
  });

  it("rolls back an interrupted write", async () => {
    const database = new FakeDatabase();

    await expect(
      runInTransaction(database, async () => {
        await database.execute("WRITE NOTE");
        throw new Error("interrupted");
      }),
    ).rejects.toThrow("interrupted");

    expect(database.queries).toEqual([
      "BEGIN IMMEDIATE",
      "WRITE NOTE",
      "ROLLBACK",
    ]);
  });
});
