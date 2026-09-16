import seed from "../data/site.json";
import type { Env } from "./env.ts";
import type { ContentStore } from "./store.ts";

/**
 * Inhaltsmodell. data/site.json bleibt die versionierte Auslieferungsfassung und
 * dient als Seed; die Redaktion arbeitet danach auf der gespeicherten Kopie.
 */
/** "feuerwehr" = allgemeiner Feuerwehreinsatz, "drohne" = Einsatz mit Beteiligung der Fachgruppe Drohne. */
export type IncidentUnit = "feuerwehr" | "drohne";

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
  /** Fehlt das Feld bei älteren Datenständen, gilt der Einsatz als allgemeiner Feuerwehreinsatz. */
  unit?: IncidentUnit;
  /** Beleg-URL, z. B. Pressebericht - macht einen Einsatzeintrag nachprüfbar. */
  source?: string;
  /**
   * Amtliche Einsatznummer der Feuerwehr, z. B. "64/2026" - so wie im EINSATZINFO-Kanal
   * veröffentlicht. Bewusst kein selbst gezählter Wert: die Redaktion erfasst nie alle
   * Einsätze eines Jahres, ein hier errechneter Zähler würde von der echten, öffentlich
   * kommunizierten Nummer abweichen und wäre irreführend.
   */
  number?: string;
}

/** Amtliche Jahresstatistik, z. B. aus Berichten der Jahreshauptversammlung. */
export interface YearlyStat {
  year: number;
  total: number;
  note?: string;
  source?: string;
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
  yearlyStats: YearlyStat[];
}

export class ContentError extends Error {}

/**
 * Stub der einen Instanz, über die alle Inhalte laufen.
 * Bewusst hier und nicht in store.ts: dieses Modul soll ohne die
 * Worker-Laufzeit importierbar bleiben.
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
  // "news" und "yearlyStats" kamen später dazu: ältere Datenstände ohne den
  // jeweiligen Bereich bleiben gültig und werden als leere Liste behandelt.
  if (record.news === undefined) record.news = [];
  if (record.yearlyStats === undefined) record.yearlyStats = [];
  for (const key of ["areas", "news", "incidents", "team", "equipment", "gallery", "yearlyStats"]) {
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
    if (incident.unit !== undefined && incident.unit !== "feuerwehr" && incident.unit !== "drohne") {
      throw new ContentError(`Einsatz-Einheit muss "feuerwehr" oder "drohne" sein: ${String(incident.unit)}`);
    }
    if (incident.number !== undefined) {
      const match = /^\d+\/(\d{4})$/.exec(String(incident.number));
      if (!match) throw new ContentError(`Einsatznummer muss dem Muster "61/2026" folgen: ${String(incident.number)}`);
      if (match[1] !== String(incident.date).slice(0, 4)) {
        throw new ContentError(`Einsatznummer ${String(incident.number)} passt nicht zum Jahr des Einsatzdatums.`);
      }
    }
    if (seen.has(id)) throw new ContentError(`Einsatz-ID ist doppelt vergeben: ${id}`);
    seen.add(id);
  }

  const seenYears = new Set<number>();
  for (const entry of record.yearlyStats as unknown[]) {
    if (typeof entry !== "object" || entry === null) throw new ContentError("Jahresstatistik ist kein Objekt.");
    const stat = entry as Record<string, unknown>;
    if (typeof stat.year !== "number" || !Number.isInteger(stat.year) || stat.year < 2000 || stat.year > 2100) {
      throw new ContentError(`Jahresstatistik.year muss eine vierstellige Jahreszahl sein: ${String(stat.year)}`);
    }
    if (typeof stat.total !== "number" || !Number.isInteger(stat.total) || stat.total < 0) {
      throw new ContentError(`Jahresstatistik.total muss eine nicht-negative ganze Zahl sein: ${String(stat.total)}`);
    }
    if (seenYears.has(stat.year)) throw new ContentError(`Jahresstatistik-Jahr ist doppelt vergeben: ${stat.year}`);
    seenYears.add(stat.year);
  }

  return data as SiteContent;
}

/**
 * Liest die gespeicherten Inhalte. Ist der Speicher noch leer - typisch direkt nach dem
 * ersten Deploy - werden die Seed-Inhalte übernommen.
 */
export async function loadContent(env: Env): Promise<SiteContent> {
  const stored = await contentStore(env).load();

  if (stored !== null) {
    try {
      return validateContent(JSON.parse(stored));
    } catch (error) {
      throw new ContentError(
        `Gespeicherte Inhalte sind unbrauchbar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Erster Aufruf nach dem Deploy: Auslieferungsfassung übernehmen.
  const content = validateContent(seedContent());
  await saveContent(env, content, "seed");
  return content;
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
export async function storeInfo(env: Env): Promise<{ revision: number; updatedAt: string | null }> {
  const info = await contentStore(env).info();
  return { revision: info.revision, updatedAt: info.updatedAt };
}

/** Meldungen nach Datum, neueste zuerst. */
export function sortedNews(content: SiteContent): NewsEntry[] {
  return [...content.news].sort((a, b) => b.date.localeCompare(a.date));
}

/** Einsätze nach Datum, neueste zuerst. */
export function sortedIncidents(content: SiteContent): Incident[] {
  return [...content.incidents].sort((a, b) => b.date.localeCompare(a.date));
}

/** Nur Einsätze mit Beteiligung der Fachgruppe Drohne, neueste zuerst. */
export function droneIncidents(content: SiteContent): Incident[] {
  return sortedIncidents(content).filter((entry) => entry.unit === "drohne");
}

/** Kalenderjahr aus dem YYYY-MM-DD-Datum eines Einsatzes. */
export function incidentYear(incident: Incident): number {
  return Number(incident.date.slice(0, 4));
}

/**
 * Amtliche Einsatznummern, wie im EINSATZINFO-Kanal der Feuerwehr veröffentlicht
 * (z. B. "64/2026"). Nur Einsätze mit erfasster Nummer tauchen hier auf - ein
 * selbst gezählter Ersatzwert würde von der echten Zählung abweichen, sobald
 * nicht jeder Einsatz des Jahres auf dieser Seite steht.
 */
export function incidentNumbers(content: SiteContent): Map<string, string> {
  const numbers = new Map<string, string>();
  for (const incident of content.incidents) {
    if (incident.number) numbers.set(incident.id, incident.number);
  }
  return numbers;
}

/** Nur Einsätze aus dem angegebenen Kalenderjahr, neueste zuerst. */
export function incidentsInYear(content: SiteContent, year: number): Incident[] {
  return sortedIncidents(content).filter((entry) => incidentYear(entry) === year);
}

/** Alle Jahre mit mindestens einem erfassten Einsatz, absteigend sortiert. */
export function incidentYears(content: SiteContent): number[] {
  return [...new Set(content.incidents.map(incidentYear))].sort((a, b) => b - a);
}
