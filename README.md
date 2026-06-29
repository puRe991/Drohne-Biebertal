# Feuerwehr Biebertal – Fachgruppe Drohne

32-bit-fähige Website mit integriertem Flat-File-CMS für die Fachgruppe Drohne. Der bisherige Node.js-/Next.js-Stack wurde durch eine klassische PHP-Anwendung ersetzt, damit Betrieb und Redaktion auch auf 32-bit-Systemen und einfachem Webhosting möglich sind.

## Tech-Stack und Begründung

- **PHP 8.1+ ohne externe Laufzeitabhängigkeiten**: PHP läuft auf 32-bit- und 64-bit-Systemen sowie auf klassischem Shared Hosting. Es werden keine nativen Node.js-Binärpakete, kein SWC und kein Build-Schritt benötigt.
- **Flat-File-CMS mit `data/site.json`**: Inhalte bleiben transparent versionierbar und können über das geschützte Backend unter `/admin` bearbeitet werden.
- **Serverseitige Sessions und CSRF-Schutz**: Das CMS nutzt HttpOnly-Session-Cookies, CSRF-Tokens und `password_hash`/`password_verify` für Admin-Logins.
- **Keine Composer-Abhängigkeiten**: `composer.json` beschreibt nur PHP-Anforderung und Komfort-Skripte. Die Anwendung läuft auch ohne `composer install`.

## Lokal starten

### Voraussetzungen

- PHP 8.1 oder neuer, 32-bit oder 64-bit
- Optional: Composer für Komfort-Skripte

```bash
php -S 127.0.0.1:8000 -t public public/index.php
```

Danach öffnen:

- Öffentliche Website: <http://127.0.0.1:8000>
- CMS-Backend: <http://127.0.0.1:8000/admin>

Optional mit Composer:

```bash
composer run dev
composer run lint
```

## Deployment auf 32-bit-Systemen

1. Repository auf den Webserver kopieren.
2. Document Root auf `public/` setzen.
3. Sicherstellen, dass der Webserver Schreibrechte auf `data/site.json` hat.
4. In Produktion die Umgebungsvariablen unten setzen.

Für Apache oder nginx muss die Anwendung alle nicht existierenden Pfade an `public/index.php` weiterleiten, damit URLs wie `/einsaetze/personensuche-waldgebiet` funktionieren.

## Umgebungsvariablen

Für Produktion zwingend setzen:

```bash
ADMIN_EMAIL="admin@feuerwehr-biebertal.local"
ADMIN_PASSWORD_HASH="..."
```

Passwort-Hash erzeugen:

```bash
php -r "echo password_hash('NEUES_PASSWORT', PASSWORD_DEFAULT), PHP_EOL;"
```

## Initiales Admin-Konto

- E-Mail: `admin@feuerwehr-biebertal.local`
- Passwort: `Drohne112!`

Das Standardpasswort ist nur für die Erstinstallation gedacht. Vor einem Live-Gang muss `ADMIN_PASSWORD_HASH` gesetzt werden.

## CMS-Funktionen

- Login unter `/admin`, zusätzlich im Footer verlinkt.
- Neue Einsätze per Formular anlegen.
- Alle redaktionellen Inhalte als JSON bearbeiten: Startseite, Einsatzbereiche, Einsätze, Team, Technik, Galerie, Ausbildung, Kontakt, Footer und Social Links.
- Inhalte werden atomar in `data/site.json` gespeichert.

## Sicherheitshinweise

- `data/site.json` darf bei produktivem Hosting nicht direkt öffentlich unter einer URL ausgeliefert werden. In dieser Struktur liegt die Datei außerhalb von `public/`.
- Setze ein starkes Admin-Passwort per `ADMIN_PASSWORD_HASH`.
- Aktiviere HTTPS, damit Session-Cookies sicher übertragen werden.
- Prüfe Impressum und Datenschutzerklärung vor dem Live-Gang rechtlich.

## Rechtliche und redaktionelle Hinweise

Alle Beispielinhalte, Namen und Bilder sind Platzhalter. Vor dem Live-Gang müssen echte Inhalte freigegeben werden. Personenfotos dürfen nur mit Einwilligung veröffentlicht werden.
