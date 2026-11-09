import { describe, expect, it } from 'vitest';
import { BackupError, backupFileName, base64ToBytes, bytesToBase64, parseBackup } from './backup';
import { createInitialState } from './progress';

const TODAY = '2026-11-09';

function file(extra: Record<string, unknown> = {}) {
  const progress = createInitialState(TODAY);
  progress.stars = 12;
  progress.settings.child = { name: 'Андрій', vocative: 'Андрію', gender: 'boy' };
  return JSON.stringify({
    app: 'stezhynka',
    format: 1,
    savedAt: '2026-11-09T10:00:00.000Z',
    progress,
    recordings: [{ key: 'sound:М', type: 'audio/mp4', data: bytesToBase64(new Uint8Array([1, 2, 3])) }],
    readings: [{ id: 'r1', text: 'ма', at: '2026-11-08T10:00:00.000Z', type: 'audio/mp4', data: 'AAE=' }],
    ...extra,
  });
}

describe('файл збереження', () => {
  it('читає прогрес, ім’я й записи', () => {
    const b = parseBackup(file(), TODAY);
    expect(b.progress.stars).toBe(12);
    expect(b.progress.settings.child?.name).toBe('Андрій');
    expect(b.recordings).toHaveLength(1);
    expect([...base64ToBytes(b.recordings[0].data)]).toEqual([1, 2, 3]);
    expect(b.readings[0].text).toBe('ма');
  });

  it('пропускає пошкоджені записи, але не весь файл', () => {
    const b = parseBackup(file({ recordings: [{ key: 'x' }, 'сміття'], readings: null }), TODAY);
    expect(b.recordings).toEqual([]);
    expect(b.readings).toEqual([]);
    expect(b.progress.stars).toBe(12);
  });

  it.each([
    ['не JSON', 'привіт'],
    ['чужий файл', JSON.stringify({ name: 'package' })],
    ['без прогресу', JSON.stringify({ app: 'stezhynka', format: 1 })],
    ['з новішої версії', JSON.stringify({ app: 'stezhynka', format: 99, progress: {} })],
  ])('відмовляє зрозуміло: %s', (_, text) => {
    expect(() => parseBackup(text, TODAY)).toThrow(BackupError);
  });

  it('великі записи не ламають base64', () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });

  it('назва файлу з ім’ям і датою', () => {
    expect(backupFileName({ name: 'Майя', vocative: 'Майє', gender: 'girl' }, new Date(2026, 10, 9))).toBe('stezhynka-Майя-2026-11-09.json');
    expect(backupFileName(null, new Date(2026, 10, 9))).toBe('stezhynka-2026-11-09.json');
  });
});
