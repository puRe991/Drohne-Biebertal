import { execFileSync } from "node:child_process";
import fs from "node:fs";

const conflictMarker = /^(<<<<<<<|=======|>>>>>>>)($|\s)/;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

const unmerged = git(["ls-files", "-u"]).trim();
if (unmerged) {
  console.error(
    "Unaufgelöste Merge-Einträge im Git-Index gefunden:\n" + unmerged,
  );
  process.exit(1);
}

const trackedFiles = git(["ls-files", "-z"]).split("\0").filter(Boolean);
const findings = [];

for (const filePath of trackedFiles) {
  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line, index) => {
    if (conflictMarker.test(line)) {
      findings.push(`${filePath}:${index + 1}:${line}`);
    }
  });
}

if (findings.length > 0) {
  console.error(
    "Merge-Konfliktmarker in versionierten Dateien gefunden:\n" +
      findings.join("\n"),
  );
  process.exit(1);
}

console.log(
  `Keine Merge-Konflikte in ${trackedFiles.length} versionierten Dateien gefunden.`,
);
