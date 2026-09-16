import {
  incidentNumbers,
  incidentsInYear,
  incidentYears,
  sortedNews,
  type Incident,
  type SiteContent,
  type YearlyStat,
} from "./content.ts";
import { e, formatDate, initials, safeUrl } from "./html.ts";
import { imgTag, pageHero } from "./layout.ts";

/** Foto wenn vorhanden, sonst Initialen. */
function personAvatar(member: { name: string; image?: string }): string {
  const photo = imgTag(member.image, "avatar", member.name);
  return photo !== "" ? photo : `<div class="avatar-initials" aria-hidden="true">${e(initials(member.name))}</div>`;
}

/** Rolle und - falls vorhanden - Zusatzqualifikation. */
function personRole(member: { role: string; qualification?: string }): string {
  const qualification = (member.qualification ?? "").trim();
  return e(member.role) + (qualification !== "" ? `<br>${e(qualification)}` : "");
}

/** Status als sprechendes Kürzel für die Ticker-Badge. */
function tickerStatusLabel(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === "" || normalized === "abgeschlossen") return "Beendet";
  if (normalized === "laufend" || normalized === "im einsatz") return "Läuft";
  return status;
}

/** Eine Zeile im Einsatzticker: Status-Punkt, Einsatznummer, Zeit/Ort, Titel, Kategorie. */
function tickerRow(i: Incident, numbers: Map<string, string>): string {
  const status = tickerStatusLabel(i.status);
  const live = status === "Läuft";
  const number = numbers.get(i.id);
  return (
    `<a class="ticker-row${live ? " ticker-row-live" : ""}" href="/einsaetze/${e(i.id)}">` +
    `<span class="ticker-dot" aria-hidden="true"></span>` +
    `<span class="ticker-main">` +
    `<span class="ticker-meta">${number ? `<span class="ticker-number">Einsatz ${e(number)}</span> · ` : ""}` +
    `<b>${e(formatDate(i.date))}</b> · ${e(i.place)}` +
    `<span class="ticker-status ${live ? "ticker-status-live" : ""}">${e(status)}</span></span>` +
    `<span class="ticker-title">${e(i.title)}</span>` +
    `</span><span class="badge ticker-badge">${e(i.category)}</span></a>`
  );
}

/** Ein Ticker-Panel mit Überschrift, Live-Indikator und bis zu `limit` Zeilen. */
function tickerPanel(
  title: string,
  subtitle: string,
  items: Incident[],
  numbers: Map<string, string>,
  emptyText: string,
  limit = 5,
): string {
  const rows = items.length === 0
    ? `<p class="news-empty">${e(emptyText)}</p>`
    : items.slice(0, limit).map((i) => tickerRow(i, numbers)).join("");
  return (
    `<div class="ticker-panel"><div class="ticker-head">` +
    `<span class="ticker-live-dot" aria-hidden="true"></span>` +
    `<div><h3>${e(title)}</h3><p>${e(subtitle)}</p></div></div>` +
    `<div class="ticker-list">${rows}</div></div>`
  );
}

