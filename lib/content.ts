import fs from "node:fs";
import path from "node:path";
import { SiteContentSchema, type SiteContent } from "./content-schema";

const file = path.join(process.cwd(), "data/site.json");

export function getContent(): SiteContent {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return SiteContentSchema.parse(parsed);
}

export function saveContent(data: SiteContent) {
  const validated = SiteContentSchema.parse(data);
  fs.writeFileSync(file, JSON.stringify(validated, null, 2));
}

export function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}
