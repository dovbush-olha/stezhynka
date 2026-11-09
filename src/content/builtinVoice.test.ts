import { describe, expect, it } from 'vitest';
import { hasBuiltinVoice, hasRecording } from '../audio/recordings';
import { COURSE_MISSIONS } from './course';
import { UKRAINIAN_ALPHABET } from './alphabet';
import { BUILTIN_VOICE } from './builtinVoice';
import { sayKey, soundKey, voiceItems } from '../logic/voice';

/** Що лежить у public/voice: назви файлів і список для офлайн-кешу. */
const onDisk = Object.keys(import.meta.glob('../../public/voice/*.m4a')).map((p) => p.split('/').pop());
const index = Object.values(import.meta.glob<string[]>('../../public/voice/index.json', { eager: true, import: 'default' }))[0];

describe('вбудований голос', () => {
  const files = Object.values(BUILTIN_VOICE);

  it('кожен файл з переліку лежить у public/voice', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(onDisk, f).toContain(f);
  });

  it('index.json для офлайн-кешу збігається з переліком, зайвих файлів немає', () => {
    expect([...index].sort()).toEqual([...files].sort());
    expect([...onDisk].sort()).toEqual([...new Set(files)].sort());
  });

  it('кожен ключ - те, що застосунок справді просить відтворити', () => {
    const { syllables, words } = voiceItems(UKRAINIAN_ALPHABET, COURSE_MISSIONS);
    const asked = new Set([...UKRAINIAN_ALPHABET.map(soundKey), ...[...syllables, ...words].map(sayKey)]);
    for (const key of Object.keys(BUILTIN_VOICE)) expect(asked.has(key), key).toBe(true);
  });

  it('звучить і без своїх записів дорослого', () => {
    expect(hasBuiltinVoice(soundKey('М'))).toBe(true);
    expect(hasRecording(soundKey('М'))).toBe(true);
    expect(hasRecording(sayKey('мама'))).toBe(true);
    expect(hasRecording('say:немає-такого')).toBe(false);
  });
});