export function home(c: SiteContent): string {
  const primary = c.equipment[0];
  const areas = c.areas
    .map(
      (a) =>
        `<article class="card area"><div class="area-icon area-icon-${e(a.icon ?? "search")}" aria-hidden="true"></div>` +
        `<div><h3>${e(a.title)}</h3><p>${e(a.text)}</p></div></article>`,
    )
    .join("");

  const teamCards = sortedTeam(c)
    .map((m) => `<div>${personAvatar(m)}<b>${e(m.name)}</b><p>${personRole(m)}</p></div>`)
    .join("");

  const equipmentCard = primary
    ? `${imgTag(primary.image, "equip-img", primary.name)}<h3>${e(primary.name)}</h3>` +
      `<ul class="features">${primary.features.map((f) => `<li>${e(f)}</li>`).join("")}</ul>`
    : "<p>Noch keine Technik erfasst.</p>";

  const currentYear = new Date().getUTCFullYear();
  const numbers = incidentNumbers(c);
  const currentYearIncidents = incidentsInYear(c, currentYear);
  const currentYearDrone = currentYearIncidents.filter((i) => i.unit === "drohne");
  const olderYears = incidentYears(c).filter((year) => year !== currentYear);

  const einsatzticker =
    `<section class="wrap"><h2 class="section-title">Einsatzticker ${currentYear}</h2>` +
    `<div class="grid ticker-grid">` +
    tickerPanel(
      "Feuerwehr Biebertal",
      `Einsätze ${currentYear}`,
      currentYearIncidents,
      numbers,
      "In diesem Jahr sind noch keine Einsätze veröffentlicht.",
    ) +
    tickerPanel(
      "Fachgruppe Drohne",
      `Drohneneinsätze ${currentYear}`,
      currentYearDrone,
      numbers,
      "Die Drohne war dieses Jahr noch bei keinem veröffentlichten Einsatz im Einsatz.",
    ) +
    `</div><p><a class="redtext" href="/einsaetze">Alle Einsätze ansehen →</a>` +
    (olderYears.length > 0 ? ` <a class="redtext" href="/einsaetze#archiv">Archiv ${olderYears[olderYears.length - 1]}–${olderYears[0]} →</a>` : "") +
    `</p></section>`;

  const latestNews = sortedNews(c).slice(0, 3);
  const newsTeaser = latestNews.length === 0
    ? ""
    : `<section class="wrap"><h2 class="section-title">Aktuelles</h2><div class="card">` +
      latestNews
        .map(
          (n) =>
            `<article class="news-item"><div class="news-date">${e(formatDate(n.date))}</div>` +
            `<h3><a href="/news/${e(n.id)}">${e(n.title)}</a></h3>` +
            `<p>${e(excerpt(n.text, 140))}</p></article>`,
        )
        .join("") +
      `<p><a class="redtext" href="/news">Alle Meldungen ansehen →</a></p></div></section>`;

  return (
    `<section class="hero"><div><div class="kicker">${e(c.pages.heroKicker)}</div>` +
    `<h1>${e(c.pages.heroHeadline)}</h1><p>${e(c.pages.heroSubline)}</p>` +
    `<p><a class="btn red" href="/technik">Mehr erfahren</a> <a class="btn" href="/einsaetze">Aktuelle Einsätze</a></p>` +
    `</div></section>` +
    einsatzticker +
    `<section class="wrap"><h2 class="section-title">Unsere Einsatzbereiche</h2>` +
    `<div class="grid cards4">${areas}</div></section>` +
    newsTeaser +
    `<section class="wrap grid cards4">` +
    `<div class="card"><h2 class="section-title">Unser Team</h2><div class="grid teamgrid">${teamCards}</div>` +
    `<a class="redtext" href="/team">Mehr über unser Team →</a></div>` +
    `<div class="card"><h2 class="section-title">Unsere Technik</h2>${equipmentCard}` +
    `<a class="redtext" href="/technik">Gesamte Ausrüstung ansehen →</a></div></section>` +
    `<section class="wrap grid mapcta"><div class="mapbox"><h2 class="section-title">Einsatzgebiet Biebertal</h2>` +
    `<div class="outline-map"><span>Fellingshausen</span><span>Frankenbach</span><span>Königsberg</span>` +
    `<span>Krumbach</span><span>Rodheim-Bieber</span><span>Vetzberg</span></div>` +
    `<p>Rund 44 Quadratkilometer, sechs Ortsteile und mit dem Krofdorfer Forst eines der ` +
    `größten zusammenhängenden Waldgebiete Hessens – aus der Luft schneller überschaubar.</p>` +
    `<a class="btn map-btn" href="/kontakt">Gebiet auf Karte ansehen</a></div>` +
    `<div class="cta"><h2>${e(c.pages.ctaTitle)}</h2><p>${e(c.pages.ctaText)}</p><h3>Komm in unser Team!</h3>` +
    `<a class="btn" href="/kontakt">Jetzt mitmachen</a> <a class="btn cta-outline" href="/kontakt">Kontakt aufnehmen</a>` +
    `</div></section>`
  );
}

