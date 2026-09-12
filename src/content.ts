import seed from "../data/site.json";
import type { Env } from "./env.ts";

/**
 * Inhaltsmodell. data/site.json bleibt die versionierte Auslieferungsfassung und
 * dient als Seed; die Redaktion arbeitet danach auf der D1-Kopie.
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
  incidents: Incident[];
  team: { name: string; role: string; qualification: string; image: string; order?: number }[];
  equipment: { name: string; description: string; image: string; features: string[] }[];
  gallery: { url: string; title: string; category: string }[];
}

export class ContentError extends Error {}

const DOCUMENT_ID = "site";

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
  for (const key of ["areas", "incidents", "team", "equipment", "gallery"]) {
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
 * Liest die Inhalte aus D1. Ist die Tabelle noch leer - typisch direkt nach dem
 * ersten Deploy - werden die Seed-Inhalte übernommen.
 */
export async function loadContent(env: Env): Promise<SiteContent> {
  const row = await env.DB.prepare("SELECT payload FROM cms_content WHERE id = ?1")
    .bind(DOCUMENT_ID)
    .first<{ payload: string }>();

  if (row?.payload) {
    try {
      return validateContent(JSON.parse(row.payload));
    } catch (error) {
      throw new ContentError(
        `Inhalte in D1 sind unbrauchbar: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const content = validateContent(seedContent());
  await saveContent(env, content, "seed");
  return content;
}

export async function saveContent(env: Env, data: unknown, author: string): Promise<SiteContent> {
  const content = validateContent(data);
  // UPSERT: zwei gleichzeitig speichernde Redakteure laufen nicht in einen
  // Primärschlüsselkonflikt, der Zähler dokumentiert die Bearbeitungen.
  await env.DB.prepare(
    `INSERT INTO cms_content (id, payload, revision, updated_at, updated_by)
     VALUES (?1, ?2, 1, ?3, ?4)
     ON CONFLICT (id) DO UPDATE SET
       payload = excluded.payload,
       revision = cms_content.revision + 1,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  )
    .bind(DOCUMENT_ID, JSON.stringify(content), new Date().toISOString(), author.slice(0, 190))
    .run();
  return content;
}

export function encodeContent(content: SiteContent): string {
  return JSON.stringify(content, null, 2);
}
