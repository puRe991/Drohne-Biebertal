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
export class ContentStore extends DurableObject<Env> {
  async load(): Promise<string | null> {
    return (await this.ctx.storage.get<string>("payload")) ?? null;
  }

  async save(payload: string, author: string): Promise<number> {
    const revision = ((await this.ctx.storage.get<number>("revision")) ?? 0) + 1;
    // put() mit mehreren Schlüsseln schreibt atomar - es kann keine Fassung
    // entstehen, in der Inhalt und Metadaten auseinanderlaufen.
    await this.ctx.storage.put({
      payload,
      revision,
      updatedAt: new Date().toISOString(),
      updatedBy: author.slice(0, 190),
    });
    return revision;
  }

  async info(): Promise<{ revision: number; updatedAt: string | null; updatedBy: string | null }> {
    return {
      revision: (await this.ctx.storage.get<number>("revision")) ?? 0,
      updatedAt: (await this.ctx.storage.get<string>("updatedAt")) ?? null,
      updatedBy: (await this.ctx.storage.get<string>("updatedBy")) ?? null,
    };
  }
}
