import { beforeEach, describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import { emptyGarage } from "./domain";
import { photoLook, saveLookDraft } from "./studio-domain";
const { files } = vi.hoisted(() => ({ files: new Map<string, Blob>() }));
vi.mock("./repository", () => ({
  getLocalFile: async (id: string) => files.get(id),
  putLocalFile: async (id: string, blob: Blob) => files.set(id, blob),
  supabase: null,
}));
import { makeBackup, readBackup } from "./backup";
beforeEach(() => files.clear());
describe("Vollständige Sicherungen", () => {
  it("erhält Akte und tatsächliche Belegbytes im ZIP", async () => {
    const g = emptyGarage();
    g.studio = saveLookDraft(g.studio, "A", "Eigener Entwurf", {
      ...photoLook(),
      wheelStyle: "mesh",
      wheelFinish: "bronze",
      lowering: 35,
    });
    const blob = new Blob(["%PDF-1.7\nSynthetischer Testbeleg"], {
      type: "application/pdf",
    });
    g.documents = [
      {
        id: "test-file",
        name: "Rechnung.pdf",
        mime: "application/pdf",
        bytes: blob.size,
        date: "2026-10-14",
        entryId: null,
        path: "test-file",
        location: "local",
      },
    ];
    files.set("test-file", blob);
    const bytes = await makeBackup(g);
    const restored = await readBackup(
      new File([new Uint8Array(bytes)], "garage.zip"),
    );
    expect(restored.state).toEqual(g);
    expect(await restored.files.get("test-file")!.text()).toBe(
      await blob.text(),
    );
  });
  it("meldet fehlende Belege statt eine unvollständige Sicherung zu versprechen", async () => {
    const g = emptyGarage();
    g.documents = [
      {
        id: "missing",
        name: "Fehlender Beleg.pdf",
        mime: "application/pdf",
        bytes: 10,
        date: "2026-10-14",
        entryId: null,
        path: "missing",
        location: "local",
      },
    ];
    await expect(makeBackup(g)).rejects.toThrow("Beleg fehlt");
  });
  it("weist ZIPs ohne Akte zurück", async () => {
    const bytes = zipSync({ "anderes.txt": strToU8("Kein Fahrzeug") });
    await expect(
      readBackup(new File([new Uint8Array(bytes)], "anders.zip")),
    ).rejects.toThrow("Keine E39-Sicherung");
  });
  it("weist unvollständige und beschädigte Belege zurück", async () => {
    const g = emptyGarage();
    g.documents = [
      {
        id: "bad",
        name: "Falsch.pdf",
        mime: "application/pdf",
        bytes: 40,
        date: "2026-10-14",
        entryId: null,
        path: "bad",
        location: "local",
      },
    ];
    const bytes = zipSync({
      "garage.json": strToU8(JSON.stringify(g)),
      "files/bad": strToU8("Zu kurz"),
    });
    await expect(
      readBackup(new File([new Uint8Array(bytes)], "bad.zip")),
    ).rejects.toThrow("beschädigt");
  });
});
