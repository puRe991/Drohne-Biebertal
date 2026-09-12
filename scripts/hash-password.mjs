#!/usr/bin/env node
/**
 * Erzeugt den Wert für das Secret ADMIN_PASSWORD_HASH.
 * Muss dasselbe Format liefern wie die Prüfung im Worker (src/auth.ts).
 *
 *   npm run hash-password -- 'MeinPasswort'
 *   npx wrangler secret put ADMIN_PASSWORD_HASH
 */
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const ITERATIONS = 210_000;

const base64url = (buffer) => buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

let password = process.argv[2];
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Neues Admin-Passwort: ");
  rl.close();
}

if (password.length < 12) {
  console.error("Fehler: Bitte mindestens 12 Zeichen verwenden.");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
console.log(`pbkdf2_sha256$${ITERATIONS}$${base64url(salt)}$${base64url(derived)}`);
