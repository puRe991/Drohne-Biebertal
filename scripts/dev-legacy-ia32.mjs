import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import bcrypt from 'bcryptjs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const dataFile = join(rootDir, 'data', 'site.json');
const publicDir = join(rootDir, 'public');
const port = Number(process.env.PORT || 3000);
const listenHost = process.env.DEV_HOST || '0.0.0.0';
const displayHost = listenHost === '0.0.0.0' ? 'localhost' : listenHost;
const sessionCookie = 'drohne_legacy_admin';
const csrfCookie = 'drohne_legacy_csrf';
const defaultSessionSecret = 'dev-secret-change-me-dev-secret-change-me';
const sessionSecret = process.env.SESSION_SECRET || defaultSessionSecret;
const adminEmail = process.env.ADMIN_EMAIL || 'admin@feuerwehr-biebertal.local';
const defaultPasswordHash = '$2a$10$97urkHjthw9JLiyd1Ok8peqCEB/ICMREr0wQpeL8yQES1971ieb1K';

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeList(value) {
  return Array.isArray(value) ? value : [];
}

function redirect(response, location, headers = {}) {
  response.writeHead(303, { location, ...headers });
  response.end();
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...rest] = part.split('=');
        return [name, decodeURIComponent(rest.join('='))];
      }),
  );
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value) {
  return createHmac('sha256', sessionSecret).update(value).digest('base64url');
}

function signedCookie(name, value, maxAgeSeconds) {
  const encoded = base64UrlEncode(value);
  const cookieValue = `${encoded}.${sign(encoded)}`;
  const maxAge = Number.isFinite(maxAgeSeconds) ? `; Max-Age=${maxAgeSeconds}` : '';
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax${secure}${maxAge}`;
}

function verifySignedCookie(rawValue) {
  if (!rawValue || !rawValue.includes('.')) return null;
  const [encoded, signature] = rawValue.split('.', 2);
  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    return base64UrlDecode(encoded);
  } catch {
    return null;
  }
}

function getSession(request) {
  const raw = parseCookies(request)[sessionCookie];
  const payload = verifySignedCookie(raw);
  if (!payload) return null;
  try {
    const session = JSON.parse(payload);
    if (session?.email && session?.expiresAt > Date.now()) return session;
  } catch {
    return null;
  }
  return null;
}

function createSessionCookie() {
  const session = {
    email: adminEmail,
    role: 'Administrator',
    mustChangePassword: !process.env.ADMIN_PASSWORD_HASH,
    expiresAt: Date.now() + 1000 * 60 * 60 * 8,
  };
  return signedCookie(sessionCookie, JSON.stringify(session), 60 * 60 * 8);
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function csrfToken(request) {
  const existing = verifySignedCookie(parseCookies(request)[csrfCookie]);
  return existing || randomBytes(24).toString('base64url');
}

function csrfHeader(token) {
  return signedCookie(csrfCookie, token, 60 * 60 * 8);
}

async function readBody(request, limitBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) throw Object.assign(new Error('Anfrage zu gross'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readForm(request) {
  const body = await readBody(request);
  return new URLSearchParams(body);
}

async function loadSite() {
  const raw = await readFile(dataFile, 'utf8');
  return JSON.parse(raw);
}

async function saveSite(site) {
  validateSite(site);
  await writeFile(dataFile, `${JSON.stringify(site, null, 2)}\n`, 'utf8');
}

function assertText(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${path} darf nicht leer sein`);
}

function assertUrl(value, path) {
  assertText(value, path);
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new Error(`${path} muss eine gueltige HTTP(S)-URL sein`);
  }
}

