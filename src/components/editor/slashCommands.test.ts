import { describe, expect, it } from "vitest";
import { filterSlashCommands } from "./slashCommands";

describe("slash command filtering", () => {
  it("shows every command for an empty query", () => {
    expect(filterSlashCommands("").length).toBeGreaterThanOrEqual(9);
  });

  it("finds commands through French keywords", () => {
    expect(filterSlashCommands("tâche").map((command) => command.id)).toContain(
      "task-list",
    );
    expect(filterSlashCommands("heure").map((command) => command.id)).toEqual([
      "time",
    ]);
  });

  it("returns no unrelated command", () => {
    expect(filterSlashCommands("introuvable")).toEqual([]);
  });
});
