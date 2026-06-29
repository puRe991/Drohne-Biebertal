import test from "node:test";
import assert from "node:assert/strict";
import { createSlug, formatDate, getContent } from "../lib/content";
import { IncidentSchema, SiteContentSchema } from "../lib/content-schema";
import { getSessionOptions, verifyLogin } from "../lib/auth";

test("seed content matches the CMS schema", () => {
  assert.doesNotThrow(() => SiteContentSchema.parse(getContent()));
});

test("createSlug normalizes German titles and avoids collisions", () => {
  assert.equal(createSlug("Flächenbrand – Übung!", []), "flachenbrand-ubung");
  assert.equal(
    createSlug("Flächenbrand – Übung!", ["flachenbrand-ubung"]),
    "flachenbrand-ubung-2",
  );
});

test("incident schema rejects empty required fields", () => {
  const result = IncidentSchema.safeParse({
    id: "test-einsatz",
    title: "Testeinsatz",
    date: "2026-06-29",
    place: "",
    category: "Lageerkundung",
    status: "abgeschlossen",
    duration: "",
    image: "https://example.com/image.jpg",
    description: "Beschreibung",
  });

  assert.equal(result.success, false);
});

test("formatDate keeps invalid dates readable instead of throwing", () => {
  assert.equal(formatDate("kein-datum"), "kein-datum");
});

test("documented default admin credentials match the fallback hash", async () => {
  const user = await verifyLogin(
    "admin@feuerwehr-biebertal.local",
    "Drohne112!",
  );
  assert.equal(user?.role, "Administrator");
  assert.equal(user?.mustChangePassword, true);
});

test("production sessions require an explicit secret", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSecret = process.env.SESSION_SECRET;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    assert.throws(() => getSessionOptions(), /SESSION_SECRET/);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = previousSecret;
    }
  }
});
