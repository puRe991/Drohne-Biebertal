const requiredMajor = 20;
const maxMajorExclusive = 25;
const version = process.versions.node;
const major = Number(version.split('.')[0]);

const problems = [];
const warnings = [];
if (!Number.isInteger(major) || major < requiredMajor || major >= maxMajorExclusive) {
  problems.push(`Node.js ${version} ist nicht unterstuetzt. Bitte Node.js 20 LTS oder 22 LTS installieren.`);
}

if (process.platform === 'win32' && process.arch === 'ia32') {
  warnings.push('Es wird 32-bit Node.js verwendet (win32/ia32). npm install wird fortgesetzt, aber npm run dev startet nur den Legacy-Vorschau-Server ohne CMS.');
}

if (warnings.length > 0) {
  console.warn('\nHinweis zur Installation:\n');
  for (const warning of warnings) console.warn(`- ${warning}`);
  console.warn('\nEmpfohlen fuer volle Next.js/CMS-Funktion: 64-bit Node.js, WSL, Docker oder Deployment nutzen.\n');
}

if (problems.length > 0) {
  console.error('\nInstallation abgebrochen:\n');
  for (const problem of problems) console.error(`- ${problem}`);
  console.error('\nEmpfohlen: https://nodejs.org/ -> Node.js 20 LTS oder 22 LTS installieren, danach node_modules loeschen und npm install erneut ausfuehren.\n');
  process.exit(1);
}
