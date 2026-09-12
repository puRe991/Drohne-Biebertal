import { ContentError, encodeContent, loadContent, saveContent, type Incident, type SiteContent } from "./content.ts";
import { DEFAULT_ADMIN_EMAIL, isProduction, sessionLifetime, type Env } from "./env.ts";
import { e, uniqueSlug } from "./html.ts";
import {
  adminPasswordHash,
  cookieHeader,
  createSessionCookie,
  csrfToken,
  CSRF_COOKIE,
  DEFAULT_ADMIN_PASSWORD,
  newCsrfSecret,
  readSessionCookie,
  SESSION_COOKIE,
  usesDefaultPassword,
  verifyCsrf,
  verifyLogin,
  type SessionUser,
} from "./auth.ts";

/** Übersetzt einen Code aus der Redirect-URL; fremder Text wird nie ausgegeben. */
export function adminMessage(code: string): string {
  const messages: Record<string, string> = {
    credentials: "Login fehlgeschlagen.",
    auth: "Bitte zuerst anmelden.",
    csrf: "Ungültiges oder abgelaufenes Formular. Bitte erneut versuchen.",
    locked: "Das Backend ist gesperrt: ADMIN_PASSWORD_HASH ist nicht gesetzt.",
    json: "Die Inhalte sind kein gültiges JSON.",
    validation: "Die Inhalte sind unvollständig oder fehlerhaft.",
    storage: "Speichern fehlgeschlagen. Details stehen im Worker-Log.",
  };
  return messages[code] ?? "Aktion fehlgeschlagen.";
}

export async function renderAdmin(
  env: Env,
  url: URL,
  content: SiteContent,
  user: SessionUser | null,
  csrfSecretValue: string,
): Promise<string> {
  const token = await csrfToken(env, csrfSecretValue);
  const error = url.searchParams.get("error");
  const notice = error ? `<p class="redtext">${e(adminMessage(error))}</p>` : "";

  if (!user) return renderLogin(env, token, notice);
  return renderDashboard(env, content, user, token, notice, url.searchParams.has("saved"));
}

async function renderLogin(env: Env, token: string, notice: string): Promise<string> {
  const locked = (await adminPasswordHash(env)) === null;
  const hint = locked
    ? `<p class="redtext">Dieses Deployment hat kein <code>ADMIN_PASSWORD_HASH</code>. ` +
      `Secret setzen mit <code>npx wrangler secret put ADMIN_PASSWORD_HASH</code>.</p>`
    : usesDefaultPassword(env)
      ? `<p><b>Entwicklungszugang:</b> ${e(DEFAULT_ADMIN_EMAIL)} / ${e(DEFAULT_ADMIN_PASSWORD)}</p>`
      : "";

  return (
    `<section class="admin"><div class="card" style="max-width:480px;margin:60px auto"><h1>Admin-Login</h1>` +
    hint +
    notice +
    `<form method="post" action="/admin"><input type="hidden" name="action" value="login">` +
    `<input type="hidden" name="csrf" value="${e(token)}">` +
    `<input name="email" type="email" placeholder="E-Mail" autocomplete="username" required>` +
    `<input name="password" type="password" placeholder="Passwort" autocomplete="current-password" required>` +
    `<button class="btn red"${locked ? " disabled" : ""}>Einloggen</button></form></div></section>`
  );
}

function renderDashboard(
  env: Env,
  content: SiteContent,
  user: SessionUser,
  token: string,
  notice: string,
  saved: boolean,
): string {
  const warning = user.mustChangePassword && !isProduction(env)
    ? `<p class="redtext">Es ist kein <code>ADMIN_PASSWORD_HASH</code> gesetzt. Vor dem Live-Gang zwingend nachholen.</p>`
    : "";

  return (
    `<section class="admin"><div class="adminnav"><a href="#incidents">Einsätze</a><a href="#json">Alle Inhalte</a>` +
    `<form method="post" action="/admin"><input type="hidden" name="action" value="logout">` +
    `<input type="hidden" name="csrf" value="${e(token)}"><button>Logout</button></form></div>` +
    `<h1>CMS Backend</h1>` +
    `<p>Angemeldet als ${e(user.email)} (${e(user.role)}). Inhalte werden in der D1-Datenbank gespeichert.</p>` +
    warning +
    (saved ? `<p class="redtext">Gespeichert.</p>` : "") +
    notice +
    `<div id="incidents" class="card"><h2>Einsatz anlegen</h2>` +
    `<form method="post" action="/admin" class="grid formgrid">` +
    `<input type="hidden" name="action" value="add_incident"><input type="hidden" name="csrf" value="${e(token)}">` +
    `<input name="title" placeholder="Titel" required><input name="date" type="date" required>` +
    `<input name="place" placeholder="Ort" required>` +
    `<select name="category"><option>Personensuche</option><option>Lageerkundung</option>` +
    `<option>Wärmebild</option><option>Dokumentation</option></select>` +
    `<input name="duration" placeholder="Dauer"><input name="image" type="url" placeholder="Bild-URL (https://…)">` +
    `<textarea name="description" placeholder="Beschreibung" style="grid-column:1/-1" required></textarea>` +
    `<button class="btn red">Speichern</button></form></div>` +
    `<div id="json" class="card" style="margin-top:24px"><h2>Redaktionelle Inhalte bearbeiten</h2>` +
    `<form method="post" action="/admin"><input type="hidden" name="action" value="save_json">` +
    `<input type="hidden" name="csrf" value="${e(token)}">` +
    `<textarea name="json" spellcheck="false">${e(encodeContent(content))}</textarea>` +
    `<button class="btn red">Alle Inhalte speichern</button></form></div></section>`
  );
}

