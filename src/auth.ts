import { adminEmail, isProduction, sessionLifetime, type Env } from "./env.ts";

/**
 * Authentifizierung für die Worker-Laufzeit. Es gibt hier weder bcrypt noch
 * serverseitige PHP-Sessions, daher:
 *   - Passwörter als PBKDF2-SHA256 (in WebCrypto enthalten),
 *   - Anmeldung als HMAC-signiertes Cookie, das jeder Edge-Standort ohne
 *     Datenbankzugriff prüfen kann.
 */

export const SESSION_COOKIE = "drohne_session";
export const CSRF_COOKIE = "drohne_csrf";
/** Nur für die lokale Entwicklung, wenn ADMIN_PASSWORD_HASH fehlt. */
export const DEFAULT_ADMIN_PASSWORD = "Drohne112!";
const PBKDF2_ITERATIONS = 210_000;

export interface SessionUser {
  email: string;
  role: string;
  mustChangePassword: boolean;
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Vergleicht ohne früh abzubrechen, damit die Laufzeit kein Geheimnis verrät. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// --- Passwörter -------------------------------------------------------------

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveKey(password, salt, iterations);
  return `pbkdf2_sha256$${iterations}$${base64UrlEncode(salt)}$${base64UrlEncode(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;

  const iterations = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;

  try {
    const salt = base64UrlDecode(parts[2] ?? "");
    const expected = parts[3] ?? "";
    const derived = await deriveKey(password, salt, iterations);
    return timingSafeEqual(base64UrlEncode(derived), expected);
  } catch {
    return false;
  }
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Ohne ADMIN_PASSWORD_HASH bleibt das Backend in Produktion gesperrt - ein
 * Deploy ohne Secret darf kein bekanntes Standardpasswort akzeptieren.
 */
export async function adminPasswordHash(env: Env): Promise<string | null> {
  if (env.ADMIN_PASSWORD_HASH) return env.ADMIN_PASSWORD_HASH;
  if (isProduction(env)) return null;
  return hashPassword(DEFAULT_ADMIN_PASSWORD, 10_000);
}

export function usesDefaultPassword(env: Env): boolean {
  return !env.ADMIN_PASSWORD_HASH;
}

export async function verifyLogin(env: Env, email: string, password: string): Promise<SessionUser | null> {
  const hash = await adminPasswordHash(env);
  if (hash === null) return null;

  const emailMatches = timingSafeEqual(adminEmail(env), email.trim().toLowerCase());
  // Auch bei falscher E-Mail wird gerechnet, damit die Antwortzeit keine
  // gültige Adresse verrät.
  const passwordMatches = await verifyPassword(password, hash);
  if (!emailMatches || !passwordMatches) return null;

  return { email: adminEmail(env), role: "Administrator", mustChangePassword: usesDefaultPassword(env) };
}

// --- Signaturen -------------------------------------------------------------

function secret(env: Env): string {
  // In Produktion erzwingt configProblems() ein echtes APP_SECRET; lokal genügt
  // ein fester Entwicklungswert, damit `wrangler dev` ohne Setup funktioniert.
  return env.APP_SECRET ?? "entwicklungs-geheimnis-nicht-fuer-produktion";
}

async function sign(env: Env, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

// --- Session-Cookie ---------------------------------------------------------

export async function createSessionCookie(env: Env, user: SessionUser): Promise<string> {
  const payload = base64UrlEncode(
    encoder.encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + sessionLifetime(env) })),
  );
  return `${payload}.${await sign(env, payload)}`;
}

export async function readSessionCookie(env: Env, value: string | undefined): Promise<SessionUser | null> {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  if (!timingSafeEqual(await sign(env, payload), signature)) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Record<string, unknown>;
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) return null;
    // Wird die Admin-Adresse geändert, verlieren alte Cookies ihre Gültigkeit.
    if (String(data.email).toLowerCase() !== adminEmail(env)) return null;
    return {
      email: String(data.email),
      role: String(data.role ?? "Administrator"),
      mustChangePassword: data.mustChangePassword === true,
    };
  } catch {
    return null;
  }
}

// --- CSRF -------------------------------------------------------------------

export function newCsrfSecret(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Signiertes Double-Submit: Das Formularfeld trägt die HMAC des CSRF-Cookies.
 * Ein fremdes Formular kennt weder Cookie noch Geheimnis.
 */
export async function csrfToken(env: Env, csrfSecretValue: string): Promise<string> {
  return sign(env, `csrf:${csrfSecretValue}`);
}

export async function verifyCsrf(env: Env, cookieValue: string | undefined, formValue: unknown): Promise<boolean> {
  if (!cookieValue || typeof formValue !== "string" || formValue === "") return false;
  return timingSafeEqual(await csrfToken(env, cookieValue), formValue);
}

// --- Cookie-Hilfen ----------------------------------------------------------

export function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (name !== "") result[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

/** Cloudflare terminiert TLS, daher ist Secure immer gesetzt ausser auf localhost. */
export function cookieHeader(name: string, value: string, maxAge: number, url: URL): string {
  const secure = url.hostname === "localhost" || url.hostname === "127.0.0.1" ? "" : " Secure;";
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly;${secure} SameSite=Lax`;
}
