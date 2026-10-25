import { openDB } from "idb";
import { createClient } from "@supabase/supabase-js";
import { emptyGarage, validateGarage, type Garage } from "./domain";

const dbPromise = openDB("e39-garage", 1, {
  upgrade(db) {
    db.createObjectStore("state");
    db.createObjectStore("files");
    db.createObjectStore("drafts");
  },
});
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export class ConflictError extends Error {
  constructor() {
    super(
      "Dieser Stand wurde inzwischen auf einem anderen Gerät geändert. Lade die aktuellen Daten und übernimm deinen Entwurf erneut.",
    );
  }
}
export type Mode = "local" | "cloud";
export async function loadGarage(
  mode: Mode,
  userId = "local",
): Promise<Garage> {
  const db = await dbPromise;
  if (mode === "local")
    return validateGarage((await db.get("state", "local")) ?? emptyGarage());
  if (!supabase)
    throw new Error("Online-Verbindung ist noch nicht eingerichtet.");
  const member = await supabase.from("e39_members").select("email").limit(1);
  if (member.error)
    throw new Error(
      "Der private Zugang konnte nicht geprüft werden. " + member.error.message,
    );
  if (!member.data?.length)
    throw new Error(
      "Dieses Konto ist für die private E39-Garage noch nicht freigeschaltet.",
    );
  const { data, error } = await supabase
    .from("e39_garages")
    .select("state,revision")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error)
    throw new Error(
      "Die Fahrzeugakte konnte nicht geladen werden. " + error.message,
    );
  const state = data
    ? validateGarage({ ...data.state, revision: data.revision })
    : emptyGarage();
  await db.put("state", state, "cloud:" + userId);
  return state;
}
export async function cachedGarage(userId: string) {
  const db = await dbPromise;
  const state = await db.get("state", "cloud:" + userId);
  return state ? validateGarage(state) : null;
}
export async function saveGarage(
  mode: Mode,
  next: Garage,
  expectedRevision: number,
  userId = "local",
): Promise<Garage> {
  validateGarage(next);
  const db = await dbPromise;
  if (mode === "local") {
    const tx = db.transaction("state", "readwrite");
    const current = await tx.store.get("local");
    if ((current?.revision ?? 0) !== expectedRevision) {
      await tx.done;
      throw new ConflictError();
    }
    const saved = { ...next, revision: expectedRevision + 1 };
    await tx.store.put(saved, "local");
    await tx.done;
    return saved;
  }
  if (!supabase) throw new Error("Online-Verbindung fehlt.");
  if (!navigator.onLine)
    throw new Error("Du bist offline. Dein Entwurf bleibt hier erhalten.");
  const { data, error } = await supabase.rpc("e39_commit", {
    expected_revision: expectedRevision,
    next_state: next,
  });
  if (error) {
    if (error.message.includes("E39_CONFLICT")) throw new ConflictError();
    if (error.message.includes("E39_UPGRADE_REQUIRED"))
      throw new Error(
        "Deine Garage enthält neuere Entwürfe. Bitte die App aktualisieren, bevor du speicherst.",
      );
    throw new Error("Speichern fehlgeschlagen: " + error.message);
  }
  const saved = validateGarage({ ...next, revision: Number(data) });
  await db.put("state", saved, "cloud:" + userId);
  return saved;
}
export async function putLocalFile(id: string, blob: Blob) {
  const db = await dbPromise;
  await db.put("files", blob, id);
}
export async function getLocalFile(id: string): Promise<Blob | undefined> {
  return (await dbPromise).get("files", id);
}
export async function deleteLocalFile(id: string) {
  await (await dbPromise).delete("files", id);
}
export async function saveDraft(kind: string, data: Record<string, string>) {
  await (await dbPromise).put("drafts", data, kind);
}
export async function readDraft(
  kind: string,
): Promise<Record<string, string> | undefined> {
  return (await dbPromise).get("drafts", kind);
}
export async function clearDraft(kind: string) {
  await (await dbPromise).delete("drafts", kind);
}
export async function clearPrivateCache(userId: string) {
  const db = await dbPromise;
  await db.delete("state", "cloud:" + userId);
  await db.clear("drafts");
}
