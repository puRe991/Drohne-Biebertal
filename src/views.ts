import type { SiteContent } from "./content.ts";
import { e, formatDate } from "./html.ts";
import { imgTag, pageHero } from "./layout.ts";

export function home(c: SiteContent): string {
  const primary = c.equipment[0];
  const areas = c.areas
    .map(
      (a) =>
        `<article class="card area"><div class="area-icon area-icon-${e(a.icon ?? "search")}" aria-hidden="true"></div>` +
        `<div><h3>${e(a.title)}</h3><p>${e(a.text)}</p></div></article>`,
    )
    .join("");

  const incidentCards = c.incidents
    .map(
      (i) =>
        `<a class="incident" href="/einsaetze/${e(i.id)}">${imgTag(i.image, "")}` +
        `<div><span class="badge">EINSATZ</span><small style="float:right">${e(formatDate(i.date))}</small>` +
        `<b style="display:block">${e(i.title)}</b><span>${e(i.place)}</span><p>${e(i.description)}</p></div></a>`,
    )
    .join("");

  const teamCards = c.team
    .map(
      (m) =>
        `<div>${imgTag(m.image, "avatar", m.name)}<b>${e(m.name)}</b>` +
        `<p>${e(m.role)}<br>${e(m.qualification)}</p></div>`,
    )
    .join("");

  const equipmentCard = primary
    ? `${imgTag(primary.image, "equip-img", primary.name)}<h3>${e(primary.name)}</h3>` +
      `<ul class="features">${primary.features.map((f) => `<li>${e(f)}</li>`).join("")}</ul>`
    : "<p>Noch keine Technik erfasst.</p>";

  return (
    `<section class="hero"><div><div class="kicker">${e(c.pages.heroKicker)}</div>` +
    `<h1>${e(c.pages.heroHeadline)}</h1><p>${e(c.pages.heroSubline)}</p>` +
    `<p><a class="btn red" href="/technik">Mehr erfahren</a> <a class="btn" href="/einsaetze">Aktuelle Einsätze</a></p>` +
    `</div></section>` +
    `<section class="wrap"><h2 class="section-title">Unsere Einsatzbereiche</h2>` +
    `<div class="grid cards4">${areas}</div></section>` +
    `<section class="wrap grid cols3">` +
    `<div class="card"><h2 class="section-title">Aktuelle Einsätze</h2>${incidentCards}` +
    `<a class="redtext" href="/einsaetze">Alle Einsätze ansehen →</a></div>` +
    `<div class="card"><h2 class="section-title">Unser Team</h2><div class="grid teamgrid">${teamCards}</div>` +
    `<a class="redtext" href="/team">Mehr über unser Team →</a></div>` +
    `<div class="card"><h2 class="section-title">Unsere Technik</h2>${equipmentCard}` +
    `<a class="redtext" href="/technik">Gesamte Ausrüstung ansehen →</a></div></section>` +
    `<section class="wrap grid mapcta"><div class="mapbox"><h2 class="section-title">Einsatzgebiet Biebertal</h2>` +
    `<div class="outline-map"><span>Krumbach</span><span>Frankenbach</span><span>Rodheim-Bieber</span>` +
    `<span>Fellingshausen</span><span>Vetzberg</span></div>` +
    `<p>Wir sind für das gesamte Gemeindegebiet Biebertal im Einsatz – schnell, zuverlässig und aus der Luft.</p>` +
    `<a class="btn map-btn" href="/kontakt">Gebiet auf Karte ansehen</a></div>` +
    `<div class="cta"><h2>${e(c.pages.ctaTitle)}</h2><p>${e(c.pages.ctaText)}</p><h3>Komm in unser Team!</h3>` +
    `<a class="btn" href="/kontakt">Jetzt mitmachen</a> <a class="btn cta-outline" href="/kontakt">Kontakt aufnehmen</a>` +
    `</div></section>`
  );
}

