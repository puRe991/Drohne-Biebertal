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

const navItems = [
  ['/', 'Start'],
  ['/einsaetze', 'Einsaetze'],
  ['/technik', 'Technik'],
  ['/team', 'Team'],
  ['/ausbildung', 'Ausbildung'],
  ['/galerie', 'Galerie'],
  ['/kontakt', 'Kontakt'],
];

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
  } catch {
    return String(value ?? '');
  }
}

function image(src, alt = '') {
  return `<img class="image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
}

function pageShell(title, body, site = null) {
  const settings = site?.settings ?? {};
  const socials = Object.entries(settings.socials ?? {}).map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('');
  const nav = navItems.map(([href, label]) => `<a href="${href}">${label}</a>`).join('');
  const chrome = site ? `<header class="top"><a class="brand" href="/"><div class="crest">⚒</div><div><b>${escapeHtml(settings.siteName)}</b><span>${escapeHtml(settings.subtitle)}</span></div></a><nav>${nav}</nav><a class="emergency" href="tel:112">Notruf<br><b>112</b></a></header>` : '';
  const footer = site ? `<footer class="footer"><div><div class="brand footer-brand"><div class="crest">⚒</div><div><b>${escapeHtml(settings.siteName)}</b><span>${escapeHtml(settings.subtitle)}</span></div></div><p>${escapeHtml(settings.claim)}</p></div><div><h3>Kontakt</h3><p>${escapeHtml(settings.address)}</p><p>${escapeHtml(settings.email)}</p><p>${escapeHtml(settings.phone)}</p></div><div><h3>Folge uns</h3>${socials}</div><div><h3>Wichtige Links</h3><a href="/datenschutz">Datenschutzerklaerung</a><a href="/impressum">Impressum</a><a href="/admin">Admin</a></div><small>© 2026 Freiwillige Feuerwehr Biebertal – Fachgruppe Drohne</small></footer>` : '';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>:root{color-scheme:dark;--bg:#07111f;--panel:#0f1f33;--panel2:#142844;--text:#f4f7fb;--muted:#b7c4d8;--brand:#ef4444;--brand2:#f97316;--line:#27405f}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,Helvetica,sans-serif;background:radial-gradient(circle at 15% 0,#233b5f 0,#07111f 32%,#050914 100%);color:var(--text);line-height:1.6}a{color:inherit;text-decoration:none}.wrap,main{width:min(1180px,92vw);margin:auto}.top{width:min(1180px,92vw);margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 0;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5;background:rgba(7,17,31,.88);backdrop-filter:blur(14px)}.brand{display:flex;align-items:center;gap:12px}.brand b{display:block}.brand span{display:block;color:var(--muted);font-size:14px}.crest{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--brand),var(--brand2));font-weight:900}.top nav{display:flex;flex-wrap:wrap;gap:14px;color:var(--muted)}.top nav a:hover,.redtext{color:#fecaca}.emergency,.badge,.btn,button{display:inline-block;border-radius:999px;border:1px solid rgba(239,68,68,.45);background:rgba(239,68,68,.14);color:#fecaca;padding:8px 13px;font-size:14px}.btn,button{background:#ef4444;color:white;font-weight:800;cursor:pointer}.btn.secondary{background:#142844;color:#fff;border-color:var(--line)}.hero{min-height:58vh;display:grid;align-items:center;padding:70px 0}.hero h1{font-size:clamp(54px,13vw,150px);line-height:.82;margin:22px 0 16px;letter-spacing:-.08em}.hero p{max-width:820px;color:var(--muted);font-size:20px}.grid{display:grid;gap:20px}.cards4{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.cols3{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.formgrid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.card,.cta,.mapbox{background:linear-gradient(180deg,rgba(20,40,68,.96),rgba(12,25,42,.96));border:1px solid var(--line);border-radius:24px;padding:22px;box-shadow:0 22px 70px rgba(0,0,0,.24)}.section{padding:34px 0}.section-title,.section h1,.section h2{font-size:clamp(28px,4vw,44px);line-height:1.05;margin:0 0 18px}.card h3{margin:0 0 8px}.card p{color:var(--muted)}.image,.equip-img{width:100%;height:220px;object-fit:cover;border-radius:18px;background:#17263a}.avatar{width:82px;height:82px;border-radius:50%;object-fit:cover}.incident{display:grid;grid-template-columns:130px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}.incident img{width:130px;height:90px;object-fit:cover;border-radius:14px}.features{padding-left:18px;color:var(--muted)}.mapcta{grid-template-columns:1.35fr .65fr;margin-top:34px}.outline-map{min-height:190px;border:1px dashed #55708f;border-radius:22px;display:grid;place-items:center;text-align:center;color:var(--muted);padding:20px}.notice{border-left:4px solid var(--brand);background:rgba(239,68,68,.12);padding:14px 16px;border-radius:12px;margin:18px 0;color:#fee2e2}.footer{width:min(1180px,92vw);margin:46px auto 0;border-top:1px solid var(--line);padding:30px 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:22px;color:var(--muted)}.footer a{display:block}.footer small{grid-column:1/-1}input,textarea,select{width:100%;border:1px solid var(--line);border-radius:12px;background:#0b1727;color:var(--text);padding:12px;font:inherit}textarea{min-height:420px}.adminbar{display:flex;gap:12px;align-items:center;justify-content:space-between;margin:24px 0}.redtext{color:#fecaca}@media(max-width:760px){.top{position:static;align-items:flex-start;flex-direction:column}.incident{grid-template-columns:1fr}.incident img{width:100%;height:180px}.mapcta{grid-template-columns:1fr}}</style></head><body>${chrome}<main>${body}</main>${footer}</body></html>`;
}

