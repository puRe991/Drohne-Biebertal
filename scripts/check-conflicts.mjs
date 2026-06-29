import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".next", "node_modules"]);
const conflictMarker = /^(<<<<<<<|=======|>>>>>>>)($|\s)/;
const findings = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line, index) => {
    if (conflictMarker.test(line)) {
      findings.push(`${path.relative(root, filePath)}:${index + 1}:${line}`);
    }
  });
}

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
      continue;
    }
    if (entry.isFile()) scanFile(fullPath);
  }
}

scanDir(root);

if (findings.length > 0) {
  console.error("Merge-Konfliktmarker gefunden:\n" + findings.join("\n"));
  process.exit(1);
}

console.log("Keine Merge-Konfliktmarker gefunden.");
