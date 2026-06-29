import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const dataFile = join(rootDir, 'data', 'site.json');
const publicDir = join(rootDir, 'public');
const port = Number(process.env.PORT || 3000);
const listenHost = process.env.DEV_HOST || '0.0.0.0';
const displayHost = listenHost === '0.0.0.0' ? 'localhost' : listenHost;

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

async function loadSite() {
  const raw = await readFile(dataFile, 'utf8');
  return JSON.parse(raw);
}

function card(title, text) {
  return `<article class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></article>`;
}

function renderPage(site) {
  const settings = site.settings ?? {};
  const pages = site.pages ?? {};
  const areas = safeList(site.areas);
  const incidents = safeList(site.incidents);
  const team = safeList(site.team);
  const equipment = safeList(site.equipment);
  const gallery = safeList(site.gallery);

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(settings.siteName)} – ${escapeHtml(settings.subtitle)}</title>
  <style>
    :root{color-scheme:dark;--bg:#08111f;--panel:#102033;--text:#eef5ff;--muted:#b7c4d8;--brand:#ef4444;--line:#26384f}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:linear-gradient(135deg,#08111f,#13243a);color:var(--text);line-height:1.6}a{color:inherit}.wrap{width:min(1120px,92vw);margin:auto}.hero{padding:56px 0 40px}.nav{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:18px 0;border-bottom:1px solid var(--line)}.brand{font-weight:800}.badge{display:inline-block;background:rgba(239,68,68,.18);color:#fecaca;border:1px solid rgba(239,68,68,.45);padding:6px 10px;border-radius:999px;font-size:14px}.hero h1{font-size:clamp(44px,10vw,112px);line-height:.9;margin:22px 0 12px}.hero p{max-width:760px;color:var(--muted);font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin:24px 0 44px}.card{background:rgba(16,32,51,.88);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:0 18px 50px rgba(0,0,0,.18)}.card h3{margin:0 0 8px}.card p{margin:0;color:var(--muted)}.section{padding:20px 0}.section h2{font-size:32px;margin:0 0 16px}.image{width:100%;height:170px;object-fit:cover;border-radius:14px;margin-bottom:12px;background:#17263a}.notice{border-left:4px solid var(--brand);background:rgba(239,68,68,.12);padding:14px 16px;border-radius:12px;margin:18px 0;color:#fee2e2}.footer{border-top:1px solid var(--line);padding:28px 0;margin-top:30px;color:var(--muted)}
  </style>
</head>
<body>
  <div class="wrap">
    <nav class="nav"><div class="brand">${escapeHtml(settings.siteName)} · ${escapeHtml(settings.subtitle)}</div><span class="badge">Legacy 32-bit Dev</span></nav>
    <header class="hero"><span class="badge">${escapeHtml(pages.heroKicker)}</span><h1>${escapeHtml(pages.heroHeadline)}</h1><p>${escapeHtml(pages.heroSubline || settings.claim)}</p><div class="notice">Dieser Server ist der 32-bit-Windows-Fallback fuer lokale Vorschau. Das CMS unter <code>/admin</code> benoetigt weiterhin die regulaere Next.js-Umgebung auf 64-bit Node.js oder Deployment.</div></header>
    <section class="section"><h2>Einsatzbereiche</h2><div class="grid">${areas.map((area) => card(area.title, area.text)).join('')}</div></section>
    <section class="section"><h2>Aktuelle Einsaetze</h2><div class="grid">${incidents.map((incident) => `<article class="card"><img class="image" src="${escapeHtml(incident.image)}" alt=""><h3>${escapeHtml(incident.title)}</h3><p>${escapeHtml(incident.date)} · ${escapeHtml(incident.place)}</p><p>${escapeHtml(incident.description)}</p></article>`).join('')}</div></section>
    <section class="section"><h2>Team</h2><div class="grid">${team.map((member) => `<article class="card"><img class="image" src="${escapeHtml(member.image)}" alt=""><h3>${escapeHtml(member.name)}</h3><p>${escapeHtml(member.role)} · ${escapeHtml(member.qualification)}</p></article>`).join('')}</div></section>
    <section class="section"><h2>Technik</h2><div class="grid">${equipment.map((item) => `<article class="card"><img class="image" src="${escapeHtml(item.image)}" alt=""><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p></article>`).join('')}</div></section>
    <section class="section"><h2>Galerie</h2><div class="grid">${gallery.map((item) => `<article class="card"><img class="image" src="${escapeHtml(item.url)}" alt=""><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.category)}</p></article>`).join('')}</div></section>
    <footer class="footer"><p>${escapeHtml(settings.address)}</p><p>${escapeHtml(settings.email)} · ${escapeHtml(settings.phone)}</p></footer>
  </div>
</body>
</html>`;
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

    if (url.pathname.startsWith('/assets/')) {
      await servePublicAsset(request, response);
      return;
    }

    if (url.pathname === '/admin') {
      response.writeHead(503, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<h1>CMS im 32-bit-Fallback nicht verfuegbar</h1><p>Bitte 64-bit Node.js, WSL, Docker oder das Deployment fuer das CMS nutzen.</p>');
      return;
    }

    const site = await loadSite();
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(renderPage(site));
  } catch (error) {
    const status = error?.code === 'ENOENT' ? 404 : 500;
    response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? 'Nicht gefunden' : `Serverfehler: ${error.message}`);
  }
});

server.listen(port, listenHost, () => {
  console.log(`Legacy-Dev-Server laeuft auf http://${displayHost}:${port}`);
  console.log('Hinweis: Oeffentliche Vorschau ja, CMS/Next.js-Funktionen nein.');
});