function renderHome(site) {
  const c = site;
  const primaryEquipment = safeList(c.equipment)[0] ?? {};
  return `<section class="hero"><div><div class="badge">${escapeHtml(c.pages.heroKicker)}</div><h1>${escapeHtml(c.pages.heroHeadline)}</h1><p>${escapeHtml(c.pages.heroSubline)}</p><p><a class="btn" href="/technik">Mehr erfahren</a> <a class="btn secondary" href="/einsaetze">Aktuelle Einsaetze</a></p><div class="notice">32-bit-Modus: Diese deploybare Legacy-Runtime rendert Website und CMS ohne Next.js-SWC.</div></div></section><section class="section"><h2 class="section-title">Unsere Einsatzbereiche</h2><div class="grid cards4">${safeList(c.areas).map((a)=>card(a.title,a.text)).join('')}</div></section><section class="section grid cols3"><div class="card"><h2>Aktuelle Einsaetze</h2>${safeList(c.incidents).map(renderIncidentListItem).join('')}<a class="redtext" href="/einsaetze">Alle Einsaetze ansehen →</a></div><div class="card"><h2>Unser Team</h2><div class="grid cards4">${safeList(c.team).map((m)=>`<div>${image(m.image,m.name)}<b>${escapeHtml(m.name)}</b><p>${escapeHtml(m.role)}<br>${escapeHtml(m.qualification)}</p></div>`).join('')}</div><a class="redtext" href="/team">Mehr ueber unser Team →</a></div><div class="card"><h2>Unsere Technik</h2>${image(primaryEquipment.image,primaryEquipment.name)}<h3>${escapeHtml(primaryEquipment.name)}</h3><ul class="features">${safeList(primaryEquipment.features).map((f)=>`<li>${escapeHtml(f)}</li>`).join('')}</ul><a class="redtext" href="/technik">Gesamte Ausruestung ansehen →</a></div></section><section class="section grid mapcta"><div class="mapbox"><h2>Einsatzgebiet Biebertal</h2><div class="outline-map">Krumbach · Frankenbach · Rodheim-Bieber · Fellingshausen · Vetzberg</div></div><div class="cta"><h2>${escapeHtml(c.pages.ctaTitle)}</h2><p>${escapeHtml(c.pages.ctaText)}</p><h3>Komm in unser Team!</h3><a class="btn" href="/kontakt">Jetzt mitmachen</a></div></section>`;
}

function renderIncidentListItem(incident) {
  return `<a class="incident" href="/einsaetze/${escapeHtml(incident.id)}">${image(incident.image, incident.title)}<div><span class="badge">${escapeHtml(incident.category || 'Einsatz')}</span><small style="float:right">${escapeHtml(formatDate(incident.date))}</small><b style="display:block">${escapeHtml(incident.title)}</b><span>${escapeHtml(incident.place)}</span><p>${escapeHtml(incident.description)}</p></div></a>`;
}

