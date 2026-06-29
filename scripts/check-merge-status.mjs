import { execFileSync } from "node:child_process";

const conflictPaths = [
  "README.md",
  "app/admin/actions.ts",
  "app/admin/page.tsx",
  "lib/auth.ts",
  "lib/content.ts",
  "package-lock.json",
  "package.json",
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

const status = git(["status", "--porcelain=v1", "-uall"]);
const unmergedStatus = status
  .split("\n")
  .filter((line) => /^(DD|AU|UD|UA|DU|AA|UU)\s/.test(line));

if (unmergedStatus.length > 0) {
  console.error("Unaufgelöste Merge-Konflikte im Arbeitsbaum gefunden:");
  console.error(unmergedStatus.join("\n"));
  process.exit(1);
}

const unmergedIndex = git(["ls-files", "-u"]).trim();
if (unmergedIndex) {
  console.error("Unaufgelöste Merge-Einträge im Index gefunden:");
  console.error(unmergedIndex);
  process.exit(1);
}

const trackedFiles = new Set(
  git(["ls-files"]).trim().split("\n").filter(Boolean),
);
const missingConflictFiles = conflictPaths.filter(
  (filePath) => !trackedFiles.has(filePath),
);

if (missingConflictFiles.length > 0) {
  console.error("Erwartete Konfliktdateien fehlen im Branch:");
  console.error(missingConflictFiles.join("\n"));
  process.exit(1);
}

console.log(
  "Merge-Status sauber: keine unaufgelösten Dateien, Index-Einträge oder fehlenden Konfliktdateien.",
);