function validateSite(site) {
  if (!site || typeof site !== 'object' || Array.isArray(site)) throw new Error('JSON-Wurzel muss ein Objekt sein');
  for (const path of ['settings.siteName', 'settings.subtitle', 'settings.claim', 'settings.email', 'settings.phone', 'settings.address', 'pages.heroHeadline', 'pages.heroKicker', 'pages.heroSubline', 'pages.ctaTitle', 'pages.ctaText', 'pages.training', 'pages.contactIntro']) {
    const value = path.split('.').reduce((current, key) => current?.[key], site);
    assertText(value, path);
  }
  if (!String(site.settings.email).includes('@')) throw new Error('settings.email ist ungueltig');
  for (const [name, list] of Object.entries({ areas: site.areas, incidents: site.incidents, team: site.team, equipment: site.equipment, gallery: site.gallery })) {
    if (!Array.isArray(list)) throw new Error(`${name} muss eine Liste sein`);
  }
  for (const [index, incident] of site.incidents.entries()) {
    assertText(incident.id, `incidents[${index}].id`);
    if (!/^[a-z0-9-]+$/.test(incident.id)) throw new Error(`incidents[${index}].id darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten`);
    assertText(incident.title, `incidents[${index}].title`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(incident.date))) throw new Error(`incidents[${index}].date muss YYYY-MM-DD sein`);
    assertUrl(incident.image, `incidents[${index}].image`);
    assertText(incident.description, `incidents[${index}].description`);
  }
  for (const [index, item] of [...site.team.entries()]) assertUrl(item.image, `team[${index}].image`);
  for (const [index, item] of [...site.equipment.entries()]) assertUrl(item.image, `equipment[${index}].image`);
  for (const [index, item] of [...site.gallery.entries()]) assertUrl(item.url, `gallery[${index}].url`);
}

function card(title, text) {
  return `<article class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></article>`;
}

function pageShell(title, body) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{color-scheme:dark;--bg:#08111f;--panel:#102033;--text:#eef5ff;--muted:#b7c4d8;--brand:#ef4444;--line:#26384f}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:linear-gradient(135deg,#08111f,#13243a);color:var(--text);line-height:1.6}a{color:inherit}.wrap{width:min(1120px,92vw);margin:auto}.hero{padding:56px 0 40px}.nav{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:18px 0;border-bottom:1px solid var(--line)}.brand{font-weight:800}.badge,.btn,button{display:inline-block;background:rgba(239,68,68,.18);color:#fecaca;border:1px solid rgba(239,68,68,.45);padding:8px 12px;border-radius:999px;font-size:14px;text-decoration:none}.btn,button{cursor:pointer;background:#ef4444;color:white;font-weight:700}.hero h1{font-size:clamp(44px,10vw,112px);line-height:.9;margin:22px 0 12px}.hero p{max-width:760px;color:var(--muted);font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin:24px 0 44px}.formgrid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}.card{background:rgba(16,32,51,.88);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.18)}.card h3{margin:0 0 8px}.card p{margin:0;color:var(--muted)}.section{padding:20px 0}.section h2{font-size:32px;margin:0 0 16px}.image{width:100%;height:170px;object-fit:cover;border-radius:14px;margin-bottom:12px;background:#17263a}.notice{border-left:4px solid var(--brand);background:rgba(239,68,68,.12);padding:14px 16px;border-radius:12px;margin:18px 0;color:#fee2e2}.footer{border-top:1px solid var(--line);padding:28px 0;margin-top:30px;color:var(--muted)}input,textarea,select{width:100%;border:1px solid var(--line);border-radius:12px;background:#0b1727;color:var(--text);padding:12px;font:inherit}textarea{min-height:420px}.adminbar{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:24px 0}.redtext{color:#fecaca}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function renderPage(site) {
  const settings = site.settings ?? {};
  const pages = site.pages ?? {};
  const areas = safeList(site.areas);
  const incidents = safeList(site.incidents);
  const team = safeList(site.team);
  const equipment = safeList(site.equipment);
  const gallery = safeList(site.gallery);

  return pageShell(`${settings.siteName} – ${settings.subtitle}`, `<nav class="nav"><div class="brand">${escapeHtml(settings.siteName)} · ${escapeHtml(settings.subtitle)}</div><a class="badge" href="/admin">CMS</a></nav><header class="hero"><span class="badge">${escapeHtml(pages.heroKicker)}</span><h1>${escapeHtml(pages.heroHeadline)}</h1><p>${escapeHtml(pages.heroSubline || settings.claim)}</p><div class="notice">32-bit-Windows-Modus aktiv: Oeffentliche Website und Basis-CMS laufen lokal ohne Next.js-SWC. Fuer produktionsnahe Next.js-Features, Build und Deployment weiterhin 64-bit Node.js nutzen.</div></header><section class="section"><h2>Einsatzbereiche</h2><div class="grid">${areas.map((area) => card(area.title, area.text)).join('')}</div></section><section class="section"><h2>Aktuelle Einsaetze</h2><div class="grid">${incidents.map((incident) => `<article class="card"><img class="image" src="${escapeHtml(incident.image)}" alt=""><h3>${escapeHtml(incident.title)}</h3><p>${escapeHtml(incident.date)} · ${escapeHtml(incident.place)}</p><p>${escapeHtml(incident.description)}</p></article>`).join('')}</div></section><section class="section"><h2>Team</h2><div class="grid">${team.map((member) => `<article class="card"><img class="image" src="${escapeHtml(member.image)}" alt=""><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(member.role)} · ${escapeHtml(member.qualification)}</p></article>`).join('')}</div></section><section class="section"><h2>Technik</h2><div class="grid">${equipment.map((item) => `<article class="card"><img class="image" src="${escapeHtml(item.image)}" alt=""><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p></article>`).join('')}</div></section><section class="section"><h2>Galerie</h2><div class="grid">${gallery.map((item) => `<article class="card"><img class="image" src="${escapeHtml(item.url)}" alt=""><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.category)}</p></article>`).join('')}</div></section><footer class="footer"><p>${escapeHtml(settings.address)}</p><p>${escapeHtml(settings.email)} · ${escapeHtml(settings.phone)}</p></footer>`);
}

