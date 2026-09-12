import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  cookieHeader,
  csrfToken,
  createSessionCookie,
  hashPassword,
  parseCookies,
  readSessionCookie,
  timingSafeEqual,
  verifyCsrf,
  verifyLogin,
  verifyPassword,
} from "../src/auth.ts";
import { seedContent, sortedNews, validateContent, ContentError } from "../src/content.ts";
import { configProblems, type Env } from "../src/env.ts";
import { e, formatDate, initials, safeUrl, slugify, uniqueSlug } from "../src/html.ts";

const baseEnv = { APP_SECRET: "test-geheimnis", APP_ENV: "development" } as unknown as Env;

describe("Escaping", () => {
  it("entschärft HTML-Sonderzeichen", () => {
    expect(e(`<script>alert("x")</script>`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(e("Tom & Jerry's")).toBe("Tom &amp; Jerry&#039;s");
  });

  it("lässt nur http(s)- und Pfad-URLs durch", () => {
    expect(safeUrl("https://example.com/bild.jpg")).toBe("https://example.com/bild.jpg");
    expect(safeUrl("/styles.css")).toBe("/styles.css");
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,<script>")).toBe("");
    expect(safeUrl("//fremde-domain.example/x")).toBe("");
    expect(safeUrl("")).toBe("");
  });
});

describe("Slugs", () => {
  it("übersetzt deutsche Umlaute statt sie zu entfernen", () => {
    expect(slugify("Übung Nachtflug")).toBe("uebung-nachtflug");
    expect(slugify("Flächenbrand – Unterstützung")).toBe("flaechenbrand-unterstuetzung");
    expect(slugify("Straße & Weg")).toBe("strasse-weg");
    expect(slugify("Überörtliche Hilfe Gießen")).toBe("ueberoertliche-hilfe-giessen");
  });

  it("fällt auf einen Standardwert zurück", () => {
    expect(slugify("...")).toBe("einsatz");
    expect(slugify("")).toBe("einsatz");
  });

  it("verhindert doppelte IDs", () => {
    expect(uniqueSlug("Übung", ["uebung", "uebung-2"])).toBe("uebung-3");
    expect(uniqueSlug("Neuer Einsatz", ["uebung"])).toBe("neuer-einsatz");
  });
});

describe("Datumsformat", () => {
  it("zeigt deutsche Schreibweise", () => {
    expect(formatDate("2026-09-12")).toBe("12.09.2026");
    expect(formatDate("kein-datum")).toBe("kein-datum");
  });
});

describe("Inhaltsvalidierung", () => {
  it("akzeptiert die Auslieferungsinhalte", () => {
    expect(() => validateContent(seedContent())).not.toThrow();
  });

  it("erkennt fehlende Bereiche", () => {
    expect(() => validateContent({ settings: {} })).toThrow(ContentError);
  });

  it("erkennt ungültige Kontakt-E-Mail", () => {
    const data = seedContent();
    data.settings.email = "keine-email";
    expect(() => validateContent(data)).toThrow(/E-Mail/);
  });

  it("erkennt falsches Datumsformat", () => {
    const data = seedContent();
    data.incidents[0]!.date = "12.09.2026";
    expect(() => validateContent(data)).toThrow(/YYYY-MM-DD/);
  });

  it("erkennt doppelte Einsatz-IDs", () => {
    const data = seedContent();
    data.incidents[1]!.id = data.incidents[0]!.id;
    expect(() => validateContent(data)).toThrow(/doppelt/);
  });

  it("erkennt ungültige Einsatz-IDs", () => {
    const data = seedContent();
    data.incidents[0]!.id = "Nicht Erlaubt!";
    expect(() => validateContent(data)).toThrow(/Kleinbuchstaben/);
  });

  it("weist Listen an Objektstellen ab", () => {
    expect(() => validateContent([])).toThrow(ContentError);
  });
});

describe("News", () => {
  it("akzeptiert gültige Meldungen", () => {
    const data = seedContent();
    data.news = [{ id: "erste-meldung", title: "Erste Meldung", date: "2026-09-12", text: "Inhalt." }];
    expect(() => validateContent(data)).not.toThrow();
  });

  it("erkennt falsches Datum und ungültige IDs", () => {
    const withDate = seedContent();
    withDate.news = [{ id: "x", title: "T", date: "12.09.2026", text: "Inhalt." }];
    expect(() => validateContent(withDate)).toThrow(/YYYY-MM-DD/);

    const withId = seedContent();
    withId.news = [{ id: "Nicht Erlaubt", title: "T", date: "2026-09-12", text: "Inhalt." }];
    expect(() => validateContent(withId)).toThrow(/Kleinbuchstaben/);
  });

  it("erkennt doppelte Meldungs-IDs", () => {
    const data = seedContent();
    data.news = [
      { id: "doppelt", title: "A", date: "2026-09-12", text: "Inhalt." },
      { id: "doppelt", title: "B", date: "2026-09-11", text: "Inhalt." },
    ];
    expect(() => validateContent(data)).toThrow(/doppelt/);
  });

  it("erkennt leeren Meldungstext", () => {
    const data = seedContent();
    data.news = [{ id: "leer", title: "T", date: "2026-09-12", text: "   " }];
    expect(() => validateContent(data)).toThrow(/news\[\]\.text/);
  });

  it("bleibt zu Datenständen ohne news-Bereich kompatibel", () => {
    // Inhalte, die vor der Einführung des Bereichs gespeichert wurden.
    const data = seedContent() as unknown as Record<string, unknown>;
    delete data.news;
    const validated = validateContent(data);
    expect(validated.news).toEqual([]);
  });

  it("sortiert Meldungen neueste zuerst", () => {
    const data = seedContent();
    data.news = [
      { id: "alt", title: "Alt", date: "2026-01-05", text: "x" },
      { id: "neu", title: "Neu", date: "2026-09-12", text: "x" },
      { id: "mittel", title: "Mittel", date: "2026-05-01", text: "x" },
    ];
    expect(sortedNews(data).map((n) => n.id)).toEqual(["neu", "mittel", "alt"]);
  });
});

describe("Team", () => {
  it("bildet Initialen für Personen ohne Foto", () => {
    expect(initials("Florian Clever")).toBe("FC");
    expect(initials("Michele Schuster")).toBe("MS");
    expect(initials("Sebastian Hose")).toBe("SH");
    expect(initials("Maurice")).toBe("M");
    expect(initials("  Tim   Antosch  ")).toBe("TA");
    expect(initials("")).toBe("?");
  });

  it("führt alle sechs Mitglieder ohne fremde Fotos", () => {
    const { team } = seedContent();
    expect(team.map((m) => m.name)).toEqual([
      "Florian Clever",
      "Michele Schuster",
      "Maurice Kunz",
      "Tim Antosch",
      "Markus Hofmann",
      "Sebastian Hose",
    ]);
    // Kein Eintrag darf ein Stockfoto einer fremden Person tragen.
    expect(team.every((m) => (m.image ?? "") === "")).toBe(true);
  });
});

describe("Passwörter", () => {
  it("bestätigt das richtige und verwirft das falsche Passwort", async () => {
    const hash = await hashPassword("EinLangesTestPasswort1!", 10_000);
    expect(await verifyPassword("EinLangesTestPasswort1!", hash)).toBe(true);
    expect(await verifyPassword("falsch", hash)).toBe(false);
  });

  it("verwirft kaputte Hash-Formate, statt zu werfen", async () => {
    for (const broken of ["", "kein-hash", "pbkdf2_sha256$1$a$b", "bcrypt$12$x$y", "pbkdf2_sha256$abc$a$b"]) {
      expect(await verifyPassword("x", broken)).toBe(false);
    }
  });

  it("akzeptiert Hashes aus scripts/hash-password.mjs", async () => {
    // Vertragstest: Node erzeugt das Secret, der Worker prüft es.
    const hash = execFileSync("node", ["scripts/hash-password.mjs", "GeneriertesPasswort1!"], {
      encoding: "utf8",
    }).trim();
    expect(hash.startsWith("pbkdf2_sha256$210000$")).toBe(true);
    expect(await verifyPassword("GeneriertesPasswort1!", hash)).toBe(true);
    expect(await verifyPassword("anderes", hash)).toBe(false);
  });

  it("vergleicht längenunabhängig ohne Ausnahme", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("Anmeldung", () => {
  it("meldet den Administrator mit korrekten Daten an", async () => {
    const hash = await hashPassword("RichtigesPasswort1!", 10_000);
    const env = { ...baseEnv, ADMIN_PASSWORD_HASH: hash } as Env;
    expect(await verifyLogin(env, "admin@feuerwehr-biebertal.local", "RichtigesPasswort1!")).not.toBeNull();
    expect(await verifyLogin(env, "admin@feuerwehr-biebertal.local", "falsch")).toBeNull();
    expect(await verifyLogin(env, "fremd@example.com", "RichtigesPasswort1!")).toBeNull();
  });

  it("sperrt das Backend in Produktion ohne gesetztes Secret", async () => {
    const env = { APP_ENV: "production" } as Env;
    expect(await verifyLogin(env, "admin@feuerwehr-biebertal.local", "Drohne112!")).toBeNull();
  });
});

describe("Session-Cookie", () => {
  const user = { email: "admin@feuerwehr-biebertal.local", role: "Administrator", mustChangePassword: false };

  it("liest zurück, was es geschrieben hat", async () => {
    const cookie = await createSessionCookie(baseEnv, user);
    expect(await readSessionCookie(baseEnv, cookie)).toMatchObject({ email: user.email });
  });

  it("verwirft manipulierte und fremd signierte Cookies", async () => {
    const cookie = await createSessionCookie(baseEnv, user);
    const [payload, signature] = cookie.split(".");

    expect(await readSessionCookie(baseEnv, `${payload}.${"a".repeat(signature!.length)}`)).toBeNull();
    expect(await readSessionCookie(baseEnv, cookie.replace(/.$/, "X"))).toBeNull();
    expect(await readSessionCookie(baseEnv, undefined)).toBeNull();
    expect(await readSessionCookie(baseEnv, "unsinn")).toBeNull();

    const otherSecret = { ...baseEnv, APP_SECRET: "anderes-geheimnis" } as Env;
    expect(await readSessionCookie(otherSecret, cookie)).toBeNull();
  });

  it("verwirft abgelaufene Cookies", async () => {
    const env = { ...baseEnv, SESSION_LIFETIME: "60" } as Env;
    const cookie = await createSessionCookie(env, user);
    expect(await readSessionCookie(env, cookie)).not.toBeNull();

    // Die Uhr über die Lebensdauer hinaus stellen: das Cookie muss verfallen.
    const realNow = Date.now;
    Date.now = () => realNow() + 61_000;
    try {
      expect(await readSessionCookie(env, cookie)).toBeNull();
    } finally {
      Date.now = realNow;
    }
  });

  it("verwirft Cookies, wenn die Admin-Adresse gewechselt wurde", async () => {
    const cookie = await createSessionCookie(baseEnv, user);
    const renamed = { ...baseEnv, ADMIN_EMAIL: "neu@example.com" } as Env;
    expect(await readSessionCookie(renamed, cookie)).toBeNull();
  });
});

describe("CSRF", () => {
  it("akzeptiert nur das zum Cookie passende Token", async () => {
    const secretValue = "abc123";
    const token = await csrfToken(baseEnv, secretValue);

    expect(await verifyCsrf(baseEnv, secretValue, token)).toBe(true);
    expect(await verifyCsrf(baseEnv, "anderes-cookie", token)).toBe(false);
    expect(await verifyCsrf(baseEnv, secretValue, "gefälscht")).toBe(false);
    expect(await verifyCsrf(baseEnv, undefined, token)).toBe(false);
    expect(await verifyCsrf(baseEnv, secretValue, null)).toBe(false);
  });
});

describe("Cookie-Hilfen", () => {
  it("liest Cookie-Header", () => {
    expect(parseCookies("a=1; b=zwei%20drei")).toEqual({ a: "1", b: "zwei drei" });
    expect(parseCookies(null)).toEqual({});
  });

  it("setzt Secure ausserhalb von localhost", () => {
    expect(cookieHeader("x", "y", 60, new URL("https://drohne.example/admin"))).toContain("Secure");
    expect(cookieHeader("x", "y", 60, new URL("http://localhost:8787/admin"))).not.toContain("Secure");
    expect(cookieHeader("x", "y", 60, new URL("https://drohne.example/admin"))).toContain("HttpOnly");
  });
});

describe("Konfigurationsprüfung", () => {
  it("verlangt Secrets in Produktion", () => {
    const problems = configProblems({ APP_ENV: "production", CONTENT: {} } as unknown as Env).join(" | ");
    expect(problems).toMatch(/ADMIN_PASSWORD_HASH/);
    expect(problems).toMatch(/APP_SECRET/);
  });

  it("lässt die Entwicklung ohne Zusatzkonfiguration laufen", () => {
    expect(configProblems({ APP_ENV: "development", CONTENT: {} } as unknown as Env)).toEqual([]);
  });

  it("meldet ein fehlendes Speicher-Binding", () => {
    expect(configProblems({ APP_ENV: "development" } as Env).join(" ")).toMatch(/CONTENT/);
  });
});
