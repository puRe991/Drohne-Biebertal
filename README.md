# Feuerwehr Biebertal – Fachgruppe Drohne

Produktionsnaher Website-Prototyp mit öffentlicher Website und geschütztem CMS-Backend für die Fachgruppe Drohne.

## Tech-Stack und Begründung

Gewählt wurde **Next.js 16 mit App Router, TypeScript und serverseitigen Actions**. Diese Lösung liefert sehr gute SEO- und Performance-Eigenschaften für die öffentliche Website, bleibt günstig hostbar und erlaubt ein schlankes, vereinsfreundliches CMS ohne externen SaaS-Lock-in. Inhalte liegen im Prototyp in `data/site.json`; für den produktiven Betrieb lässt sich dieselbe Struktur auf SQLite/PostgreSQL plus Objektspeicher für Medien migrieren. Login und Sessions sind serverseitig angelegt, sodass später Rollen wie „Redakteur“ ergänzt werden können.

## Lokal starten

### Voraussetzungen

- Node.js 20 LTS oder 22 LTS
- Für die vollständige Next.js- und CMS-Entwicklung unter Windows die **64-bit/x64**-Version von Node.js verwenden. Auf echten 32-bit-Systemen (`win32 | ia32`) startet `npm run dev` automatisch einen schlanken Legacy-Dev-Server mit öffentlicher Website und Basis-CMS, weil Next.js 16 keine 32-bit-Windows-SWC-Binärdateien mitliefert.

```bash
node -p "process.version + ' ' + process.platform + ' ' + process.arch"
npm install
npm run dev
```

Wenn `npm run dev` mit `Der Befehl "next" ... konnte nicht gefunden werden` startet, ist `npm install` vorher fehlgeschlagen. In diesem Fall `node_modules` und `package-lock.json` nicht manuell bearbeiten, sondern zuerst `npm install` erneut ausführen. Auf 32-bit-Windows liefert der Legacy-Server die öffentliche Website und ein Basis-CMS unter `/admin` aus. Next.js-spezifische Funktionen, Produktions-Builds und Deployment bleiben Aufgabe der regulären 64-bit-Node.js-Umgebung, WSL, Docker oder des Deployments.

Danach öffnen:

- Öffentliche Website: <http://localhost:3000>
- CMS-Backend: <http://localhost:3000/admin>

### 32-bit-Windows-Fallback

Der Fallback ist nicht mehr nur eine statische Vorschau: Er enthält Login, Session-Cookie, CSRF-Prüfung, Einsatz-Anlage und JSON-Bearbeitung für `data/site.json`. Damit sind lokale Inhaltsänderungen auch auf 32-bit-Windows möglich. Bewusst nicht enthalten sind Next.js-spezifische Funktionen wie App-Router-Rendering, Server Actions, Image Optimization, Build und produktionsnahes Deployment; dafür weiterhin 64-bit Node.js nutzen.

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
- Alle redaktionellen Inhalte über ein JSON-Formular bearbeiten: Startseite, Einsatzbereiche, Einsätze, Team, Technik, Galerie, Ausbildung, Kontakt, Footer und Social Links.
- Passwort-Reset als Funktionsgerüst unter `/admin/reset`.
- Mediathek und automatische Bildoptimierung sind als Datenmodell-/Deployment-Schritt vorbereitet; aktuell nutzt der Prototyp externe Platzhalterbilder und Next.js Image Optimization.

## Deployment-Optionen

1. **Vercel + PostgreSQL/Blob Storage**: sehr einfacher Next.js-Betrieb, gute Performance, geringe Wartung. Für ein kleines Vereinsprojekt meist die schnellste produktive Option.
2. **Netcup/Hetzner VPS mit Node.js + SQLite/PostgreSQL + Caddy**: günstiger eigener Server mit voller Kontrolle, aber mehr Wartungsaufwand für Updates, Backups und Sicherheit.

Für klassisches Webhosting ohne Node.js eignet sich dieser Stack nicht direkt; dann wäre WordPress die einfachere Alternative, aber mit mehr Plugin-/Update-Risiko.

## Rechtliche und redaktionelle Hinweise

Alle Beispielinhalte, Namen und Bilder sind Platzhalter. Vor dem Live-Gang müssen echte Inhalte freigegeben werden. Personenfotos dürfen nur mit Einwilligung veröffentlicht werden. Impressum und Datenschutzerklärung enthalten bewusst TODO-Platzhalter und müssen rechtlich geprüft werden.
