/**
 * Bindings und Variablen, die Cloudflare dem Worker zur Laufzeit übergibt.
 * Secrets (APP_SECRET, ADMIN_PASSWORD_HASH) werden per `wrangler secret put`
 * gesetzt und erscheinen nie im Repository.
 */
export interface Env {
  /** D1-Datenbank: persistiert die redaktionellen Inhalte ausserhalb des Workers. */
  DB: D1Database;
  /** Statische Dateien aus public/ (styles.css, robots.txt). */
  ASSETS: Fetcher;

  APP_ENV?: string;
  APP_DEBUG?: string;
  APP_VERSION?: string;
  PAGE_CACHE_SECONDS?: string;

  ADMIN_EMAIL?: string;
  /** PBKDF2-Hash, erzeugt mit `npm run hash-password`. */
  ADMIN_PASSWORD_HASH?: string;
  /** Gemeinsames Geheimnis für Session- und CSRF-Signaturen. */
  APP_SECRET?: string;
  SESSION_LIFETIME?: string;
}

export const DEFAULT_ADMIN_EMAIL = "admin@feuerwehr-biebertal.local";

export function appEnv(env: Env): "production" | "staging" | "development" {
  const value = (env.APP_ENV ?? "production").toLowerCase();
  return value === "staging" || value === "development" ? value : "production";
}

export function isProduction(env: Env): boolean {
  return appEnv(env) === "production";
}

export function isDebug(env: Env): boolean {
  return env.APP_DEBUG === "true" || (env.APP_DEBUG === undefined && !isProduction(env));
}

export function appVersion(env: Env): string {
  return env.APP_VERSION ?? "dev";
}

export function adminEmail(env: Env): string {
  return (env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

export function sessionLifetime(env: Env): number {
  const parsed = Number.parseInt(env.SESSION_LIFETIME ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7200;
}

export function pageCacheSeconds(env: Env): number {
  const parsed = Number.parseInt(env.PAGE_CACHE_SECONDS ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
}

/**
 * Prüft die Umgebung auf Lücken, die erst in Produktion weh tun.
 * Wird von /readyz ausgewertet, damit ein unvollständiger Deploy auffällt.
 */
export function configProblems(env: Env): string[] {
  const problems: string[] = [];
  if (!env.DB) {
    problems.push("D1-Binding DB fehlt: In wrangler.toml konfigurieren und `npm run db:migrate` ausführen.");
  }
  if (isProduction(env)) {
    if (!env.ADMIN_PASSWORD_HASH) {
      problems.push("ADMIN_PASSWORD_HASH fehlt: In Produktion gibt es kein Standardpasswort, das Backend bleibt gesperrt.");
    }
    if (!env.APP_SECRET) {
      problems.push("APP_SECRET fehlt: Ohne Geheimnis können Session- und CSRF-Signaturen nicht geprüft werden.");
    }
  }
  return problems;
}