async function renderAdmin(request, url) {
  const token = csrfToken(request);
  const headers = { 'set-cookie': csrfHeader(token) };
  const session = getSession(request);
  const error = url.searchParams.get('error');
  if (!session) {
    return { headers, body: pageShell('Admin-Login', `<section class="admin"><div class="card" style="max-width:480px;margin:60px auto"><h1>Admin-Login</h1><p>Der 32-bit-Fallback enthaelt jetzt ein schlankes Basis-CMS fuer lokale Inhaltsaenderungen.</p>${error ? '<p class="redtext">Login fehlgeschlagen.</p>' : ''}<form method="post" action="/admin/login"><input type="hidden" name="csrf" value="${escapeHtml(token)}"><p><input name="email" type="email" placeholder="E-Mail" required></p><p><input name="password" type="password" placeholder="Passwort" required></p><button>Einloggen</button></form></div></section>`) };
  }
  const content = await loadSite();
  const saved = url.searchParams.has('saved') ? '<p class="redtext">Gespeichert.</p>' : '';
  const jsonError = error === 'json' ? '<p class="redtext">JSON konnte nicht gespeichert werden. Bitte Struktur, Pflichtfelder und Bild-URLs pruefen.</p>' : '';
  const passwordNote = session.mustChangePassword ? '<div class="notice">Standardpasswort aktiv. Vor Live-Gang ADMIN_PASSWORD_HASH setzen.</div>' : '';
  return { headers, body: pageShell('CMS Backend', `<div class="adminbar"><div><a class="badge" href="/">Website</a> <a class="badge" href="#incidents">Einsaetze</a> <a class="badge" href="#json">Alle Inhalte</a></div><form method="post" action="/admin/logout"><input type="hidden" name="csrf" value="${escapeHtml(token)}"><button>Logout</button></form></div><h1>CMS Backend</h1><p>Angemeldet als ${escapeHtml(session.email)} (${escapeHtml(session.role)}). Inhalte werden direkt in <code>data/site.json</code> gespeichert.</p>${passwordNote}${saved}${jsonError}<div id="incidents" class="card"><h2>Einsatz anlegen</h2><form method="post" action="/admin/incidents" class="grid formgrid"><input type="hidden" name="csrf" value="${escapeHtml(token)}"><input name="title" placeholder="Titel" required><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required><input name="place" placeholder="Ort"><select name="category"><option>Personensuche</option><option>Lageerkundung</option><option>Waermebild</option><option>Dokumentation</option></select><input name="duration" placeholder="Dauer"><input name="image" placeholder="Bild-URL"><textarea name="description" placeholder="Beschreibung"></textarea><button>Speichern</button></form></div><div id="json" class="card" style="margin-top:24px"><h2>Redaktionelle Inhalte bearbeiten</h2><form method="post" action="/admin/json"><input type="hidden" name="csrf" value="${escapeHtml(token)}"><textarea name="json">${escapeHtml(JSON.stringify(content, null, 2))}</textarea><p><button>Alle Inhalte speichern</button></p></form></div>`) };
}

