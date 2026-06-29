import { spawn } from 'node:child_process';
import process from 'node:process';

const isWin32Ia32 = process.platform === 'win32' && process.arch === 'ia32';
const command = process.execPath;
const args = isWin32Ia32 ? ['scripts/dev-legacy-ia32.mjs'] : ['node_modules/next/dist/bin/next', 'dev'];

if (isWin32Ia32) {
  console.warn('\n32-bit Windows/Node.js erkannt. Next.js 16 liefert keine win32/ia32-SWC-Binaerdatei.');
  console.warn('Starte deshalb den Legacy-Dev-Server mit oeffentlicher Website und Basis-CMS.\n');
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
