import { describe, it, expect } from "vitest";
import {
  addMonths,
  completeTask,
  currentReading,
  emptyGarage,
  taskStatus,
  validateGarage,
  type MaintenanceTask,
} from "./domain";
const task = (changes: Partial<MaintenanceTask> = {}): MaintenanceTask => ({
  id: "task-1",
  title: "Ölwechsel",
  componentId: "oil-filter",
  note: "",
  dueDate: null,
  dueKm: null,
  intervalMonths: null,
  intervalKm: null,
  source: "Eigene Festlegung",
  done: false,
  completedEntryId: null,
  ...changes,
});
describe("Fälligkeit ohne erfundenen Zustand", () => {
  it("meldet fehlende Angaben", () =>
    expect(taskStatus(task(), undefined, "2026-10-14")).toBe("unknown"));
  it("wendet das zuerst erreichte Ziel an", () => {
    expect(
      taskStatus(
        task({ dueKm: 250000, dueDate: "2027-10-14" }),
        250000,
        "2026-10-14",
      ),
    ).toBe("due");
    expect(
      taskStatus(
        task({ dueKm: 250000, dueDate: "2026-10-14" }),
        200000,
        "2026-10-14",
      ),
    ).toBe("due");
  });
  it("berechnet den bald-Bereich inklusive Grenzen", () => {
    expect(taskStatus(task({ dueKm: 250000 }), 249000, "2026-10-14")).toBe(
      "soon",
    );
    expect(
      taskStatus(task({ dueDate: "2026-11-13" }), undefined, "2026-10-14"),
    ).toBe("soon");
    expect(
      taskStatus(
        task({ dueKm: 250000, dueDate: "2026-11-14" }),
        248999,
        "2026-10-14",
      ),
    ).toBe("planned");
  });
  it("verspricht bei fehlendem Kilometerstand keine Entwarnung", () =>
    expect(
      taskStatus(
        task({ dueKm: 250000, dueDate: "2027-10-14" }),
        undefined,
        "2026-10-14",
      ),
    ).toBe("unknown"));
  it("hält erledigte Arbeiten erledigt", () =>
    expect(
      taskStatus(
        task({ done: true, dueDate: "2020-01-01" }),
        200000,
        "2026-10-14",
      ),
    ).toBe("done"));
});
describe("Wartungsabschluss", () => {
  it("schreibt Arbeit und genau eine Folgeaufgabe zusammen", () => {
    const g = emptyGarage();
    g.tasks = [task({ intervalKm: 10000, intervalMonths: 12 })];
    const result = completeTask(g, "task-1", {
      date: "2026-10-14",
      km: 245000,
      note: "Filter ersetzt",
      cost: 90,
    });
    expect(result.entries).toHaveLength(1);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1]).toMatchObject({
      dueKm: 255000,
      dueDate: "2027-10-14",
      done: false,
    });
    expect(result.tasks[0].completedEntryId).toBe(result.entries[0].id);
    expect(
      completeTask(result, "task-1", {
        date: "2026-10-14",
        km: 245000,
        note: "Doppelklick",
        cost: 90,
      }),
    ).toBe(result);
    expect(g.tasks[0].done).toBe(false);
  });
  it("verlangt Kilometerstand für Kilometerintervalle", () => {
    const g = emptyGarage();
    g.tasks = [task({ intervalKm: 10000 })];
    expect(() =>
      completeTask(g, "task-1", {
        date: "2026-10-14",
        km: null,
        note: "",
        cost: null,
      }),
    ).toThrow("Kilometerstand");
  });
  it("begrenzt Monatsenden korrekt", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28");
  });
});
describe("Datengrenzen", () => {
  it("übernimmt den zeitlich aktuellen Kilometerstand", () => {
    const g = emptyGarage();
    g.readings = [
      { id: "a", date: "2026-09-14", km: 250000, note: "" },
      { id: "b", date: "2026-10-14", km: 245000, note: "Korrigierter Tacho" },
    ];
    expect(currentReading(g)?.id).toBe("b");
  });
  it("weist ungültige Kalenderdaten, Intervalle und doppelte Kennungen zurück", () => {
    const g = emptyGarage();
    g.tasks = [task({ dueDate: "2026-02-31" })];
    expect(() => validateGarage(g)).toThrow();
    g.tasks = [task({ intervalKm: 0 })];
    expect(() => validateGarage(g)).toThrow();
    g.tasks = [task(), task()];
    expect(() => validateGarage(g)).toThrow("doppelte");
  });
  it("beginnt ohne erfundene Fahrzeugdaten", () => {
    const g = emptyGarage();
    expect(g.readings).toHaveLength(0);
    expect(g.entries).toHaveLength(0);
    expect(g.tasks).toHaveLength(0);
    expect(g.profile.year).toBeNull();
    expect(currentReading(g)).toBeUndefined();
  });
});
