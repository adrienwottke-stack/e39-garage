import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { validateGarage, type Garage } from "./domain";
import { getLocalFile, putLocalFile, supabase } from "./repository";
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function makeBackup(state: Garage) {
  const files: Record<string, Uint8Array> = {
    "garage.json": strToU8(JSON.stringify(state, null, 2)),
  };
  let total = 0;
  for (const doc of state.documents) {
    let blob: Blob | undefined;
    if (doc.location === "cloud") {
      if (!supabase)
        throw new Error(
          "Für die vollständige Sicherung bitte online anmelden.",
        );
      const { data, error } = await supabase.storage
        .from("e39-documents")
        .download(doc.path);
      if (error)
        throw new Error("Beleg konnte nicht gesichert werden: " + doc.name);
      blob = data ?? undefined;
    } else blob = await getLocalFile(doc.id);
    if (!blob) throw new Error("Beleg fehlt auf diesem Gerät: " + doc.name);
    total += blob.size;
    if (total > 100 * 1024 * 1024)
      throw new Error(
        "Die Sicherung ist größer als 100 MB. Bitte Belege einzeln sichern.",
      );
    files["files/" + doc.id] = new Uint8Array(await blob.arrayBuffer());
  }
  return zipSync(files, { level: 1 });
}
export async function exportGarage(state: Garage) {
  const zipped = await makeBackup(state);
  download(
    new Blob([new Uint8Array(zipped)], { type: "application/zip" }),
    "e39-garage-" + new Date().toISOString().slice(0, 10) + ".zip",
  );
}
export async function readBackup(
  file: File,
): Promise<{ state: Garage; files: Map<string, Blob> }> {
  if (file.size > 110 * 1024 * 1024)
    throw new Error("Die Sicherung ist zu groß (maximal 110 MB).");
  let expanded = 0;
  const extracted = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (expanded > 110 * 1024 * 1024 || entry.originalSize > 11 * 1024 * 1024)
        throw new Error("Die entpackte Sicherung ist zu groß.");
      return (
        entry.name === "garage.json" ||
        /^files\/[a-zA-Z0-9-]+$/.test(entry.name)
      );
    },
  });
  if (!extracted["garage.json"])
    throw new Error("Keine E39-Sicherung gefunden.");
  const state = validateGarage(JSON.parse(strFromU8(extracted["garage.json"])));
  const blobs = new Map<string, Blob>();
  for (const doc of state.documents) {
    const bytes = extracted["files/" + doc.id];
    if (!bytes || bytes.length !== doc.bytes)
      throw new Error("Ein Beleg fehlt oder ist beschädigt: " + doc.name);
    blobs.set(doc.id, new Blob([new Uint8Array(bytes)], { type: doc.mime }));
  }
  return { state, files: blobs };
}
export async function storeImportedFiles(files: Map<string, Blob>) {
  for (const [id, file] of files) await putLocalFile(id, file);
}
