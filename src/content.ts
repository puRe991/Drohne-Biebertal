import seed from "../data/site.json";
import type { Env } from "./env.ts";
import type { ContentStore } from "./store.ts";

/**
 * Inhaltsmodell. data/site.json bleibt die versionierte Auslieferungsfassung und
 * dient als Seed; die Redaktion arbeitet danach auf der gespeicherten Kopie.
 */
export interface Incident {
  id: string;
  title: string;
  date: string;
  place: string;
  category: string;
  status: string;
  image: string;
  description: string;
  duration?: string;
}

export interface NewsEntry {
  id: string;
  title: string;
  date: string;
  text: string;
  image?: string;
}

export interface SiteContent {
  settings: {
    siteName: string;
    subtitle: string;
    claim: string;
    email: string;
    phone: string;
    address: string;
    socials?: Record<string, string>;
  };
  pages: {
    heroHeadline: string;
    heroKicker: string;
    heroSubline: string;
    ctaTitle: string;
    ctaText: string;
    training: string;
    contactIntro: string;
  };
  areas: { title: string; text: string; icon?: string }[];
  news: NewsEntry[];
  incidents: Incident[];
  team: { name: string; role: string; qualification?: string; image?: string; order?: number }[];
  equipment: { name: string; description: string; image: string; features: string[] }[];
  gallery: { url: string; title: string; category: string }[];
}

export class ContentError extends Error {}

/**
 * Stub der einen Instanz, über die alle Inhalte laufen.
 * Bewusst hier und nicht in store.ts: dieses Modul soll ohne die Worker-Laufzeit
 * importierbar bleiben, damit die Unit-Tests unter Node laufen.
 */
function contentStore(env: Env): DurableObjectStub<ContentStore> {
  return env.CONTENT.get(env.CONTENT.idFromName("site"));
}


export function seedContent(): SiteContent {
  // Strukturierte Kopie, damit Aufrufer das importierte Modul nicht verändern.
  return structuredClone(seed) as SiteContent;
}

function requireString(source: Record<string, unknown>, key: string, where: string): void {
  const value = source[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ContentError(`Pflichtfeld fehlt oder ist leer: ${where}.${key}`);
  }
}

/**
 * Prüft die vom Backend gelieferten Inhalte, bevor sie gespeichert werden.
 * Ein fehlerhafter JSON-Block darf die öffentliche Website nicht zerstören.
 */
export function validateContent(data: unknown): SiteContent {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ContentError("Inhalte müssen ein JSON-Objekt sein.");
  }
  const record = data as Record<string, unknown>;

  for (const key of ["settings", "pages", "areas", "incidents", "team", "equipment", "gallery"]) {
    if (!(key in record)) throw new ContentError(`Bereich fehlt: ${key}`);
  }
  // "news" kam später dazu: ältere Datenstände ohne den Bereich bleiben gültig
  // und werden als leere Liste behandelt.
  if (record.news === undefined) record.news = [];
  for (const key of ["areas", "news", "incidents", "team", "equipment", "gallery"]) {
    if (!Array.isArray(record[key])) throw new ContentError(`Bereich muss eine Liste sein: ${key}`);
  }

  const settings = record.settings;
  if (typeof settings !== "object" || settings === null) throw new ContentError("Bereich settings ist kein Objekt.");
  const settingsRecord = settings as Record<string, unknown>;
  for (const key of ["siteName", "subtitle", "claim", "email", "phone", "address"]) {
    requireString(settingsRecord, key, "settings");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settingsRecord.email))) {
    throw new ContentError("Ungültige Kontakt-E-Mail in settings.email.");
  }

  const pages = record.pages;
  if (typeof pages !== "object" || pages === null) throw new ContentError("Bereich pages ist kein Objekt.");
  const pagesRecord = pages as Record<string, unknown>;
  for (const key of ["heroHeadline", "heroKicker", "heroSubline", "ctaTitle", "ctaText", "training", "contactIntro"]) {
    requireString(pagesRecord, key, "pages");
  }

  const seenNews = new Set<string>();
  for (const entry of record.news as unknown[]) {
    if (typeof entry !== "object" || entry === null) throw new ContentError("Meldung ist kein Objekt.");
    const item = entry as Record<string, unknown>;
    for (const key of ["id", "title", "date", "text"]) requireString(item, key, "news[]");

    const id = String(item.id);
    if (!/^[a-z0-9-]+$/.test(id)) {
      throw new ContentError(`Meldungs-ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten: ${id}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.date))) {
      throw new ContentError(`Meldungsdatum muss YYYY-MM-DD sein: ${String(item.date)}`);
    }
    if (seenNews.has(id)) throw new ContentError(`Meldungs-ID ist doppelt vergeben: ${id}`);
    seenNews.add(id);
  }

  const seen = new Set<string>();
  for (const entry of record.incidents as unknown[]) {
    if (typeof entry !== "object" || entry === null) throw new ContentError("Einsatz ist kein Objekt.");
    const incident = entry as Record<string, unknown>;
    for (const key of ["id", "title", "date", "place", "category", "status", "image", "description"]) {
      requireString(incident, key, "incidents[]");
    }
    const id = String(incident.id);
    if (!/^[a-z0-9-]+$/.test(id)) {
      throw new ContentError(`Einsatz-ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten: ${id}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(incident.date))) {
      throw new ContentError(`Einsatzdatum muss YYYY-MM-DD sein: ${String(incident.date)}`);
    }
    if (seen.has(id)) throw new ContentError(`Einsatz-ID ist doppelt vergeben: ${id}`);
    seen.add(id);
  }

  return data as SiteContent;
}

