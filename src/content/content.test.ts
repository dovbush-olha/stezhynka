import { describe, expect, it } from 'vitest';
import { BASE_LETTERS, LETTERS, NOT_YET_STUDIED, PLANNED_LETTERS, VOWELS_FIRST, UKRAINIAN_ALPHABET, isReadableWith, lettersOf } from './alphabet';
import { GREETINGS, HINTS, INSTRUCTIONS, PHRASE_BUILD_INSTRUCTION, PHRASE_READ_INSTRUCTION, PRAISE, PRAISE_AFTER_HINT, PRAISE_READING_ALONE, PRAISE_READING_TOGETHER, TRY_AGAIN, instructionFor } from './phrases';
import { validateMission } from './validate';
import { COURSE, COURSE_MISSIONS, COURSE_STAGES, LEGACY_MISSION_IDS, introMissions, isVowelStage, stageMissions } from './course';
import type { Exercise, LetterId } from './types';
import { ALL_WORDS, getWord, isPhrase, syllablesOf } from './words';

describe('абетка', () => {
  it('містить 33 українські букви кирилицею', () => {
    expect(UKRAINIAN_ALPHABET).toHaveLength(33);
    for (const l of UKRAINIAN_ALPHABET) {
      expect(l.codePointAt(0)!, `«${l}» має бути кирилицею`).toBeGreaterThanOrEqual(0x400);
      expect(l.codePointAt(0)!).toBeLessThanOrEqual(0x4ff);
      expect(LETTERS[l].id).toBe(l);
    }
  });

  it('відкидає латинські двійники букв', () => {
    expect(() => lettersOf('MA')).toThrow(); // латинські M і A
    expect(() => lettersOf('Iм')).toThrow(); // латинська I
    expect(lettersOf('мама')).toEqual(['М', 'А', 'М', 'А']);
  });

  it('підказки про форму не називають букву (синтезатор прочитав би назву, а не звук)', () => {
    for (const info of Object.values(LETTERS)) {
      expect(info.shapeHint).not.toMatch(new RegExp(`(^|[\\s«(])${info.id}([\\s».,!?)]|$)`));
    }
  });
});

describe('банк слів', () => {
  it.each(ALL_WORDS.map((w) => [w.text, w] as const))('«%s»: склади складаються в слово', (_text, w) => {
    expect(w.split.replace(/-/g, '')).toBe(w.text);
    if (w.clear) expect(isPhrase(w), 'картинка-підказка лише для окремих слів').toBe(false);
    expect(() => lettersOf(w.text)).not.toThrow();
    expect(w.picture.length).toBeGreaterThan(0);
  });

  it('не містить Я, Ю, Є, Ї', () => {
    for (const w of ALL_WORDS) {
      expect(lettersOf(w.text).filter((l) => NOT_YET_STUDIED.includes(l)), w.text).toEqual([]);
    }
  });
});

