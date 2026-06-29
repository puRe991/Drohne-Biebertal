import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import process from 'node:process';
import { shouldRunLegacyIa32Mode, warnLegacyIa32Mode } from './platform.mjs';

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env, shell: false });
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Prozess durch Signal ${signal} beendet`));
      else resolve(code ?? 1);
    });
    child.on('error', reject);
  });
}

if (shouldRunLegacyIa32Mode()) {
  warnLegacyIa32Mode('Fuehre deshalb einen Legacy-Kompatibilitaetscheck aus statt next build. Fuer ein produktionsnahes Next.js-Build bitte 64-bit Node.js, WSL, Docker oder das Deployment nutzen.');
  const syntaxCheckCode = await runNode(['--check', 'scripts/dev-legacy-ia32.mjs']);
  if (syntaxCheckCode !== 0) process.exit(syntaxCheckCode);

  const rootDir = fileURLToPath(new URL('..', import.meta.url));
  const outDir = join(rootDir, '.next-legacy');
  await mkdir(outDir, { recursive: true });
  await copyFile(join(rootDir, 'scripts', 'dev-legacy-ia32.mjs'), join(outDir, 'server.mjs'));
  await writeFile(
    join(outDir, 'BUILD_INFO.json'),
    `${JSON.stringify({ mode: 'legacy-ia32', generatedAt: new Date().toISOString(), entrypoint: '.next-legacy/server.mjs', note: 'Next.js 16 has no win32/ia32 SWC binary; deploy this lightweight Node.js runtime with package.json, node_modules, data and public on 32-bit systems.' }, null, 2)}\n`,
    'utf8',
  );
  console.log('Legacy-Kompatibilitaetscheck abgeschlossen. Deploy-Artefakt: .next-legacy/server.mjs. npm start startet auf win32/ia32 den Legacy-Server.');
  process.exit(0);
}

process.exit(await runNode(['node_modules/next/dist/bin/next', 'build']));
