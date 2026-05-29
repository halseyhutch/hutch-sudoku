import { describe, expect, it } from "vitest";
import { exportCurrentGame, importGameFile } from "../../src/persistence/gameStorage";
import { createInitialGame } from "../../src/state/game";

describe("game storage import/export", () => {
  it("round-trips a saved game payload", async () => {
    const state = createInitialGame();
    const blob = await exportCurrentGame(state);
    const file = new File([blob], "save.json", { type: "application/json" });

    const imported = await importGameFile(file);

    expect(imported?.values).toEqual(state.values);
    expect(imported?.requestedDifficulty).toBe("Easy");
  });

  it("rejects invalid save payloads", async () => {
    const file = new File([JSON.stringify({ nope: true })], "bad.json", { type: "application/json" });

    await expect(importGameFile(file)).resolves.toBeNull();
  });
});
