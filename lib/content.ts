import fs from "node:fs";
import path from "node:path";
export type SiteContent = typeof import("../data/site.json");
const file = path.join(process.cwd(), "data/site.json");
export function getContent(): SiteContent {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function saveContent(data: SiteContent) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
