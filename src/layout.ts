import type { SiteContent } from "./content.ts";
import { appVersion, type Env } from "./env.ts";
import { e, safeUrl } from "./html.ts";

const NAV: [string, string][] = [
  ["/", "Start"],
  ["/news", "News"],
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

/**
 * Das offizielle Logo trägt den Schriftzug bereits, deshalb steht daneben nur noch
 * der Zusatz der Fachgruppe. Die weisse Fläche bleibt: das Logorot hat auf dem
 * dunklen Header nur 2,6:1 Kontrast, auf Weiss dagegen 7,2:1 - und eine Umfärbung
 * des Vereinslogos kommt nicht in Frage.
 */
function brandMark(env: Env, c: SiteContent): string {
  return `<span class="logo-plate"><img class="logo" src="${e(asset(env, "logo-feuerwehr-biebertal.png"))}" ` +
    `alt="${e(c.settings.siteName)}" width="911" height="263"></span>` +
    `<span class="brand-sub">${e(c.settings.subtitle)}</span>`;
}

export function renderHeader(env: Env, c: SiteContent, title = ""): string {
  const brand = brandMark(env, c);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${e(title ? `${title} – ` : "")}${e(c.settings.siteName)} · ${e(c.settings.subtitle)}</title>` +
    `<meta name="description" content="${e(c.settings.claim)}">` +
    `<link rel="stylesheet" href="${e(asset(env, "styles.css"))}"></head><body>` +
    `<header class="top"><a class="brand" href="/">${brand}</a><nav>` +
    NAV.map(([href, label]) => `<a href="${e(href)}">${e(label)}</a>`).join("") +
    `</nav><a class="emergency" href="tel:112">☎ Notruf<br><b>112</b></a></header>`;
}

export function renderFooter(env: Env, c: SiteContent): string {
  const socials = Object.entries(c.settings.socials ?? {})
    .map(([name, href]) => {
      const url = safeUrl(href);
      return url === "" ? `<span>${e(name)}</span>` : `<a href="${url}" rel="noopener noreferrer">${e(name)}</a>`;
    })
    .join("");

  return `<footer class="footer"><div><div class="brand footer-brand">${brandMark(env, c)}</div>` +
    `<p>${e(c.settings.claim)}</p></div>` +
    `<div><h3>Kontakt</h3><p>${e(c.settings.address)}</p><p>${e(c.settings.email)}</p><p>${e(c.settings.phone)}</p></div>` +
    `<div><h3>Folge uns</h3>${socials}</div>` +
    // Nur erreichbare, geprüfte Ziele - keine toten "#"-Links.
    `<div><h3>Wichtige Links</h3><a href="/datenschutz">Datenschutzerklärung</a><a href="/impressum">Impressum</a>` +
    `<a href="https://www.feuerwehr-biebertal.de/" rel="noopener noreferrer">Feuerwehr Biebertal</a>` +
    `<a href="https://www.feuerwehr-hessen.de/" rel="noopener noreferrer">Landesfeuerwehrverband Hessen</a></div>` +
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