/** Eine Einsatzkarte für die Listenansicht, inklusive laufender Einsatznummer des Jahres. */
function incidentCard(i: Incident, numbers: Map<string, string>): string {
  const number = numbers.get(i.id);
  return (
    `<article class="card incident">${imgTag(i.image, "")}<div>` +
    (number ? `<span class="badge badge-number">Einsatz ${e(number)}</span> ` : "") +
    `<span class="badge">${e(i.category)}</span>` +
    (i.unit === "drohne" ? ` <span class="badge badge-drone">DROHNE IM EINSATZ</span>` : "") +
    `<h2><a href="/einsaetze/${e(i.id)}">${e(i.title)}</a></h2>` +
    `<p><b>${e(formatDate(i.date))}</b> · ${e(i.place)} · ${e(i.status)}</p><p>${e(i.description)}</p></div></article>`
  );
}

/** Amtliche Jahresstatistik als Tabelle, mit Beleglink wo vorhanden. */
function yearlyStatsTable(stats: YearlyStat[]): string {
  if (stats.length === 0) return "";
  const rows = [...stats]
    .sort((a, b) => b.year - a.year)
    .map((s) => {
      const sourceUrl = safeUrl(s.source);
      const sourceLink = sourceUrl !== "" ? ` <a class="redtext" href="${sourceUrl}" rel="noopener noreferrer" target="_blank">Quelle</a>` : "";
      return `<tr><td><b>${e(String(s.year))}</b></td><td>${e(String(s.total))} Einsätze</td>` +
        `<td>${e(s.note ?? "")}${sourceLink}</td></tr>`;
    })
    .join("");
  return (
    `<div class="card" style="margin-top:24px"><h2 class="section-title">Amtliche Jahresstatistik</h2>` +
    `<p class="news-empty">Gesamtzahlen der Freiwilligen Feuerwehr Biebertal aus Presseberichten zu den ` +
    `Jahreshauptversammlungen - nicht die einzelnen, unten gelisteten Einsatzberichte dieser Seite.</p>` +
    `<table class="stats-table"><tbody>${rows}</tbody></table></div>`
  );
}

export function incidents(c: SiteContent): string {
  const statsBlock = yearlyStatsTable(c.yearlyStats);

  if (c.incidents.length === 0) {
    return pageHero("Einsätze", "Dokumentierte Einsätze und Übungen der Fachgruppe.") +
      `<section class="wrap card"><p class="news-empty">Hier sind noch keine Einsätze ` +
      `veröffentlicht. Aktuelle Einsatzberichte der Feuerwehr Biebertal erscheinen zeitnah ` +
      `über den Instagram- und den WhatsApp-Kanal.</p>` +
      `<p><a class="redtext" href="https://www.feuerwehr-biebertal.de/">Zur Feuerwehr Biebertal →</a></p>` +
      statsBlock +
      `</section>`;
  }

  const currentYear = new Date().getUTCFullYear();
  const numbers = incidentNumbers(c);
  const years = incidentYears(c);
  const current = incidentsInYear(c, currentYear).map((i) => incidentCard(i, numbers)).join("");
  const archiveYears = years.filter((year) => year !== currentYear);

  const archive = archiveYears.length === 0
    ? ""
    : `<div id="archiv"><h2 class="section-title" style="margin-top:32px">Archiv</h2>` +
      archiveYears
        .map(
          (year) =>
            `<details class="archive-year"><summary>${year} ` +
            `<span class="archive-count">(${incidentsInYear(c, year).length} Einsätze)</span></summary>` +
            `<div class="list">${incidentsInYear(c, year).map((i) => incidentCard(i, numbers)).join("")}</div></details>`,
        )
        .join("") +
      `</div>`;

  return pageHero("Einsätze", "Übersicht der dokumentierten Einsätze und Übungen.") +
    `<section class="wrap">` +
    `<h2 class="section-title">${currentYear}</h2>` +
    (current === ""
      ? `<p class="news-empty">In diesem Jahr sind noch keine Einsätze veröffentlicht.</p>`
      : `<div class="list">${current}</div>`) +
    archive +
    statsBlock +
    `</section>`;
}

