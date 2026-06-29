import process from 'node:process';

export function isWin32Ia32() {
  return process.platform === 'win32' && process.arch === 'ia32';
}

export function shouldRunLegacyIa32Mode() {
  return isWin32Ia32() || process.env.FORCE_LEGACY_IA32 === '1';
}

export function legacyIa32Reason() {
  if (isWin32Ia32()) return '32-bit Windows/Node.js erkannt';
  if (process.env.FORCE_LEGACY_IA32 === '1') return '32-bit-Windows-Modus per FORCE_LEGACY_IA32=1 erzwungen';
  return '32-bit-Windows-Modus aktiv';
}

export function warnLegacyIa32Mode(action) {
  console.warn(`\n${legacyIa32Reason()}. Next.js 16 liefert keine win32/ia32-SWC-Binaerdatei.`);
  console.warn(`${action}\n`);
}
