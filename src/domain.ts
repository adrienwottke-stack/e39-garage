import { z } from "zod";
import { studioSchema } from "./studio-domain";

const id = z.string().min(1).max(100);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T12:00:00Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Bitte ein gültiges Datum angeben.");
const nullableNumber = z.number().finite().nonnegative().nullable();
const nullableKm = z.number().int().nonnegative().nullable();
export const profileSchema = z.object({
  name: z.string().max(70),
  year: z.number().int().min(1995).max(2004).nullable(),
  gearbox: z.enum(["unknown", "manual", "automatic"]),
  paint: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hoodPaint: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  notes: z.string().max(8000),
});
export const readingSchema = z.object({
  id,
  date: day,
  km: z.number().int().nonnegative(),
  note: z.string().max(1000),
});
export const entrySchema = z.object({
  id,
  type: z.enum(["service", "observation", "oil"]),
  date: day,
  km: nullableKm,
  title: z.string().min(1).max(160),
  note: z.string().max(12000),
  componentId: z.string().max(100),
  cost: nullableNumber,
  litres: nullableNumber,
  resolved: z.boolean(),
  taskId: z.string().nullable(),
});
export const taskSchema = z.object({
  id,
  title: z.string().min(1).max(160),
  componentId: z.string().max(100),
  note: z.string().max(8000),
  dueDate: day.nullable(),
  dueKm: nullableKm,
  intervalMonths: z.number().int().min(1).max(120).nullable(),
  intervalKm: z.number().int().positive().nullable(),
  source: z.string().max(1000),
  done: z.boolean(),
  completedEntryId: z.string().nullable(),
});
export const partSchema = z.object({
  id,
  taskId: z.string().nullable(),
  name: z.string().min(1).max(160),
  quantity: z.number().positive().max(10000),
  partNumber: z.string().max(100),
  url: z.string().max(2000),
  price: nullableNumber,
  fitChecked: z.boolean(),
  bought: z.boolean(),
});
export const documentSchema = z.object({
  id,
  name: z.string().min(1).max(240),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  bytes: z.number().int().positive().max(10485760),
  date: day,
  entryId: z.string().nullable(),
  path: z.string().max(600),
  location: z.enum(["local", "cloud"]),
});
export const garageSchema = z.object({
  version: z.literal(3),
  revision: z.number().int().nonnegative(),
  profile: profileSchema,
  readings: z.array(readingSchema).max(20000),
  entries: z.array(entrySchema).max(20000),
  tasks: z.array(taskSchema).max(5000),
  parts: z.array(partSchema).max(5000),
  documents: z.array(documentSchema).max(5000),
  studio: studioSchema,
});
export type Profile = z.infer<typeof profileSchema>;
export type Reading = z.infer<typeof readingSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type MaintenanceTask = z.infer<typeof taskSchema>;
export type Part = z.infer<typeof partSchema>;
export type GarageDocument = z.infer<typeof documentSchema>;
export type Garage = z.infer<typeof garageSchema>;
export type TaskStatus = "due" | "soon" | "planned" | "unknown" | "done";
export const uid = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(
    new Date(),
  );
