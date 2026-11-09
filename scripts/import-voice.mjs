#!/usr/bin/env node
/**
 * Вбудований голос «Стежинки»: записи дорослого з файлу збереження стають голосом для всіх.
 *
 *   npm run voice:import -- ~/Downloads/stezhynka-Майя-2026-11-09.json
 *
 * Кожен запис чиститься (ffmpeg): обрізаємо тишу й клацання кнопки по краях, прибираємо гул,
 * вирівнюємо гучність до -16 LUFS. Результат:
 *   public/voice/<хеш>.m4a           - самі звуки; назва з хешу вмісту, тож кеш не застаріває;
 *   public/voice/index.json          - список файлів для офлайн-кешу (sw.js);
 *   src/content/builtinVoice.ts      - ключ запису → файл.
 * Попередній вбудований голос замінюється повністю. Записи читання дитини та прогрес не беруться.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VOICE_DIR = join(ROOT, 'public', 'voice');
const MANIFEST = join(ROOT, 'src', 'content', 'builtinVoice.ts');

const TARGET_LUFS = -16;
const SILENCE = 'silencedetect=n=-40dB:d=0.12';
const CLEANUP = 'highpass=f=70,afftdn=nf=-55';

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (r.error) throw new Error('Потрібен ffmpeg (brew install ffmpeg).');
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stderr;
}

/** Відрізки, де є звук (а не тиша). */
function speechSegments(file) {
  const log = ffmpeg(['-i', file, '-af', `highpass=f=70,${SILENCE}`, '-f', 'null', '-']);
  const duration = Number(/Duration: \d+:\d+:([\d.]+)/.exec(log)[1]);
  const silences = [];
  let start = null;
  for (const [, kind, t] of log.matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (kind === 'start') {
      start = Math.max(Number(t), 0);
    } else {
      silences.push([start, Number(t)]);
      start = null;
    }
  }
  if (start !== null) silences.push([start, duration]);
  const segments = [];
  let pos = 0;
  for (const [a, b] of silences) {
    if (a - pos > 0.02) segments.push([pos, a]);
    pos = b;
  }
  if (duration - pos > 0.02) segments.push([pos, duration]);
  return { duration, segments };
}

/** Межі запису без тиші та клацань: короткі сплески далеко від голосу - це кнопка чи подих. */
function speechBounds({ duration, segments }) {
  let kept = segments.filter(([a, b]) => b - a >= 0.1);
  if (!kept.length) kept = segments.length ? segments : [[0, duration]];
  const short = ([a, b]) => b - a < 0.2;
  while (kept.length > 1 && short(kept[0]) && kept[1][0] - kept[0][1] > 0.3) kept = kept.slice(1);
  while (kept.length > 1 && short(kept.at(-1)) && kept.at(-1)[0] - kept.at(-2)[1] > 0.3) kept = kept.slice(0, -1);
  return [Math.max(0, kept[0][0] - 0.08), Math.min(duration, kept.at(-1)[1] + 0.15)];
}

function clean(src, dst) {
  const [a, b] = speechBounds(speechSegments(src));
  const base = `atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=N/SR/TB,${CLEANUP}`;
  const loudness = Number([...ffmpeg(['-i', src, '-af', `${base},ebur128`, '-f', 'null', '-']).matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)[1]);
  const gain = Math.max(-12, Math.min(12, TARGET_LUFS - loudness));
  const length = b - a;
  const filters = [
    base,
    `volume=${gain.toFixed(2)}dB`,
    'alimiter=limit=0.89:level=false',
    'afade=t=in:d=0.015',
    `afade=t=out:st=${Math.max(0, length - 0.04).toFixed(3)}:d=0.04`,
  ].join(',');
  ffmpeg(['-y', '-i', src, '-af', filters, '-ac', '1', '-ar', '48000', '-c:a', 'aac', '-b:a', '128k', '-map_metadata', '-1', dst]);
}

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('Вкажіть файл збереження: npm run voice:import -- <файл.json>');
  process.exit(1);
}
const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
if (backup.app !== 'stezhynka' || !Array.isArray(backup.recordings)) {
  console.error('Це не файл збереження «Стежинки».');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'stezhynka-voice-'));
rmSync(VOICE_DIR, { recursive: true, force: true });
mkdirSync(VOICE_DIR, { recursive: true });
const entries = [];
try {
  for (const [i, r] of backup.recordings.entries()) {
    const src = join(work, `${i}.in`);
    const out = join(work, `${i}.m4a`);
    writeFileSync(src, Buffer.from(r.data, 'base64'));
    clean(src, out);
    const bytes = readFileSync(out);
    const file = `${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}.m4a`;
    writeFileSync(join(VOICE_DIR, file), bytes);
    entries.push([r.key, file]);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

entries.sort(([a], [b]) => a.localeCompare(b, 'uk'));
writeFileSync(join(VOICE_DIR, 'index.json'), `${JSON.stringify(entries.map(([, f]) => f))}\n`);
writeFileSync(
  MANIFEST,
  [
    '// Згенеровано scripts/import-voice.mjs - не редагуйте вручну.',
    '/** Вбудований голос: ключ запису → файл у public/voice. */',
    'export const BUILTIN_VOICE: Readonly<Record<string, string>> = {',
    ...entries.map(([k, f]) => `  '${k.replaceAll("'", "\\'")}': '${f}',`),
    '};',
    '',
  ].join('\n'),
);
const size = readdirSync(VOICE_DIR).reduce((s, f) => s + readFileSync(join(VOICE_DIR, f)).length, 0);
console.log(`Готово: ${entries.length} записів, ${(size / 1024 / 1024).toFixed(1)} МБ.`);
