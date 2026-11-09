import { describe, expect, it } from 'vitest';
import { LEGACY_CHILD, guessVocative, isChild, personalize, tidyName, type Child } from './child';
import { normalizeState } from '../logic/progress';

const ANDRII: Child = { name: 'Андрій', vocative: 'Андрію', gender: 'boy' };

describe('personalize', () => {
  it('підставляє ім’я, звертання і слово для дівчинки чи хлопчика', () => {
    const text = 'Привіт, {voc}! {name} {прочитала сама|прочитав сам}.';
    expect(personalize(text, LEGACY_CHILD)).toBe('Привіт, Майє! Майя прочитала сама.');
    expect(personalize(text, ANDRII)).toBe('Привіт, Андрію! Андрій прочитав сам.');
  });

  it('не чіпає текст без маркерів', () => {
    expect(personalize('Знайди таку саму букву.', ANDRII)).toBe('Знайди таку саму букву.');
  });
});

describe('guessVocative', () => {
  it.each([
    ['Майя', 'girl', 'Майє'],
    ['Марія', 'girl', 'Маріє'],
    ['Оля', 'girl', 'Олю'],
    ['Олена', 'girl', 'Олено'],
    ['Даша', 'girl', 'Даше'],
    ['Злата', 'girl', 'Злато'],
    ['Ілля', 'boy', 'Ілле'],
    ['Андрій', 'boy', 'Андрію'],
    ['Василь', 'boy', 'Василю'],
    ['Іван', 'boy', 'Іване'],
    ['Максим', 'boy', 'Максиме'],
    ['Олег', 'boy', 'Олегу'],
    ['Марко', 'boy', 'Марку'],
    ['Петро', 'boy', 'Петре'],
    ['Микола', 'boy', 'Миколо'],
    ['Саша', 'boy', 'Саше'],
  ] as const)('%s → %s', (name, gender, vocative) => {
    expect(guessVocative(name, gender)).toBe(vocative);
  });
});

describe('профіль дитини в збереженому прогресі', () => {
  it('ім’я з великої літери і без зайвих пробілів', () => {
    expect(tidyName('  андрій  ')).toBe('Андрій');
  });

  it('відкидає неповний профіль', () => {
    expect(isChild({ name: ' ', vocative: 'А', gender: 'boy' })).toBe(false);
    expect(isChild({ name: 'Ліза', vocative: 'Лізо', gender: 'cat' })).toBe(false);
  });

  it('прогрес, збережений до появи профілю, належить Майї', () => {
    expect(normalizeState({ version: 1, settings: { theme: 'night' } }).settings.child).toEqual(LEGACY_CHILD);
  });

  it('новий користувач, який ще не познайомився, лишається без профілю', () => {
    expect(normalizeState({ version: 1, settings: { child: null } }).settings.child).toBeNull();
  });

  it('зберігає профіль іншої дитини', () => {
    expect(normalizeState({ version: 1, settings: { child: ANDRII } }).settings.child).toEqual(ANDRII);
  });
});

describe('маркери в текстах', () => {
  it('усі фрази й поради після підстановки без зайвих дужок', async () => {
    const phrases = await import('./phrases');
    const { COURSE_MISSIONS } = await import('./course');
    const texts = [
      ...Object.values(phrases).flatMap((v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : typeof v === 'object' ? Object.values(v) : [])),
      ...COURSE_MISSIONS.map((m) => m.adultNote),
    ].filter((t): t is string => typeof t === 'string');
    expect(texts.length).toBeGreaterThan(40);
    for (const child of [LEGACY_CHILD, ANDRII]) {
      for (const t of texts) expect(personalize(t, child), t).not.toMatch(/[{}|]/);
    }
  });
});
