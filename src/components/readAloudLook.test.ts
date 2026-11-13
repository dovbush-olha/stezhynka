import { describe, expect, it } from 'vitest';
import { readAloudLook } from './readAloudLook';

const PHASES = ['idle', 'starting', 'recording', 'hearing'] as const;

describe('readAloudLook', () => {
  it('кожен стан запису має власний вигляд кнопки: дитина, яка ще не читає, розрізняє їх без підпису', () => {
    const looks = PHASES.map((p) => readAloudLook(p, false).icon);
    expect(new Set(looks).size).toBe(PHASES.length);
  });

  it('натиснути можна лише щоб почати й щоб зупинити запис: поки мікрофон вмикається і поки дитина чує себе - ні', () => {
    expect(PHASES.filter((p) => readAloudLook(p, false).pressable)).toEqual(['idle', 'recording']);
  });

  it('підпис під кнопкою каже дорослому, що зараз робити', () => {
    expect(PHASES.map((p) => readAloudLook(p, false).caption)).toEqual([
      'Натисни й читай уголос',
      'Зачекай…',
      'Читай! Коли все - натисни ■',
      'Послухай себе',
    ]);
  });

  it('коли дитина каже звук букви, підпис - про звук, а не про читання', () => {
    expect(PHASES.map((p) => readAloudLook(p, true).caption)).toEqual([
      'Натисни й скажи звук',
      'Зачекай…',
      'Кажи! Коли все - натисни ■',
      'Послухай себе',
    ]);
  });
});
