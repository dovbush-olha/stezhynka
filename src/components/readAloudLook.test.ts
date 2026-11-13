import { describe, expect, it } from 'vitest';
import { readAloudLook } from './readAloudLook';

const PHASES = ['idle', 'starting', 'recording', 'hearing'] as const;

describe('readAloudLook', () => {
  it('кожен стан запису має власний вигляд кнопки: дитина, яка ще не читає, розрізняє їх без підпису', () => {
    const looks = PHASES.map((p) => readAloudLook(p, false).icon);
    expect(new Set(looks).size).toBe(PHASES.length);
  });

  it('натиснути можна лише щоб почати й щоб зупинити запис: поки мікрофон вмикається і поки дитина чує себе - ні', () => {
    expect(PHASES.map((p) => readAloudLook(p, false).action)).toEqual(['start', undefined, 'stop', undefined]);
  });

  it('читалка екрана називає «стоп» словом, а не значком ■', () => {
    expect(readAloudLook('recording', false).label).toBe('Читай! Коли все - натисни «стоп»');
    expect(readAloudLook('recording', true).label).toBe('Кажи! Коли все - натисни «стоп»');
    expect(readAloudLook('idle', false).label).toBe('Натисни й читай уголос');
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