export function incidents(c: SiteContent): string {
  const list = c.incidents
    .map(
      (i) =>
        `<article class="card incident">${imgTag(i.image, "")}<div><span class="badge">${e(i.category)}</span>` +
        `<h2><a href="/einsaetze/${e(i.id)}">${e(i.title)}</a></h2>` +
        `<p><b>${e(formatDate(i.date))}</b> · ${e(i.place)} · ${e(i.status)}</p><p>${e(i.description)}</p></div></article>`,
    )
    .join("");
  return pageHero("Einsätze", "Übersicht der dokumentierten Einsätze und Übungen.") +
    `<section class="wrap list">${list}</section>`;
}

export function incidentDetail(c: SiteContent, id: string): string | null {
  const incident = c.incidents.find((entry) => entry.id === id);
  if (!incident) return null;

  return (
    pageHero(incident.title, `${formatDate(incident.date)} · ${incident.place}`) +
    `<section class="wrap card">${imgTag(incident.image, "equip-img")}` +
    `<p><span class="badge">${e(incident.category)}</span> Status: ${e(incident.status)}` +
    `${incident.duration ? ` · Dauer: ${e(incident.duration)}` : ""}</p>` +
    `<p>${e(incident.description)}</p>` +
    `<p><a class="redtext" href="/einsaetze">← Alle Einsätze</a></p></section>`
  );
}

export function equipment(c: SiteContent): string {
  const cards = c.equipment
    .map(
      (item) =>
        `<article class="card">${imgTag(item.image, "equip-img", item.name)}<h2>${e(item.name)}</h2>` +
        `<p>${e(item.description)}</p>` +
        `<ul class="features">${item.features.map((f) => `<li>${e(f)}</li>`).join("")}</ul></article>`,
    )
    .join("");
  return pageHero("Technik", "Drohnen, Sensorik und Zubehör der Fachgruppe.") +
    `<section class="wrap grid cards4">${cards}</section>`;
}

export function team(c: SiteContent): string {
  const members = [...c.team].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const cards = members
    .map(
      (m) =>
        `<article class="card" style="text-align:center">${imgTag(m.image, "avatar", m.name)}` +
        `<h2>${e(m.name)}</h2><p>${e(m.role)}<br>${e(m.qualification)}</p></article>`,
    )
    .join("");
  return pageHero("Team", "Platzhalterdaten – Veröffentlichung nur mit Einwilligung.") +
    `<section class="wrap grid cards4">${cards}</section>`;
}

export function training(c: SiteContent): string {
  return pageHero("Ausbildung") +
    `<section class="wrap card"><p>${e(c.pages.training)}</p><ul class="features">` +
    `<li>Luftrecht und Datenschutz</li><li>Flugpraxis und Notverfahren</li>` +
    `<li>Wärmebildauswertung</li><li>Einsatzdokumentation</li></ul></section>`;
}

export function gallery(c: SiteContent): string {
  const cards = c.gallery
    .map(
      (g) =>
        `<article class="card">${imgTag(g.url, "", g.title)}<h2>${e(g.title)}</h2><p>${e(g.category)}</p></article>`,
    )
    .join("");
  return pageHero("Galerie") + `<section class="wrap grid cards4 gallery">${cards}</section>`;
}

export function contact(c: SiteContent): string {
  return (
    pageHero("Kontakt", c.pages.contactIntro) +
    `<section class="wrap grid mapcta">` +
    `<form class="card"><input placeholder="Name"><input placeholder="E-Mail"><textarea placeholder="Nachricht"></textarea>` +
    `<button class="btn red" type="button">Absenden (Demo)</button></form>` +
    `<div class="card"><h2>Kontaktdaten</h2><p>${e(c.settings.address)}</p>` +
    `<p><a href="mailto:${e(c.settings.email)}">${e(c.settings.email)}</a></p>` +
    `<p><a href="tel:${e(c.settings.phone.replace(/[^+0-9]/g, ""))}">${e(c.settings.phone)}</a></p>` +
    `<div class="mapbox">Karte / Anfahrt (TODO)</div></div></section>`
  );
}

export function legalPage(title: string, text: string): string {
  return pageHero(title) + `<section class="wrap card"><p><b>TODO:</b> ${e(text)}</p></section>`;
}

export function notFound(): string {
  return pageHero("Nicht gefunden") +
    `<section class="wrap card"><p>Diese Seite existiert nicht.</p>` +
    `<p><a class="btn red" href="/">Zur Startseite</a></p></section>`;
}
