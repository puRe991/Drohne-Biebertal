# Feuerwehr Biebertal – Fachgruppe Drohne

Produktionsnaher Website-Prototyp mit öffentlicher Website und geschütztem CMS-Backend für die Fachgruppe Drohne.

## Tech-Stack und Begründung

Gewählt wurde **Next.js 16 mit App Router, TypeScript und serverseitigen Actions**. Diese Lösung liefert sehr gute SEO- und Performance-Eigenschaften für die öffentliche Website, bleibt günstig hostbar und erlaubt ein schlankes, vereinsfreundliches CMS ohne externen SaaS-Lock-in. Inhalte liegen im Prototyp in `data/site.json`; für den produktiven Betrieb lässt sich dieselbe Struktur auf SQLite/PostgreSQL plus Objektspeicher für Medien migrieren. Login und Sessions sind serverseitig angelegt, sodass später Rollen wie „Redakteur“ ergänzt werden können.

## Lokal starten

```bash
npm install
npm run dev
```

Danach öffnen:

- Öffentliche Website: <http://localhost:3000>
- CMS-Backend: <http://localhost:3000/admin>

## Qualitätssicherung

```bash
npm run test
npm run lint
npm run build
```

Die Tests prüfen das Content-Schema, die Slug-Erzeugung und die dokumentierten initialen Admin-Zugangsdaten.

## Umgebungsvariablen

Für lokale Tests funktionieren sichere Defaults nur eingeschränkt. Für Produktion zwingend setzen:

```bash
SESSION_SECRET="mindestens-32-zeichen-zufaellig-und-geheim"
ADMIN_EMAIL="admin@feuerwehr-biebertal.local"
ADMIN_PASSWORD_HASH="$2a$10$...bcrypt-hash..."
```

Einen bcrypt-Hash erzeugen, z. B.:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('NEUES_PASSWORT',10).then(console.log)"
```

## Initiales Admin-Konto

- E-Mail: `admin@feuerwehr-biebertal.local`
- Passwort: `Drohne112!`

Das Standardpasswort ist nur für die Erstinstallation gedacht. Vor einem Live-Gang muss `ADMIN_PASSWORD_HASH` gesetzt werden. Die UI markiert dies als Pflicht zur Passwortänderung; eine vollständige Änderungsstrecke ist als nächster Sicherheitsschritt vorgesehen.

## CMS-Funktionen

- Login unter `/admin`, nicht in der Hauptnavigation verlinkt.
- Neue Einsätze per Formular anlegen.
- Alle redaktionellen Inhalte über ein validiertes JSON-Formular bearbeiten: Startseite, Einsatzbereiche, Einsätze, Team, Technik, Galerie, Ausbildung, Kontakt, Footer und Social Links.
- Passwort-Reset als Funktionsgerüst unter `/admin/reset`.
- Mediathek und automatische Bildoptimierung sind als Datenmodell-/Deployment-Schritt vorbereitet; aktuell nutzt der Prototyp externe Platzhalterbilder und Next.js Image Optimization.

## Deployment-Optionen

1. **Vercel + PostgreSQL/Blob Storage**: sehr einfacher Next.js-Betrieb, gute Performance, geringe Wartung. Für ein kleines Vereinsprojekt meist die schnellste produktive Option.
2. **Netcup/Hetzner VPS mit Node.js + SQLite/PostgreSQL + Caddy**: günstiger eigener Server mit voller Kontrolle, aber mehr Wartungsaufwand für Updates, Backups und Sicherheit.

Für klassisches Webhosting ohne Node.js eignet sich dieser Stack nicht direkt; dann wäre WordPress die einfachere Alternative, aber mit mehr Plugin-/Update-Risiko.

## Rechtliche und redaktionelle Hinweise

Alle Beispielinhalte, Namen und Bilder sind Platzhalter. Vor dem Live-Gang müssen echte Inhalte freigegeben werden. Personenfotos dürfen nur mit Einwilligung veröffentlicht werden. Impressum und Datenschutzerklärung enthalten bewusst TODO-Platzhalter und müssen rechtlich geprüft werden.