export function incidentDetail(c: SiteContent, id: string): string | null {
  const incident = c.incidents.find((entry) => entry.id === id);
  if (!incident) return null;

  const number = incidentNumbers(c).get(incident.id);
  return (
    pageHero(incident.title, `${formatDate(incident.date)} · ${incident.place}`) +
    `<section class="wrap card">${imgTag(incident.image, "equip-img")}` +
    `<p>` +
    (number ? `<span class="badge badge-number">Einsatz ${e(number)}</span> ` : "") +
    `<span class="badge">${e(incident.category)}</span>` +
    (incident.unit === "drohne" ? ` <span class="badge badge-drone">DROHNE IM EINSATZ</span>` : "") +
    ` Status: ${e(incident.status)}` +
    `${incident.duration ? ` · Dauer: ${e(incident.duration)}` : ""}</p>` +
    `<p>${e(incident.description)}</p>` +
    (safeUrl(incident.source) !== "" ? `<p class="news-empty"><a class="redtext" href="${safeUrl(incident.source)}" rel="noopener noreferrer" target="_blank">Quelle / weitere Informationen →</a></p>` : "") +
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

function sortedTeam(c: SiteContent): SiteContent["team"] {
  return [...c.team].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function team(c: SiteContent): string {
  const cards = sortedTeam(c)
    .map(
      (m) =>
        `<article class="card" style="text-align:center">${personAvatar(m)}` +
        `<h2>${e(m.name)}</h2><p>${personRole(m)}</p></article>`,
    )
    .join("");
  return pageHero("Team", "Die Fachgruppe Drohne der Freiwilligen Feuerwehr Biebertal.") +
    `<section class="wrap grid cards4">${cards}</section>`;
}

export function training(c: SiteContent): string {
  return pageHero("Ausbildung") +
    `<section class="wrap card"><p>${e(c.pages.training)}</p><ul class="features">` +
    `<li>Luftrecht und Datenschutz</li><li>Flugpraxis und Notverfahren</li>` +
    `<li>Wärmebildauswertung</li><li>Einsatzdokumentation</li></ul></section>`;
}

export function gallery(c: SiteContent): string {
  if (c.gallery.length === 0) {
    return pageHero("Galerie") +
      `<section class="wrap card"><p class="news-empty">Die Galerie wird gerade aufgebaut. ` +
      `Bilder aus Einsätzen und Übungen veröffentlichen wir erst, wenn die Einwilligung aller ` +
      `abgebildeten Personen vorliegt.</p></section>`;
  }

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

export function news(c: SiteContent): string {
  const entries = sortedNews(c);
  const body = entries.length === 0
    ? `<p class="news-empty">Zurzeit sind keine Meldungen veröffentlicht.</p>`
    : entries
        .map(
          (n) =>
            `<article class="news-item"><div class="news-date">${e(formatDate(n.date))}</div>` +
            `<h2><a href="/news/${e(n.id)}">${e(n.title)}</a></h2>` +
            `<p>${e(excerpt(n.text))}</p></article>`,
        )
        .join("");
  return pageHero("News", "Meldungen und Neuigkeiten aus der Fachgruppe.") +
    `<section class="wrap card">${body}</section>`;
}

export function newsDetail(c: SiteContent, id: string): string | null {
  const entry = c.news.find((item) => item.id === id);
  if (!entry) return null;

  return (
    pageHero(entry.title, formatDate(entry.date)) +
    `<section class="wrap card news-detail">${imgTag(entry.image, "equip-img", entry.title)}` +
    `<p>${e(entry.text)}</p>` +
    `<p><a class="redtext" href="/news">← Alle Meldungen</a></p></section>`
  );
}

/** Kurzfassung für die Übersicht, ohne mitten im Wort abzuschneiden. */
function excerpt(text: string, limit = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()} …`;
}

/**
 * Pflichtangaben nach § 5 TMG, übernommen aus dem Impressum der Feuerwehr Biebertal.
 * Der rechtliche Hinweis bleibt stehen: dieses Angebot ist ein eigener Auftritt und
 * muss vor der Veröffentlichung geprüft werden.
 */
export function imprint(c: SiteContent): string {
  return (
    pageHero("Impressum") +
    `<section class="wrap card"><h2>Angaben gemäß § 5 TMG</h2>` +
    `<p>Freiwillige Feuerwehr Biebertal<br>Mühlbergstraße 9<br>35444 Biebertal</p>` +
    `<p>Telefon: <a href="tel:+49640969 0">+49 6409 69-0</a><br>` +
    `E-Mail: <a href="mailto:${e(c.settings.email)}">${e(c.settings.email)}</a></p>` +
    `<h2>Inhaltlich Verantwortlicher gemäß § 55 Abs. 2 RStV</h2>` +
    `<p>Gemeindevorstand Biebertal<br>Mühlbergstraße 9<br>35444 Biebertal</p>` +
    `<h2>Haftung für Links</h2>` +
    `<p>Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte ` +
    `externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber ` +
    `verantwortlich.</p>` +
    `<h2>Urheberrecht</h2>` +
    `<p>Das Urheberrecht liegt bei der Freiwilligen Feuerwehr Biebertal sowie bei den Urhebern, ` +
    `die Bild- und Textmaterial zur Verfügung gestellt haben. Das Logo der Feuerwehr Biebertal ` +
    `wird mit Zustimmung der Feuerwehr Biebertal verwendet.</p>` +
    `<p class="news-empty"><b>Vor dem Live-Gang prüfen:</b> Diese Angaben stammen aus dem ` +
    `Impressum von feuerwehr-biebertal.de. Ob dieser eigenständige Auftritt zusätzliche oder ` +
    `abweichende Angaben braucht, muss der Gemeindevorstand rechtlich freigeben.</p>` +
    `</section>`
  );
}

export function privacy(): string {
  return (
    pageHero("Datenschutzerklärung") +
    `<section class="wrap card">` +
    `<p>Diese Website wird als Cloudflare Worker betrieben. Beim Aufruf verarbeitet Cloudflare ` +
    `technisch notwendige Verbindungsdaten. Die Seite bindet keine Werbe- oder Analysedienste ` +
    `ein und setzt keine Tracking-Cookies. Ein Cookie wird ausschließlich im geschützten ` +
    `Redaktionsbereich unter <code>/admin</code> gesetzt und dient dort der Anmeldung.</p>` +
    `<p>Das Kontaktformular auf dieser Seite ist derzeit ohne Funktion; es werden darüber keine ` +
    `Daten übermittelt oder gespeichert.</p>` +
    `<p class="news-empty"><b>Vor dem Live-Gang prüfen:</b> Dieser Text beschreibt den ` +
    `technischen Stand dieser Anwendung und ersetzt keine juristische Prüfung. Die vollständige ` +
    `Datenschutzerklärung muss vor der Veröffentlichung freigegeben und an das tatsächliche ` +
    `Hosting sowie an aktivierte Formulare angepasst werden.</p>` +
    `</section>`
  );
}


export function notFound(): string {
  return pageHero("Nicht gefunden") +
    `<section class="wrap card"><p>Diese Seite existiert nicht.</p>` +
    `<p><a class="btn red" href="/">Zur Startseite</a></p></section>`;
}
