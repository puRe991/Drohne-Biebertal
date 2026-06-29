import { spawn } from 'node:child_process';
import process from 'node:process';
import { shouldRunLegacyIa32Mode, warnLegacyIa32Mode } from './platform.mjs';

const command = process.execPath;
const args = shouldRunLegacyIa32Mode() ? ['scripts/dev-legacy-ia32.mjs'] : ['node_modules/next/dist/bin/next', 'dev'];

if (shouldRunLegacyIa32Mode()) {
  warnLegacyIa32Mode('Starte deshalb den Legacy-Dev-Server mit oeffentlicher Website und Basis-CMS.');
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Dev-Server konnte nicht gestartet werden: ${error.message}`);
  process.exit(1);
});
