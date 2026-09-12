import { handleAdminPost, renderAdmin } from "./admin.ts";
import { CSRF_COOKIE, cookieHeader, newCsrfSecret, parseCookies, readSessionCookie, SESSION_COOKIE } from "./auth.ts";
import { loadContent, storeInfo, type SiteContent } from "./content.ts";
import { appEnv, appVersion, configProblems, isDebug, pageCacheSeconds, type Env } from "./env.ts";
import { e } from "./html.ts";
import { renderFooter, renderHeader } from "./layout.ts";
import * as views from "./views.ts";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  // Die Seite kommt ohne eigenes JavaScript aus, deshalb script-src 'none'.
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'none'; " +
    "form-action 'self'; frame-ancestors 'none'; base-uri 'self'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export { ContentStore } from "./store.ts";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") || "/" : "/";

    try {
      return await route(request, env, ctx, url, path);
    } catch (error) {
      console.error(
        JSON.stringify({ level: "error", message: "Unbehandelte Ausnahme", path, error: String(error) }),
      );
      return errorPage(env, 500, "Interner Serverfehler", error);
    }
  },
} satisfies ExportedHandler<Env>;

async function route(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  url: URL,
  path: string,
): Promise<Response> {
  // Probes zuerst: sie müssen auch antworten, wenn der Inhaltsspeicher streikt.
  if (path === "/healthz" || path === "/livez") {
    return json(200, { status: "ok", env: appEnv(env), version: appVersion(env) });
  }
  if (path === "/readyz") return readiness(env);

  if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD, POST" } });
  }

  const cookies = parseCookies(request.headers.get("Cookie"));

  if (request.method === "POST") {
    if (path !== "/admin") return new Response("Not Found", { status: 404 });
    return withSecurityHeaders(await handleAdminPost(request, env, url, cookies));
  }

  let content: SiteContent;
  try {
    content = await loadContent(env);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "Inhalte nicht ladbar", error: String(error) }));
    return errorPage(env, 503, "Inhalte nicht verfügbar", error);
  }

  if (path === "/admin") return adminPage(env, url, content, cookies);

  const page = renderPublic(path, content);
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    // Öffentliche Seiten dürfen im Cloudflare-Cache liegen, das Backend nie.
    "Cache-Control": `public, max-age=${pageCacheSeconds(env)}, stale-while-revalidate=600`,
  });
  return withSecurityHeaders(
    new Response(renderHeader(env, content, page.title) + page.body + renderFooter(env, content), {
      status: page.status,
      headers,
    }),
  );
}

function renderPublic(path: string, c: SiteContent): { status: number; title: string; body: string } {
  const newsMatch = /^\/news\/([a-z0-9-]+)$/.exec(path);
  if (newsMatch) {
    const body = views.newsDetail(c, newsMatch[1] as string);
    return body
      ? { status: 200, title: "News", body }
      : { status: 404, title: "Nicht gefunden", body: views.notFound() };
  }

  const incidentMatch = /^\/einsaetze\/([a-z0-9-]+)$/.exec(path);
  if (incidentMatch) {
    const body = views.incidentDetail(c, incidentMatch[1] as string);
    return body
      ? { status: 200, title: "Einsätze", body }
      : { status: 404, title: "Nicht gefunden", body: views.notFound() };
  }

  switch (path) {
    case "/":
      return { status: 200, title: "", body: views.home(c) };
    case "/news":
      return { status: 200, title: "News", body: views.news(c) };
    case "/einsaetze":
      return { status: 200, title: "Einsätze", body: views.incidents(c) };
    case "/technik":
      return { status: 200, title: "Technik", body: views.equipment(c) };
    case "/team":
      return { status: 200, title: "Team", body: views.team(c) };
    case "/ausbildung":
      return { status: 200, title: "Ausbildung", body: views.training(c) };
    case "/galerie":
      return { status: 200, title: "Galerie", body: views.gallery(c) };
    case "/kontakt":
      return { status: 200, title: "Kontakt", body: views.contact(c) };
    case "/impressum":
      return {
        status: 200,
        title: "Impressum",
        body: views.legalPage("Impressum", "Rechtlich geprüfte Angaben vor Live-Gang ergänzen."),
      };
    case "/datenschutz":
      return {
        status: 200,
        title: "Datenschutz",
        body: views.legalPage(
          "Datenschutzerklärung",
          "Datenschutzerklärung vor Live-Gang rechtlich prüfen und an Hosting, Formulare, Cookies und Medien anpassen.",
        ),
      };
    default:
      return { status: 404, title: "Nicht gefunden", body: views.notFound() };
  }
}

async function adminPage(
  env: Env,
  url: URL,
  content: SiteContent,
  cookies: Record<string, string>,
): Promise<Response> {
  const user = await readSessionCookie(env, cookies[SESSION_COOKIE]);
  // Ohne CSRF-Cookie gäbe es kein Gegenstück zum Formular-Token.
  const csrfSecretValue = cookies[CSRF_COOKIE] ?? newCsrfSecret();

  const body = await renderAdmin(env, url, content, user, csrfSecretValue);
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, private",
    "X-Robots-Tag": "noindex, nofollow",
  });
  if (!cookies[CSRF_COOKIE]) {
    headers.append("Set-Cookie", cookieHeader(CSRF_COOKIE, csrfSecretValue, 7200, url));
  }

  return withSecurityHeaders(
    new Response(renderHeader(env, content, "Admin") + body + renderFooter(env, content), { status: 200, headers }),
  );
}

async function readiness(env: Env): Promise<Response> {
  const problems = configProblems(env);
  let revision: number | null = null;

  try {
    revision = (await storeInfo(env)).revision;
  } catch (error) {
    problems.push(
      `Inhaltsspeicher nicht erreichbar: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const ready = problems.length === 0;
  return json(ready ? 200 : 503, {
    status: ready ? "ready" : "unready",
    env: appEnv(env),
    version: appVersion(env),
    store: "durable-object",
    revision,
    problems,
  });
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload, null, 2) + "\n", {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** Fehlerseite ohne Interna: Details nur, wenn APP_DEBUG gesetzt ist. */
function errorPage(env: Env, status: number, headline: string, error: unknown): Response {
  const detail = isDebug(env) && error instanceof Error ? error.message : "Bitte später erneut versuchen.";
  const body =
    `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(headline)}</title>` +
    `<link rel="stylesheet" href="/styles.css"></head><body>` +
    `<div class="page-hero"><h1>${e(headline)}</h1></div>` +
    `<section class="wrap card"><p>${e(detail)}</p>` +
    `<p><a class="btn red" href="/">Zur Startseite</a></p></section></body></html>`;
  return withSecurityHeaders(
    new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }),
  );
}