export function emptyGarage(): Garage {
  return {
    version: 3,
    revision: 0,
    profile: {
      name: "Mein E39",
      year: null,
      gearbox: "unknown",
      paint: "#234864",
      hoodPaint: "#234864",
      notes: "",
    },
    readings: [],
    entries: [],
    tasks: [],
    parts: [],
    documents: [],
    studio: { baseline: null, baselineConfirmed: false, drafts: [] },
  };
}
export function currentReading(garage: Garage): Reading | undefined {
  return [...garage.readings].sort(
    (a, b) => b.date.localeCompare(a.date) || b.km - a.km,
  )[0];
}
export function taskStatus(
  task: MaintenanceTask,
  km: number | undefined,
  now = today(),
): TaskStatus {
  if (task.done) return "done";
  if (
    (task.dueDate && task.dueDate <= now) ||
    (task.dueKm !== null && km !== undefined && km >= task.dueKm)
  )
    return "due";
  const days = task.dueDate
    ? (Date.parse(task.dueDate + "T12:00:00Z") -
        Date.parse(now + "T12:00:00Z")) /
      86400000
    : Infinity;
  if (
    days <= 30 ||
    (task.dueKm !== null && km !== undefined && task.dueKm - km <= 1000)
  )
    return "soon";
  if (!task.dueDate && task.dueKm === null) return "unknown";
  if (task.dueKm !== null && km === undefined) return "unknown";
  return "planned";
}
export const statusLabels: Record<TaskStatus, string> = {
  due: "Fällig",
  soon: "Bald fällig",
  planned: "Geplant",
  unknown: "Daten fehlen",
  done: "Erledigt",
};
export function addMonths(date: string, months: number) {
  const d = new Date(date + "T12:00:00Z");
  const target = d.getUTCMonth() + months;
  const originalDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(target);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(originalDay, end));
  return d.toISOString().slice(0, 10);
}
export function completeTask(
  garage: Garage,
  taskId: string,
  input: { date: string; km: number | null; note: string; cost: number | null },
): Garage {
  const task = garage.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Die Aufgabe wurde nicht gefunden.");
  if (task.done) return garage;
  if (task.intervalKm !== null && input.km === null)
    throw new Error(
      "Für das Kilometerintervall fehlt der Kilometerstand der Arbeit.",
    );
  const entry: Entry = {
    id: uid(),
    type: "service",
    date: input.date,
    km: input.km,
    title: task.title,
    note: input.note,
    componentId: task.componentId,
    cost: input.cost,
    litres: null,
    resolved: false,
    taskId,
  };
  const tasks = garage.tasks.map((t) =>
    t.id === taskId ? { ...t, done: true, completedEntryId: entry.id } : t,
  );
  if (task.intervalMonths !== null || task.intervalKm !== null) {
    tasks.push({
      ...task,
      id: uid(),
      dueDate: task.intervalMonths
        ? addMonths(input.date, task.intervalMonths)
        : null,
      dueKm:
        task.intervalKm !== null && input.km !== null
          ? input.km + task.intervalKm
          : null,
      done: false,
      completedEntryId: null,
    });
  }
  const readings =
    input.km !== null
      ? [
          ...garage.readings,
          {
            id: uid(),
            date: input.date,
            km: input.km,
            note: "Bei Arbeit: " + task.title,
          },
        ]
      : garage.readings;
  return { ...garage, tasks, readings, entries: [entry, ...garage.entries] };
}
export function parseNumber(value: FormDataEntryValue | null): number | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0)
    throw new Error("Bitte eine gültige, positive Zahl eintragen.");
  return n;
}
export const formatKm = (km: number | undefined | null) =>
  km === undefined || km === null
    ? "—"
    : new Intl.NumberFormat("de-DE").format(km);
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(date + "T12:00:00Z"));
export const money = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    n,
  );
export function sortedTasks(garage: Garage) {
  const order: Record<TaskStatus, number> = {
    due: 0,
    soon: 1,
    unknown: 2,
    planned: 3,
    done: 4,
  };
  const km = currentReading(garage)?.km;
  return [...garage.tasks].sort(
    (a, b) =>
      order[taskStatus(a, km)] - order[taskStatus(b, km)] ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
  );
}
export function validateGarage(value: unknown) {
  const migrated =
    value &&
    typeof value === "object" &&
    "version" in value &&
    (value.version === 1 || value.version === 2)
      ? { ...value, version: 3 }
      : value;
  const state = garageSchema.parse(migrated);
  const seen = new Set<string>();
  if (
    new Set(state.studio.drafts.map((d) => d.id)).size !==
    state.studio.drafts.length
  )
    throw new Error("Doppelte Entwurfsplätze in der Sicherung.");
  for (const list of [
    state.entries,
    state.tasks,
    state.readings,
    state.parts,
    state.documents,
  ]) {
    for (const item of list) {
      if (seen.has(item.id))
        throw new Error("Die Sicherung enthält doppelte Kennungen.");
      seen.add(item.id);
    }
  }
  return state;
}