function redirect(location: string, headers: HeadersInit = {}): Response {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store", ...headers } });
}

/** Verarbeitet alle POSTs auf /admin. */
export async function handleAdminPost(
  request: Request,
  env: Env,
  url: URL,
  cookies: Record<string, string>,
): Promise<Response> {
  const form = await request.formData();
  const action = String(form.get("action") ?? "");

  if (!(await verifyCsrf(env, cookies[CSRF_COOKIE], form.get("csrf")))) {
    return redirect("/admin?error=csrf");
  }

  if (action === "logout") {
    return redirect("/admin", { "Set-Cookie": cookieHeader(SESSION_COOKIE, "", 0, url) });
  }

  if (action === "login") {
    if ((await adminPasswordHash(env)) === null) return redirect("/admin?error=locked");

    const user = await verifyLogin(env, String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    if (!user) {
      console.warn(JSON.stringify({ level: "warning", message: "Fehlgeschlagener Admin-Login", ip: request.headers.get("CF-Connecting-IP") }));
      return redirect("/admin?error=credentials");
    }

    console.info(JSON.stringify({ level: "info", message: "Erfolgreicher Admin-Login", email: user.email }));
    const cookie = await createSessionCookie(env, user);
    return redirect("/admin", { "Set-Cookie": cookieHeader(SESSION_COOKIE, cookie, sessionLifetime(env), url) });
  }

  const session = await readSessionCookie(env, cookies[SESSION_COOKIE]);
  if (!session) return redirect("/admin?error=auth");

  if (action === "save_json") return saveJson(env, form, session);
  if (action === "add_incident") return addIncident(env, form, session);
  return redirect("/admin?error=unknown");
}

async function saveJson(env: Env, form: FormData, user: SessionUser): Promise<Response> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(form.get("json") ?? ""));
  } catch {
    return redirect("/admin?error=json");
  }
  return persist(env, parsed, user);
}

async function addIncident(env: Env, form: FormData, user: SessionUser): Promise<Response> {
  const content = await loadContent(env);

  const title = String(form.get("title") ?? "").trim();
  if (title === "") return redirect("/admin?error=validation");

  const image = String(form.get("image") ?? "").trim();
  // Nur http(s) zulassen; eine javascript:-URL darf nicht ins src-Attribut wandern.
  if (image !== "" && !/^https?:\/\//i.test(image)) return redirect("/admin?error=validation");

  const incident: Incident = {
    id: uniqueSlug(title, content.incidents.map((entry) => entry.id)),
    title,
    date: String(form.get("date") ?? "").trim(),
    place: String(form.get("place") ?? "").trim(),
    category: String(form.get("category") ?? "Lageerkundung"),
    status: "abgeschlossen",
    duration: String(form.get("duration") ?? "").trim(),
    image: image !== "" ? image : "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    description: String(form.get("description") ?? "").trim(),
  };

  content.incidents.push(incident);
  return persist(env, content, user);
}

async function persist(env: Env, data: unknown, user: SessionUser): Promise<Response> {
  try {
    await saveContent(env, data, user.email);
  } catch (error) {
    if (error instanceof ContentError) {
      console.warn(JSON.stringify({ level: "warning", message: "Inhalte abgelehnt", error: error.message }));
      return redirect("/admin?error=validation");
    }
    console.error(JSON.stringify({ level: "error", message: "Speichern fehlgeschlagen", error: String(error) }));
    return redirect("/admin?error=storage");
  }
  return redirect("/admin?saved=1");
}

export { newCsrfSecret };
