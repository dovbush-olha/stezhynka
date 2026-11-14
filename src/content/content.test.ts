import { describe, expect, it } from 'vitest';
import { BASE_LETTERS, LETTERS, NOT_YET_STUDIED, PLANNED_LETTERS, VOWELS_FIRST, UKRAINIAN_ALPHABET, isReadableWith, lettersOf, toUpper } from './alphabet';
import { GREETINGS, HINTS, INSTRUCTIONS, PHRASE_BUILD_INSTRUCTION, PHRASE_READ_INSTRUCTION, PRAISE, PRAISE_AFTER_HINT, PRAISE_READING_ALONE, PRAISE_READING_TOGETHER, TRY_AGAIN, instructionFor, readSplitHintFor } from './phrases';
import { validateMission } from './validate';
import { COURSE, COURSE_MISSIONS, COURSE_STAGES, LEGACY_MISSION_IDS, introMissions, isVowelStage, stageMissions } from './course';
import type { Exercise, LetterId } from './types';
import { ALL_WORDS, getWord, isPhrase, syllablesOf, wordsOf } from './words';

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

  // Чи вміщається фраза для складання на екрані телефона 390×844 без прокрутки, рахуємо за розкладом із play.css:
  // віконця фрази - не більше двох рядків, картки складів - не більше двох рядків (у дрібнішій довгій фразі - трьох).
  // Ширину складу дає таблиця ширин букв, тож тест ловить і рядок, якому не вистачає кількох пікселів («У Ірини»).
  // Змінюючи розміри віконець чи карток у play.css, оновіть і числа нижче.
  const PHONE_FONT_PX = 0.09 * 390; // склад на картці й у віконці: 9vw
  const LETTER_SPACING_EM = 0.04;
  const PHONE_ROW_PX = 338; // ширина рядка віконець і карток у вправі
  // Ширини букв шрифту Nunito (жирність 800) в em, виміряні в браузері.
  const GLYPH_EM: Readonly<Record<string, number>> = {
    А: 0.753, Б: 0.68, В: 0.695, Г: 0.569, Ґ: 0.569, Д: 0.811, Е: 0.605, Є: 0.684, Ж: 1.041, З: 0.632, И: 0.753,
    І: 0.297, Ї: 0.297, Й: 0.753, К: 0.695, Л: 0.758, М: 0.876, Н: 0.78, О: 0.796, П: 0.772, Р: 0.664, С: 0.684,
    Т: 0.632, У: 0.671, Ф: 0.908, Х: 0.685, Ц: 0.824, Ч: 0.708, Ш: 1.08, Щ: 1.131, Ь: 0.68, Ю: 1.067, Я: 0.699,
    а: 0.573, б: 0.604, в: 0.581, г: 0.471, ґ: 0.471, д: 0.633, е: 0.565, є: 0.524, ж: 0.852, з: 0.533, и: 0.616,
    і: 0.284, ї: 0.284, й: 0.616, к: 0.579, л: 0.61, м: 0.7, н: 0.62, о: 0.604, п: 0.617, р: 0.626, с: 0.494,
    т: 0.49, у: 0.549, ф: 0.864, х: 0.575, ц: 0.638, ч: 0.587, ш: 0.851, щ: 0.884, ь: 0.563, ю: 0.844, я: 0.574,
    "'": 0.256,
  };
  const PHRASE_LAYOUT = {
    // Звичайна фраза: віконця сталої ширини 24vw.
    regular: { slotMin: 0.24 * 390, slotExtra: 2 * 3, slotGap: 8, wordGap: 24, slotsPadding: 10, slotRows: 2,
      tileMin: 0.25 * 390, tileExtra: 2 * (10 + 3), tileGap: 10, tileRows: 2 },
    // Довга фраза (exercise--compact): віконце завширшки зі свій склад, усе дрібніше.
    compact: { slotMin: 68, slotExtra: 2 * (4 + 3), slotGap: 8, wordGap: 20, slotsPadding: 8, slotRows: 2,
      tileMin: 74, tileExtra: 2 * (8 + 3), tileGap: 8, tileRows: 3 },
  };

  /** Ширина складу в пікселях - великими буквами чи як пишеться, що ширше. */
  const syllablePx = (text: string) =>
    Math.max(
      ...[text, toUpper(text)].map((t) =>
        [...t].reduce((px, ch) => {
          expect(GLYPH_EM[ch], `немає ширини букви «${ch}»`).toBeDefined();
          return px + (GLYPH_EM[ch] + LETTER_SPACING_EM) * PHONE_FONT_PX;
        }, 0),
      ),
    );

  /** Скільки рядків займуть блоки, коли переносяться, як flex-wrap. */
  const rowsOf = (widths: readonly number[], gap: number, room: number) => {
    let rows = 0;
    let line = Infinity;
    for (const w of widths) {
      if (w > room) return Infinity;
      if (line + gap + w <= room) line += gap + w;
      else [rows, line] = [rows + 1, w];
    }
    return rows;
  };

  it.each(
    COURSE_MISSIONS.flatMap((m) =>
      m.exercises.flatMap((e) => (e.kind === 'build-word' && isPhrase(getWord(e.word)) ? [[m.id, e.word, e] as const] : [])),
    ),
  )('%s: фраза «%s» для складання вміщається на екрані телефона', (_id, _word, e) => {
    const entry = getWord(e.word);
    const tiles = [...syllablesOf(entry), ...e.distractors];
    // Як у BuildWord: від 7 карток або зі складом із 4 букв фраза дрібніша.
    const compact = tiles.length > 6 || tiles.some((t) => t.length > 3);
    const l = PHRASE_LAYOUT[compact ? 'compact' : 'regular'];

    // Віконце завширшки з найширший склад, який у нього може лягти, - з самого початку, ще порожнє.
    const words = wordsOf(entry).map((syllables) => {
      const slots = syllables.map((s) => {
        const text = syllablePx(s) + l.slotExtra;
        if (!compact) expect(text, `склад «${s}» не вміщається у віконце`).toBeLessThanOrEqual(l.slotMin);
        return Math.max(l.slotMin, text);
      });
      return slots.reduce((a, b) => a + b) + l.slotGap * (slots.length - 1);
    });
    const slotRows = rowsOf(words, l.wordGap, PHONE_ROW_PX - 2 * l.slotsPadding);
    expect(slotRows, `віконця фрази займуть ${slotRows} рядки, а вміщається ${l.slotRows}`).toBeLessThanOrEqual(l.slotRows);

    // Картки перемішані, тож рахуємо найгірший порядок: у кожен рядок, крім останнього, ляже щонайменше
    // стільки карток, скільки вміщається найширших.
    const widest = tiles.map((t) => Math.max(l.tileMin, syllablePx(t) + l.tileExtra)).sort((a, b) => b - a);
    let perRow = 0;
    while (perRow < widest.length && rowsOf(widest.slice(0, perRow + 1), l.tileGap, PHONE_ROW_PX) === 1) perRow++;
    const tileRows = Math.ceil(tiles.length / perRow);
    expect(tileRows, `${tiles.length} карток займуть до ${tileRows} рядків, а вміщається ${l.tileRows}`).toBeLessThanOrEqual(l.tileRows);
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

describe('підказка до читання', () => {
  it('для фрази каже про кожне слово фрази, а не про одне слово', () => {
    expect(readSplitHintFor({ kind: 'read-word', word: 'у мами' })).toBe(HINTS.readPhraseSplit);
    expect(readSplitHintFor({ kind: 'read-word', word: 'Міла мила' })).toBe(HINTS.readPhraseSplit);
    expect(readSplitHintFor({ kind: 'read-word', word: 'мама' })).toBe(HINTS.readWordSplit);
    expect(readSplitHintFor({ kind: 'read-syllable', syllable: 'ма' })).toBe(HINTS.readSplit);
    expect(HINTS.readPhraseSplit).toMatch(/кожне слово/);
    expect(HINTS.readWordSplit).not.toMatch(/кожне слово/);
  });
});

describe('підбадьорення після помилки', () => {
  // Після помилки звучить TRY_AGAIN, а одразу за ним - підказка (ChooseLetter, PickByEar, PickPicture, BuildWord).
  const hintsAfterMistake = [
    HINTS.listenAgain,
    HINTS.earWrong,
    HINTS.pickWrong,
    HINTS.buildNext,
    HINTS.buildNextMiddle,
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
