import { DurableObject } from "cloudflare:workers";

import type { Env } from "./env.ts";

/**
 * Speicher für die redaktionellen Inhalte.
 *
 * Bewusst ein Durable Object und keine D1-Datenbank: Ein Durable Object wird
 * beim Deploy zusammen mit dem Worker angelegt. Es muss also keine Datenbank
 * von Hand erstellt und keine ID in die Konfiguration eingetragen werden -
 * `wrangler deploy` funktioniert ohne Vorbereitung.
 *
 * Alle Zugriffe laufen über genau eine Instanz ("site"), damit gleichzeitige
 * Speichervorgänge serialisiert werden und sich nicht überschreiben.
 */
export interface StoredContent {
  payload: string | null;
  /** "seed" solange nur die Auslieferungsfassung eingespielt wurde, sonst die E-Mail. */
  updatedBy: string;
  /** Fingerabdruck der zuletzt eingespielten Auslieferungsfassung. */
  seedFingerprint: string | null;
  revision: number;
  updatedAt: string | null;
}

export class ContentStore extends DurableObject<Env> {
  async read(): Promise<StoredContent> {
    const stored = await this.ctx.storage.get<string | number>([
      "payload",
      "updatedBy",
      "seedFingerprint",
      "revision",
      "updatedAt",
    ]);
    return {
      payload: (stored.get("payload") as string | undefined) ?? null,
      updatedBy: (stored.get("updatedBy") as string | undefined) ?? "seed",
      seedFingerprint: (stored.get("seedFingerprint") as string | undefined) ?? null,
      revision: (stored.get("revision") as number | undefined) ?? 0,
      updatedAt: (stored.get("updatedAt") as string | undefined) ?? null,
    };
  }

  async save(payload: string, author: string, seedFingerprint?: string): Promise<number> {
    const revision = ((await this.ctx.storage.get<number>("revision")) ?? 0) + 1;
    // put() mit mehreren Schlüsseln schreibt atomar - es kann keine Fassung
    // entstehen, in der Inhalt und Metadaten auseinanderlaufen.
    await this.ctx.storage.put({
      payload,
      revision,
      updatedAt: new Date().toISOString(),
      updatedBy: author.slice(0, 190),
      ...(seedFingerprint !== undefined ? { seedFingerprint } : {}),
    });
    return revision;
  }
}
