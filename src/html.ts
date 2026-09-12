/** Escaping für alle Werte, die aus dem CMS in die Seite wandern. */
export function e(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Nur http(s)-URLs in Attribute lassen. Verhindert, dass eine aus dem Backend
 * eingetragene javascript:-URL im src- oder href-Attribut landet.
 */
export function safeUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (raw === "") return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return e(raw);
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? e(url.toString()) : "";
  } catch {
    return "";
  }
}

export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
}

/**
 * URL-taugliche ID. Die Umlauttabelle ist bewusst explizit: die Worker-Laufzeit
 * hat keine Transliteration, "Übung" würde sonst zu "bung" werden.
 */
export function slugify(title: string): string {
  const map: Record<string, string> = {
    ä: "ae", ö: "oe", ü: "ue", Ä: "ae", Ö: "oe", Ü: "ue", ß: "ss",
    á: "a", à: "a", â: "a", å: "a", é: "e", è: "e", ê: "e", ë: "e",
    í: "i", ì: "i", î: "i", ó: "o", ò: "o", ô: "o", ø: "o",
    ú: "u", ù: "u", û: "u", ç: "c", ñ: "n", æ: "ae", œ: "oe",
  };
  const replaced = [...title].map((char) => map[char] ?? char).join("");
  const slug = replaced
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "einsatz" : slug;
}

/** Hängt einen Zähler an, damit ein zweiter gleichnamiger Einsatz die erste URL nicht überschreibt. */
export function uniqueSlug(title: string, existing: readonly string[]): string {
  const base = slugify(title);
  if (!existing.includes(base)) return base;
  for (let counter = 2; ; counter++) {
    const candidate = `${base}-${counter}`;
    if (!existing.includes(candidate)) return candidate;
  }
}
