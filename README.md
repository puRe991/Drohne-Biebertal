# Feuerwehr Biebertal – Fachgruppe Drohne

Website mit integriertem Flat-File-CMS, betrieben als **Cloudflare Worker** mit **D1**
als Datenbank. Die Seiten werden serverseitig gerendert, das Redaktions-Backend liegt
unter `/admin`.

## Tech-Stack und Begründung

- **Cloudflare Workers (TypeScript)**: Läuft in Cloudflares Edge-Netz, kein Server und
  kein Container zu pflegen. Die vorherige PHP-Anwendung konnte dort nicht laufen –
  Workers führen kein PHP aus.
- **D1 (SQLite) für Inhalte**: Das Dateisystem eines Workers ist schreibgeschützt und
  flüchtig. Redaktionelle Änderungen gehören deshalb in eine Datenbank, sonst wären sie
  beim nächsten Deploy verloren. `data/site.json` bleibt die versionierte
  Auslieferungsfassung und füllt eine leere Datenbank einmalig.
- **Workers Assets** liefert `public/` (Stylesheet, `robots.txt`) direkt aus dem
  Cloudflare-Cache aus.
- **Keine Laufzeit-Abhängigkeiten**: Sessions, CSRF-Schutz und Passwort-Hashing nutzen
  ausschliesslich die eingebaute WebCrypto-API. Alle npm-Pakete sind reine Build-Werkzeuge.

## Schnellstart (lokal)

```bash
npm install
cp .dev.vars.example .dev.vars          # lokale Secrets
npm run hash-password -- 'MeinLokalesPasswort'   # Ausgabe in .dev.vars eintragen
npm run db:migrate:local                # D1-Tabellen lokal anlegen
npm run dev                             # http://localhost:8787
```

- Öffentliche Website: <http://localhost:8787>
- CMS-Backend: <http://localhost:8787/admin>

Ohne gesetztes `ADMIN_PASSWORD_HASH` gilt lokal der Entwicklungszugang
`admin@feuerwehr-biebertal.local` / `Drohne112!`. In Produktion ist dieser Zugang
deaktiviert – ohne Secret bleibt das Backend gesperrt.

## Erstmaliges Deployment

Ein Deploy ohne diese Schritte schlägt fehl, weil `wrangler.toml` noch eine
Platzhalter-Datenbank-ID enthält.

```bash
# 1. Datenbank anlegen und die ausgegebene database_id in wrangler.toml eintragen
npx wrangler d1 create drohne-biebertal

# 2. Tabellen in der Cloud anlegen
npm run db:migrate

# 3. Secrets setzen (erscheinen nie im Repository)
npm run hash-password -- 'EinStarkesPasswort'
npx wrangler secret put ADMIN_PASSWORD_HASH
npm run secret
npx wrangler secret put APP_SECRET

# 4. Veröffentlichen
npm run deploy
```

Beim ersten Aufruf übernimmt der Worker die Inhalte aus `data/site.json` in D1.

### Automatischer Deploy über GitHub

`.github/workflows/deploy.yml` veröffentlicht jeden Push auf `main`. Dafür im
Repository zwei Secrets hinterlegen:

- `CLOUDFLARE_API_TOKEN` – Token mit der Berechtigung *Edit Cloudflare Workers*
- `CLOUDFLARE_ACCOUNT_ID`

Wird stattdessen die Cloudflare-eigene Git-Integration genutzt (Build-Befehl
`npx wrangler deploy`), müssen `database_id` und die Secrets ebenfalls gesetzt sein.

## Konfiguration

Nicht vertrauliche Werte stehen in `wrangler.toml` unter `[vars]`:

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `APP_ENV` | `production`, `staging` oder `development` | `production` |
| `APP_DEBUG` | Zeigt Fehlermeldungen im Browser | `false` |
| `APP_VERSION` | Cache-Buster für Assets, im Deploy der Git-SHA | `dev` |
| `PAGE_CACHE_SECONDS` | Cache-Dauer öffentlicher Seiten | `60` |
| `SESSION_LIFETIME` | Gültigkeit der Anmeldung in Sekunden | `7200` |
| `ADMIN_EMAIL` | Anmeldename des Backends | `admin@feuerwehr-biebertal.local` |

Vertrauliche Werte ausschliesslich als Secret (`npx wrangler secret put`):

| Secret | Zweck |
| --- | --- |
| `ADMIN_PASSWORD_HASH` | PBKDF2-Hash des Admin-Passworts. Fehlt er, ist das Backend in Produktion gesperrt. |
| `APP_SECRET` | Signiert Session-Cookie und CSRF-Token. |

## Betrieb

| Pfad | Zweck |
| --- | --- |
| `/healthz` | Liveness – antwortet ohne Datenbankzugriff |
| `/readyz` | Readiness – prüft D1 und meldet fehlende Secrets (HTTP 503 bei Problemen) |

Logs live mitlesen: `npx wrangler tail`.

Inhalte sichern und zurückspielen:

```bash
npx wrangler d1 execute drohne-biebertal --remote \
  --command "SELECT payload FROM cms_content WHERE id='site';" --json > backup.json
```

## CMS-Funktionen

- Login unter `/admin`, zusätzlich im Footer verlinkt.
- Neue Einsätze per Formular anlegen; die URL-ID wird aus dem Titel erzeugt und bei
  Namensgleichheit automatisch durchnummeriert.
- Alle redaktionellen Inhalte als JSON bearbeiten: Startseite, Einsatzbereiche,
  Einsätze, Team, Technik, Galerie, Ausbildung, Kontakt, Footer und Social Links.
- Vor dem Speichern werden die Inhalte geprüft; fehlerhaftes JSON wird abgewiesen,
  damit die öffentliche Website nicht beschädigt wird.

## Entwicklung

```bash
npm run typecheck   # TypeScript ohne Emit
npm test            # Unit-Tests (Vitest)
npm run dev         # lokaler Worker samt lokaler D1
```

## Sicherheitshinweise

- Das Admin-Passwort wird als PBKDF2-SHA256 mit 210.000 Iterationen gespeichert.
- Session- und CSRF-Token sind HMAC-signiert; ohne `APP_SECRET` sind sie nicht fälschbar.
- Das Backend ist mit `X-Robots-Tag: noindex` und `Cache-Control: no-store` ausgenommen.
- Bild-URLs aus dem CMS werden auf `http(s)` begrenzt, damit keine `javascript:`-URL
  in die Seite gelangt.
- Cloudflare terminiert TLS; Cookies werden ausserhalb von `localhost` immer mit
  `Secure` gesetzt.

## Bilder und Medien

Alle Bilder werden derzeit als externe URL referenziert. Ein Datei-Upload ist bewusst
nicht enthalten: Workers haben kein beschreibbares Dateisystem. Für eigene Medien
eignet sich ein R2-Bucket, der dem Worker als Binding zugewiesen wird.

## Rechtliche und redaktionelle Hinweise

Alle Beispielinhalte, Namen und Bilder sind Platzhalter. Vor dem Live-Gang müssen echte
Inhalte freigegeben werden. Personenfotos dürfen nur mit Einwilligung veröffentlicht
werden. Impressum und Datenschutzerklärung sind noch als TODO hinterlegt und vor der
Veröffentlichung rechtlich zu prüfen.