/**
 * Liest die gespeicherten Inhalte. Ist der Speicher noch leer - typisch direkt nach dem
 * ersten Deploy - werden die Seed-Inhalte übernommen.
 */
/** Fingerabdruck der Auslieferungsfassung, um Änderungen am Repository zu erkennen. */
export async function fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Entscheidet, ob die Auslieferungsfassung eingespielt wird.
 *
 *  - "erstbefuellung": Der Speicher ist leer.
 *  - "aktualisieren":  Es wurde nur geseedet und data/site.json hat sich geändert;
 *                      das Repository bleibt bis zur ersten Bearbeitung die Quelle.
 *  - "redaktion-behalten": Die Redaktion hat gespeichert. Ihre Fassung gewinnt
 *                      immer - ein Deployment darf redaktionelle Arbeit niemals
 *                      überschreiben.
 */
export type SeedDecision = "erstbefuellung" | "aktualisieren" | "unveraendert" | "redaktion-behalten";

export function seedDecision(
  stored: { payload: string | null; updatedBy: string; seedFingerprint: string | null },
  seedPrint: string,
): SeedDecision {
  if (stored.payload === null) return "erstbefuellung";
  if (stored.updatedBy !== "seed") return "redaktion-behalten";
  return stored.seedFingerprint === seedPrint ? "unveraendert" : "aktualisieren";
}

export async function loadContent(env: Env): Promise<SiteContent> {
  const store = contentStore(env);
  const stored = await store.read();
  const seed = encodeContent(validateContent(seedContent()));
  const seedPrint = await fingerprint(seed);
  const decision = seedDecision(stored, seedPrint);

  if (decision === "erstbefuellung" || decision === "aktualisieren") {
    await store.save(seed, "seed", seedPrint);
    console.info(JSON.stringify({
      level: "info",
      message: decision === "erstbefuellung"
        ? "Inhaltsspeicher war leer und wurde aus data/site.json befüllt."
        : "Auslieferungsfassung hat sich geändert und wurde übernommen (noch keine Bearbeitung im Backend).",
    }));
    return validateContent(JSON.parse(seed));
  }

  if (decision === "redaktion-behalten" && stored.seedFingerprint !== seedPrint) {
    console.info(JSON.stringify({
      level: "info",
      message: "data/site.json weicht von den redaktionellen Inhalten ab und wird nicht übernommen.",
    }));
  }

  try {
    return validateContent(JSON.parse(stored.payload as string));
  } catch (error) {
    throw new ContentError(
      `Gespeicherte Inhalte sind unbrauchbar: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function saveContent(env: Env, data: unknown, author: string): Promise<SiteContent> {
  const content = validateContent(data);
  await contentStore(env).save(JSON.stringify(content), author);
  return content;
}

export function encodeContent(content: SiteContent): string {
  return JSON.stringify(content, null, 2);
}

/** Metadaten des Speichers für die Readiness-Prüfung. */
export async function storeInfo(env: Env): Promise<{
  revision: number;
  updatedAt: string | null;
  source: "auslieferung" | "redaktion";
}> {
  const stored = await contentStore(env).read();
  return {
    revision: stored.revision,
    updatedAt: stored.updatedAt,
    source: stored.updatedBy === "seed" ? "auslieferung" : "redaktion",
  };
}

/** Meldungen nach Datum, neueste zuerst. */
export function sortedNews(content: SiteContent): NewsEntry[] {
  return [...content.news].sort((a, b) => b.date.localeCompare(a.date));
}
