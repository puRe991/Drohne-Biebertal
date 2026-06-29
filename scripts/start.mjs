import { spawn } from 'node:child_process';
import process from 'node:process';
import { shouldRunLegacyIa32Mode, warnLegacyIa32Mode } from './platform.mjs';

const args = shouldRunLegacyIa32Mode()
  ? ['scripts/dev-legacy-ia32.mjs']
  : ['node_modules/next/dist/bin/next', 'start'];

if (shouldRunLegacyIa32Mode()) {
  warnLegacyIa32Mode('Starte deshalb den Legacy-Server mit oeffentlicher Website und Basis-CMS. Next.js-Produktion bitte auf 64-bit Node.js, WSL, Docker oder im Deployment betreiben.');
}

const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env, shell: false });
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
child.on('error', (error) => {
  console.error(`Start konnte nicht ausgefuehrt werden: ${error.message}`);
  process.exit(1);
});
