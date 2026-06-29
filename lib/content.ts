import fs from "node:fs";
import path from "node:path";
import { SiteContent, SiteContentSchema } from "./content-schema";

const contentFile = path.join(process.cwd(), "data/site.json");

export function getContent(): SiteContent {
  const parsed = JSON.parse(fs.readFileSync(contentFile, "utf8"));
  return SiteContentSchema.parse(parsed);
}

export function saveContent(data: SiteContent) {
  const validated = SiteContentSchema.parse(data);
  const tmpFile = `${contentFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, `${JSON.stringify(validated, null, 2)}\n`);
  fs.renameSync(tmpFile, contentFile);
}

export function createSlug(input: string, existingIds: string[] = []) {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "eintrag";

  let candidate = base;
  let counter = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}
