const requiredMajor = 20;
const maxMajorExclusive = 25;
const version = process.versions.node;
const major = Number(version.split('.')[0]);

const problems = [];
if (!Number.isInteger(major) || major < requiredMajor || major >= maxMajorExclusive) {
  problems.push(`Node.js ${version} ist nicht unterstuetzt. Bitte Node.js 20 LTS oder 22 LTS installieren.`);
}

if (process.platform === 'win32' && process.arch === 'ia32') {
  problems.push('Es wird 32-bit Node.js verwendet (win32/ia32). Bitte die 64-bit Windows-Version von Node.js installieren.');
}

if (problems.length > 0) {
  console.error('\nInstallation abgebrochen:\n');
  for (const problem of problems) console.error(`- ${problem}`);
  console.error('\nEmpfohlen: https://nodejs.org/ -> Windows Installer (.msi) 64-bit / x64, danach node_modules loeschen und npm install erneut ausfuehren.\n');
  process.exit(1);
}