function renderCollection(title, items, renderer) {
  return `<section class="section"><h1>${escapeHtml(title)}</h1><div class="grid cards4">${safeList(items).map(renderer).join('')}</div></section>`;
}

function renderRoute(site, pathname) {
  if (pathname === '/') return pageShell(`${site.settings.siteName} – ${site.settings.subtitle}`, renderHome(site), site);
  if (pathname === '/einsaetze') return pageShell('Einsaetze', renderCollection('Einsaetze', site.incidents, (i)=>`<article class="card">${image(i.image,i.title)}<h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(formatDate(i.date))} · ${escapeHtml(i.place)}</p><p>${escapeHtml(i.description)}</p><a class="redtext" href="/einsaetze/${escapeHtml(i.id)}">Details →</a></article>`), site);
  if (pathname.startsWith('/einsaetze/')) {
    const id = decodeURIComponent(pathname.split('/').pop() || '');
    const incident = safeList(site.incidents).find((item) => item.id === id);
    if (!incident) return null;
    return pageShell(incident.title, `<section class="section"><a class="redtext" href="/einsaetze">← Zurueck</a><h1>${escapeHtml(incident.title)}</h1>${image(incident.image,incident.title)}<p><b>${escapeHtml(formatDate(incident.date))}</b> · ${escapeHtml(incident.place)} · ${escapeHtml(incident.duration)}</p><p>${escapeHtml(incident.description)}</p></section>`, site);
  }
  if (pathname === '/technik') return pageShell('Technik', renderCollection('Technik', site.equipment, (e)=>`<article class="card">${image(e.image,e.name)}<h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.description)}</p><ul class="features">${safeList(e.features).map((f)=>`<li>${escapeHtml(f)}</li>`).join('')}</ul></article>`), site);
  if (pathname === '/team') return pageShell('Team', renderCollection('Team', site.team, (m)=>`<article class="card">${image(m.image,m.name)}<h3>${escapeHtml(m.name)}</h3><p>${escapeHtml(m.role)}<br>${escapeHtml(m.qualification)}</p></article>`), site);
  if (pathname === '/galerie') return pageShell('Galerie', renderCollection('Galerie', site.gallery, (g)=>`<article class="card">${image(g.url,g.title)}<h3>${escapeHtml(g.title)}</h3><p>${escapeHtml(g.category)}</p></article>`), site);
  if (pathname === '/ausbildung') return pageShell('Ausbildung', `<section class="section"><h1>Ausbildung</h1><div class="card"><p>${escapeHtml(site.pages.training)}</p></div></section>`, site);
  if (pathname === '/kontakt') return pageShell('Kontakt', `<section class="section"><h1>Kontakt</h1><div class="card"><p>${escapeHtml(site.pages.contactIntro)}</p><p><b>E-Mail:</b> ${escapeHtml(site.settings.email)}<br><b>Telefon:</b> ${escapeHtml(site.settings.phone)}<br><b>Adresse:</b> ${escapeHtml(site.settings.address)}</p></div></section>`, site);
  if (pathname === '/impressum') return pageShell('Impressum', `<section class="section"><h1>Impressum</h1><div class="card"><p>${escapeHtml(site.settings.address)}</p><p>${escapeHtml(site.settings.email)} · ${escapeHtml(site.settings.phone)}</p><p class="notice">Platzhalter: Vor Live-Gang rechtlich pruefen.</p></div></section>`, site);
  if (pathname === '/datenschutz') return pageShell('Datenschutz', `<section class="section"><h1>Datenschutzerklaerung</h1><div class="card"><p>Diese Prototyp-Seite speichert redaktionelle Inhalte lokal und nutzt ein technisch notwendiges Admin-Session-Cookie.</p><p class="notice">Platzhalter: Vor Live-Gang rechtlich pruefen.</p></div></section>`, site);
  return null;
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
    const rendered = renderRoute(site, url.pathname);
    if (!rendered) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Nicht gefunden');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(rendered);
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