function validateCsrf(request, form) {
  const cookieToken = verifySignedCookie(parseCookies(request)[csrfCookie]);
  const formToken = String(form.get('csrf') || '');
  if (!cookieToken || !formToken || cookieToken !== formToken) throw Object.assign(new Error('CSRF-Pruefung fehlgeschlagen'), { statusCode: 403 });
}

async function requireAdmin(request, response, form) {
  validateCsrf(request, form);
  const session = getSession(request);
  if (!session) {
    redirect(response, '/admin?error=auth');
    return null;
  }
  return session;
}

async function servePublicAsset(request, response) {
  const url = new URL(request.url ?? '/', `http://${displayHost}:${port}`);
  const decoded = decodeURIComponent(url.pathname.replace(/^\/assets\//, ''));
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');

  if (normalized.startsWith('..')) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Ungueltiger Pfad');
    return;
  }

  const filePath = join(publicDir, normalized);
  const body = await readFile(filePath);
  response.writeHead(200, { 'content-type': contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream' });
  response.end(body);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${displayHost}:${port}`);

    if (request.method === 'POST' && url.pathname === '/admin/login') {
      const form = await readForm(request);
      validateCsrf(request, form);
      const email = String(form.get('email') || '').trim();
      const password = String(form.get('password') || '');
      const ok = email.toLowerCase() === adminEmail.toLowerCase() && await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || defaultPasswordHash);
      redirect(response, ok ? '/admin' : '/admin?error=1', ok ? { 'set-cookie': createSessionCookie() } : {});
      return;
    }

    if (request.method === 'POST' && url.pathname === '/admin/logout') {
      const form = await readForm(request);
      validateCsrf(request, form);
      redirect(response, '/admin', { 'set-cookie': clearCookie(sessionCookie) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/admin/json') {
      const form = await readForm(request);
      if (!await requireAdmin(request, response, form)) return;
      try {
        await saveSite(JSON.parse(String(form.get('json') || '')));
        redirect(response, '/admin?saved=1');
      } catch (error) {
        console.error(`JSON-Speicherung abgelehnt: ${error.message}`);
        redirect(response, '/admin?error=json');
      }
      return;
    }

    if (request.method === 'POST' && url.pathname === '/admin/incidents') {
      const form = await readForm(request);
      if (!await requireAdmin(request, response, form)) return;
      const site = await loadSite();
      const title = String(form.get('title') || '').trim();
      if (!title) {
        redirect(response, '/admin?error=title');
        return;
      }
      const idBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `einsatz-${Date.now()}`;
      const existingIds = new Set(site.incidents.map((incident) => incident.id));
      let id = idBase;
      for (let counter = 2; existingIds.has(id); counter += 1) id = `${idBase}-${counter}`;
      site.incidents.unshift({
        id,
        title,
        date: String(form.get('date') || new Date().toISOString().slice(0, 10)),
        place: String(form.get('place') || ''),
        category: String(form.get('category') || 'Lageerkundung'),
        status: 'abgeschlossen',
        duration: String(form.get('duration') || ''),
        image: String(form.get('image') || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'),
        description: String(form.get('description') || ''),
      });
      await saveSite(site);
      redirect(response, '/admin?saved=1');
      return;
    }

    if (request.method !== 'GET') {
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Methode nicht erlaubt');
      return;
    }

    if (url.pathname.startsWith('/assets/')) {
      await servePublicAsset(request, response);
      return;
    }

    if (url.pathname === '/admin') {
      const rendered = await renderAdmin(request, url);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...rendered.headers });
      response.end(rendered.body);
      return;
    }

    const site = await loadSite();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(renderPage(site));
  } catch (error) {
    const status = error?.statusCode || (error?.code === 'ENOENT' ? 404 : 500);
    response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? 'Nicht gefunden' : `Serverfehler: ${error.message}`);
  }
});

server.listen(port, listenHost, () => {
  console.log(`Legacy-Dev-Server laeuft auf http://${displayHost}:${port}`);
  console.log('32-bit-Modus: Oeffentliche Website und Basis-CMS sind lokal verfuegbar; Next.js-Build/Deployment weiterhin auf 64-bit Node.js ausfuehren.');
});