describe('план місій', () => {
  it('день має 2-3 місії: перша місія дня навчає, наступні закріплюють', () => {
    COURSE.forEach((day, i) => {
      expect(day.day).toBe(i + 1);
      expect(day.missions.length).toBeGreaterThanOrEqual(2);
      expect(day.missions.length).toBeLessThanOrEqual(3);
      expect(day.missions.map((m) => m.order)).toEqual(day.missions.map((_, j) => j + 1));
      for (const m of day.missions.slice(1)) expect(m.goal).toBe('reinforce');
      for (const m of day.missions) expect(m.day).toBe(day.day);
    });
  });

  it('ідентифікатори місій і наліпки унікальні', () => {
    const ids = COURSE_MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stickers = COURSE_MISSIONS.map((m) => m.sticker);
    expect(new Set(stickers).size).toBe(stickers.length);
  });

  it('старі ідентифікатори ведуть на наявні місії, кожен на свою', () => {
    const targets = Object.values(LEGACY_MISSION_IDS);
    expect(new Set(targets).size).toBe(targets.length);
    for (const id of targets) expect(COURSE_MISSIONS.some((m) => m.id === id), id).toBe(true);
  });

  /** Дні кожної приголосної: від дня, що її вводить, до дня наступної. */
  const consonantDays = (() => {
    const groups = new Map<LetterId, typeof COURSE>();
    let current: LetterId | undefined;
    for (const day of COURSE) {
      const fresh = day.missions[0].newLetters?.find((l) => LETTERS[l].kind === 'consonant');
      if (fresh) current = fresh;
      if (current) groups.set(current, [...(groups.get(current) ?? []), day]);
    }
    return groups;
  })();

  it('перший день - лише голосні, далі першою приголосною йде Л', () => {
    for (const m of COURSE[0].missions) expect([...m.requires].sort()).toEqual([...VOWELS_FIRST].sort());
    expect([...consonantDays.keys()]).toEqual(['Л', 'М', 'С', 'Н', 'К', 'В', 'П', 'Р']);
    for (const m of consonantDays.get('Л')!.flatMap((d) => d.missions)) {
      expect([...m.requires].sort()).toEqual([...VOWELS_FIRST, 'Л'].sort());
    }
  });

  it('кожна приголосна має стільки ж днів і місій, скільки Л', () => {
    const l = consonantDays.get('Л')!;
    for (const [letter, days] of consonantDays) {
      expect(days.length, letter).toBe(l.length);
      expect(days.flatMap((d) => d.missions).length, letter).toBe(l.flatMap((d) => d.missions).length);
    }
  });

  const exercisesOf = (day: (typeof COURSE)[number]) => day.missions.flatMap((m) => m.exercises);
  const singleWords = (exs: Exercise[]) =>
    exs.flatMap((e) => ((e.kind === 'read-word' || e.kind === 'build-word') && !isPhrase(getWord(e.word)) ? [e.word] : []));

  it('нову приголосну багато разів з’єднуємо з голосними, перш ніж читати слова', () => {
    for (const day of COURSE.filter((d) => d.missions[0].newLetters?.some((l) => LETTERS[l].kind === 'consonant'))) {
      const exs = exercisesOf(day);
      expect(exs.filter((e) => e.kind === 'blend').length, `день ${day.day}`).toBeGreaterThanOrEqual(4);
      expect(exs.filter((e) => e.kind === 'read-syllable').length, `день ${day.day}`).toBeGreaterThanOrEqual(6);
      const learn = day.missions[0].exercises;
      expect(singleWords(learn), `день ${day.day}: перша місія - лише склади`).toEqual([]);
    }
  });

  it('кожен день з приголосною має багато окремих слів (крім першого дня з Л)', () => {
    for (const day of COURSE.slice(2)) {
      expect(new Set(singleWords(exercisesOf(day))).size, `день ${day.day}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('перші два дні кожної приголосної - лише короткі слова, до двох складів', () => {
    for (const [letter, days] of consonantDays) {
      for (const day of days.slice(0, 2)) {
        for (const w of singleWords(exercisesOf(day))) {
          expect(syllablesOf(getWord(w)).length, `${letter}, день ${day.day}: «${w}»`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('звук у місії з приголосною питаємо лише раз, і щодня - звук самої букви', () => {
    for (const [letter, days] of consonantDays) {
      for (const day of days) {
        for (const m of day.missions) {
          expect(m.exercises.filter((e) => e.kind === 'say-sound').length, m.id).toBe(1);
        }
        const said = exercisesOf(day).some((e) => e.kind === 'say-sound' && e.letter === letter);
        expect(said, `${letter}, день ${day.day}`).toBe(true);
      }
    }
  });

  it('якщо звук букви дня питаємо двічі за день, то і для великої, і для малої букви', () => {
    for (const [letter, days] of consonantDays) {
      for (const day of days) {
        const cases = exercisesOf(day).flatMap((e) => (e.kind === 'say-sound' && e.letter === letter ? [e.letterCase ?? 'upper'] : []));
        if (cases.length >= 2) expect(new Set(cases).size, `${letter}, день ${day.day}`).toBe(2);
      }
    }
  });

  it('щодня дитина сама згадує звук И', () => {
    for (const day of COURSE) {
      expect(exercisesOf(day).some((e) => e.kind === 'say-sound' && e.letter === 'И'), `день ${day.day}`).toBe(true);
    }
  });

  it('фрази - лише в останній місії дня і після багатьох окремих слів', () => {
    for (const day of COURSE) {
      day.missions.forEach((m, i) => {
        const firstPhrase = m.exercises.findIndex((e) => (e.kind === 'read-word' || e.kind === 'build-word') && isPhrase(getWord(e.word)));
        if (firstPhrase === -1) return;
        expect(i, `${m.id}: фраза не в останній місії дня`).toBe(day.missions.length - 1);
        const before = [...day.missions.slice(0, i).flatMap((x) => x.exercises), ...m.exercises.slice(0, firstPhrase)];
        expect(singleWords(before).length, `${m.id}: замало слів перед першою фразою`).toBeGreaterThanOrEqual(6);
      });
    }
  });

  it('фрази й складаємо зі складів: щодня з фразами - хоча б дві', () => {
    for (const day of COURSE) {
      const exs = exercisesOf(day);
      const phrases = exs.filter((e) => e.kind === 'read-word' && isPhrase(getWord(e.word)));
      if (!phrases.length) continue;
      const built = exs.filter((e) => e.kind === 'build-word' && isPhrase(getWord(e.word)));
      expect(built.length, `день ${day.day}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('щодня від дня 2 складаємо хоча б три слова чи фрази', () => {
    for (const day of COURSE.slice(1)) {
      expect(exercisesOf(day).filter((e) => e.kind === 'build-word').length, `день ${day.day}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('від дня 2 у кожній місії є «послухай і вибери»', () => {
    for (const m of COURSE.slice(1).flatMap((d) => d.missions)) {
      expect(m.exercises.some((e) => e.kind === 'pick-by-ear'), m.id).toBe(true);
    }
  });

  it('з Л багато слів без подвоєних букв: кожен склад - два звуки', () => {
    const lWords = new Set(singleWords(consonantDays.get('Л')!.flatMap(exercisesOf)));
    const plain = [...lWords].filter((w) => !/(.)\1/iu.test(w));
    expect(plain.length).toBeGreaterThanOrEqual(10);
  });

  it.each(COURSE_MISSIONS.map((m) => [m.id, m] as const))('%s: усі слова й склади з доступних букв', (_id, m) => {
    expect(validateMission(m)).toEqual([]);
  });

  it('нові букви з’являються поступово і лише з плану', () => {
    const introduced = COURSE_MISSIONS.flatMap((m) => m.newLetters ?? []);
    expect(introduced).toEqual(['Е', 'И', 'Л', 'М', 'С', 'Н', 'К', 'В', 'П', 'Р']);
  });

  it('кожна місія плану належить рівно одному етапу, і етапи йдуть у порядку плану', () => {
    const inStages = COURSE_STAGES.flatMap((s) => stageMissions(s).map((m) => m.id));
    expect(inStages).toEqual(COURSE_MISSIONS.map((m) => m.id));
    expect(new Set(COURSE_STAGES.map((s) => s.id)).size).toBe(COURSE_STAGES.length);
  });

  it('етапи - голосні, а далі по одному на кожну приголосну плану; кожен знайомить зі своїми буквами', () => {
    expect(COURSE_STAGES.map((s) => s.letters)).toEqual([VOWELS_FIRST, ['Л'], ...PLANNED_LETTERS.map((l) => [l])]);
    for (const s of COURSE_STAGES) {
      // Розминка й автоматичне відкриття спираються на те, що букву етапу вимагають усі його місії.
      for (const m of stageMissions(s)) expect(m.requires, m.id).toEqual(expect.arrayContaining(s.letters));
    }
  });

  it('у кожному етапі приголосної є день знайомства - перший день етапу, з місією, що вчить букву', () => {
    for (const s of COURSE_STAGES) {
      if (isVowelStage(s)) {
        expect(s.introDay, s.id).toBeUndefined();
        continue;
      }
      expect(s.introDay, s.id).toBe(s.days[0].day);
      expect(s.days.length, s.id).toBeGreaterThan(1);
      expect(introMissions(s)[0].newLetters, s.id).toEqual(s.letters);
    }
  });

  it('кожне слово й фразу з банку, які можна прочитати буквами плану, дитина хоча б раз читає в місії', () => {
    const read = new Set(COURSE_MISSIONS.flatMap((m) => m.exercises.flatMap((e) => (e.kind === 'read-word' || e.kind === 'build-word' ? [e.word] : []))));
    // Слова з буквами поза планом (тато, дім) - для вільної практики, коли дорослий відкриє інші букви.
    const planned = ALL_WORDS.filter((w) => isReadableWith(w.text, [...BASE_LETTERS, ...PLANNED_LETTERS]));
    expect(planned.map((w) => w.text).filter((t) => !read.has(t))).toEqual([]);
  });

  it('використовує всі види вправ', () => {
    const kinds = new Set(COURSE_MISSIONS.flatMap((m) => m.exercises.map((e) => e.kind)));
    // pick-picture не пишеться вручну - так перетворюється читання слова, щоб перевірити його без вимови
    expect([...kinds, 'pick-picture'].sort()).toEqual(Object.keys(INSTRUCTIONS).sort());
  });
});

describe('інструкція до вправи', () => {
  it('фразу просить читати слово за словом, а одне слово - по складах', () => {
    expect(instructionFor({ kind: 'read-word', word: 'у мами' })).toBe(PHRASE_READ_INSTRUCTION);
    expect(instructionFor({ kind: 'read-word', word: 'Міла мила' })).toBe(PHRASE_READ_INSTRUCTION);
    expect(instructionFor({ kind: 'read-word', word: 'мама' })).toBe(INSTRUCTIONS['read-word']);
  });

  it('фразу просить складати слово за словом, а одне слово - просто зі складів', () => {
    expect(instructionFor({ kind: 'build-word', word: 'Ми малі', distractors: [] })).toBe(PHRASE_BUILD_INSTRUCTION);
    expect(instructionFor({ kind: 'build-word', word: 'лама', distractors: [] })).toBe(INSTRUCTIONS['build-word']);
  });
});

describe('підбадьорення після помилки', () => {
  // Після помилки звучить TRY_AGAIN, а одразу за ним - підказка (ChooseLetter, PickByEar, PickPicture, BuildWord).
  const hintsAfterMistake = [
    HINTS.listenAgain,
    HINTS.earWrong,
    HINTS.pickWrong,
    HINTS.buildNext,
    ...Object.values(LETTERS).map((l) => `Подивись: ${l.shapeHint}`),
  ];
  const words = (s: string): string[] => s.toLocaleLowerCase('uk-UA').match(/[а-щьюяґєії']{2,}/gu) ?? [];

  it.each(TRY_AGAIN)('«%s» не повторює слів підказки, що звучить за ним', (cheer) => {
    for (const hint of hintsAfterMistake) {
      expect(words(cheer).filter((w) => words(hint).includes(w)), `${cheer} ${hint}`).toEqual([]);
    }
  });

  it.each(TRY_AGAIN)('«%s» не просить подивитися чи послухати: це каже підказка, а вправа може бути на слух', (cheer) => {
    expect(cheer).not.toMatch(/див|слух|уважн/iu);
  });
});

describe('фрази лисички', () => {
  const spoken = [
    ...Object.values(INSTRUCTIONS),
    PHRASE_BUILD_INSTRUCTION,
    PHRASE_READ_INSTRUCTION,
    ...Object.values(HINTS),
    ...PRAISE,
    ...PRAISE_AFTER_HINT,
    ...PRAISE_READING_ALONE,
    ...PRAISE_READING_TOGETHER,
    ...TRY_AGAIN,
    ...GREETINGS,
  ];
  // Однолітерні слова («а», «і», «я», «у»...) - звичайні слова, а не назви букв.
  const ONE_LETTER_WORDS = new Set(['А', 'І', 'Й', 'В', 'У', 'З', 'О', 'Я']);
  it.each(spoken)('«%s» не містить окремих назв букв', (phrase) => {
    const singles = phrase.match(/(?<=^|[\s«(])[А-ЩЬЮЯҐЄІЇ](?=[\s».,!?)]|$)/gu) ?? [];
    expect(singles.filter((s) => !ONE_LETTER_WORDS.has(s))).toEqual([]);
    expect(phrase).not.toMatch(/([Бб]укв|[Зз]вук)\S*\s+«?[А-ЩЬЮЯҐЄІЇ]([\s».,!?)]|$)/u);
  });
});
