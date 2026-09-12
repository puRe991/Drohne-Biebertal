import type { SiteContent } from "./content.ts";
import { appVersion, type Env } from "./env.ts";
import { e, safeUrl } from "./html.ts";

const NAV: [string, string][] = [
  ["/", "Start"],
  ["/einsaetze", "Einsätze"],
  ["/technik", "Technik"],
  ["/team", "Team"],
  ["/ausbildung", "Ausbildung"],
  ["/galerie", "Galerie"],
  ["/kontakt", "Kontakt"],
];

/** Cache-Buster, damit Cloudflare nach einem Deploy nicht das alte Stylesheet hält. */
export function asset(env: Env, path: string): string {
  return `/${path.replace(/^\/+/, "")}?v=${encodeURIComponent(appVersion(env))}`;
}

export function renderHeader(env: Env, c: SiteContent, title = ""): string {
  const brand = `<div class="crest">112</div><div><b>${e(c.settings.siteName)}</b><span>${e(c.settings.subtitle)}</span></div>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${e(title ? `${title} – ` : "")}${e(c.settings.siteName)} · ${e(c.settings.subtitle)}</title>` +
    `<meta name="description" content="${e(c.settings.claim)}">` +
    `<link rel="stylesheet" href="${e(asset(env, "styles.css"))}"></head><body>` +
    `<header class="top"><a class="brand" href="/">${brand}</a><nav>` +
    NAV.map(([href, label]) => `<a href="${e(href)}">${e(label)}</a>`).join("") +
    `</nav><a class="emergency" href="tel:112">☎ Notruf<br><b>112</b></a></header>`;
}

export function renderFooter(c: SiteContent): string {
  const socials = Object.entries(c.settings.socials ?? {})
    .map(([name, href]) => {
      const url = safeUrl(href);
      return url === "" ? `<span>${e(name)}</span>` : `<a href="${url}">${e(name)}</a>`;
    })
    .join("");

  return `<footer class="footer"><div><div class="brand footer-brand"><div class="crest">112</div>` +
    `<div><b>${e(c.settings.siteName)}</b><span>${e(c.settings.subtitle)}</span></div></div>` +
    `<p>${e(c.settings.claim)}</p></div>` +
    `<div><h3>Kontakt</h3><p>${e(c.settings.address)}</p><p>${e(c.settings.email)}</p><p>${e(c.settings.phone)}</p></div>` +
    `<div><h3>Folge uns</h3>${socials}</div>` +
    `<div><h3>Wichtige Links</h3><a href="/datenschutz">Datenschutzerklärung</a><a href="/impressum">Impressum</a>` +
    `<a href="https://www.feuerwehr-biebertal.de">Feuerwehr Biebertal</a>` +
    `<a href="#">Kreisfeuerwehrverband Gießen</a><a href="#">Hessische Feuerwehr</a></div>` +
    `<small>© ${new Date().getFullYear()} Freiwillige Feuerwehr Biebertal – Fachgruppe Drohne</small></footer></body></html>`;
}

export function pageHero(title: string, text = ""): string {
  return `<div class="page-hero"><h1>${e(title)}</h1>${text ? `<p>${e(text)}</p>` : ""}</div>`;
}

export function imgTag(src: unknown, className: string, alt = ""): string {
  const url = safeUrl(src);
  if (url === "") return "";
  return `<img class="${e(className)}" src="${url}" alt="${e(alt)}" loading="lazy">`;
}
