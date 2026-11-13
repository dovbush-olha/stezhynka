import { isVowel, type LetterId } from './alphabet';
import type { Day, Exercise, LetterCase, Mission, Stage } from './types';

// Короткі конструктори, щоб контент читався як план уроку.
const intro = (letter: LetterId): Exercise => ({ kind: 'intro-letter', letter });
const find = (target: LetterId, options: LetterId[], letterCase?: LetterCase): Exercise => ({
  kind: 'find-letter',
  target,
  options,
  letterCase,
});
const bySound = (target: LetterId, options: LetterId[], letterCase?: LetterCase): Exercise => ({
  kind: 'letter-by-sound',
  target,
  options,
  letterCase,
});
/** Побачила букву - сама каже її звук (без варіантів на вибір). */
const say = (letter: LetterId, letterCase?: LetterCase): Exercise => ({ kind: 'say-sound', letter, letterCase });
const blend = (a: LetterId, b: LetterId): Exercise => ({ kind: 'blend', sounds: [a, b] });
const syllable = (s: string): Exercise => ({ kind: 'read-syllable', syllable: s });
const word = (w: string): Exercise => ({ kind: 'read-word', word: w });
const build = (w: string, distractors: string[]): Exercise => ({ kind: 'build-word', word: w, distractors });
const match = (...syllables: string[]): Exercise => ({ kind: 'match-syllables', syllables });
/** Звучить `text` (запис дорослого або вживу) - дитина вибирає його серед `others`. */
const byEar = (text: string, ...others: string[]): Exercise => ({ kind: 'pick-by-ear', text, options: [text, ...others] });

const VOWELS: LetterId[] = ['А', 'О', 'У', 'И', 'І', 'Е'];
const withL: LetterId[] = [...VOWELS, 'Л'];
const withLM: LetterId[] = [...withL, 'М'];
const withLMS: LetterId[] = [...withLM, 'С'];
const withLMSN: LetterId[] = [...withLMS, 'Н'];
const withLMSNK: LetterId[] = [...withLMSN, 'К'];

/** Місія без дня й номера: їх ставить `day()` за місцем у плані. */
type MissionDraft = Omit<Mission, 'day' | 'order'>;
type DayDraft = Omit<Day, 'day' | 'missions'> & { missions: [MissionDraft, ...MissionDraft[]]; intro?: true };

const day = (title: string, badge: string, ...missions: [MissionDraft, ...MissionDraft[]]): DayDraft => ({ title, badge, missions });
/** День знайомства з буквою і звуком: скорочений шлях етапу його пропускає. */
const introDay = (...args: Parameters<typeof day>): DayDraft => ({ ...day(...args), intro: true });

/** Початок етапу: дні після цієї позначки й до наступної належать йому. */
interface StageMark {
  stage: Pick<Stage, 'id' | 'letters'>;
}
const stage = (id: string, letters: LetterId[]): StageMark => ({ stage: { id, letters } });

/**
 * Порядок: голосні → Л → М → С → Н → К. На кожну приголосну - три дні й вісім місій:
 * 1) звук, склади-злиття і перші короткі слова; 2) ще більше коротких слів (до двох складів);
 * 3) довші слова і лише наприкінці - фрази.
 * Щодня дитина сама згадує звук И: він дається найважче.
 * Нова приголосна відкривається сама, коли пройдено всі попередні місії - не за календарем.
 * Дорослий може відкрити її раніше або сховати в режимі «Для дорослих».
 *
 * Ідентифікатори місій не залежать від номера дня, щоб новий день не ламав збережений прогрес.
 */
const DRAFT: Array<DayDraft | StageMark> = [
  stage('vowels', VOWELS),
  day(
    'Голосні-друзі',
    'АОУ',
    {
      id: 'vowels-1',
      title: 'Голосні-друзі',
      goal: 'learn',
      requires: VOWELS,
      newLetters: ['Е', 'И'],
      sticker: '🦔',
      adultNote:
        'Згадуємо А, О, У, І і знайомимося з Е та И. Голосні можна співати - протягуйте їх довго: «а-а-а», «и-и-и».',
      exercises: [
        bySound('А', ['А', 'О']),
        find('О', ['О', 'У', 'А']),
        bySound('У', ['У', 'І']),
        find('І', ['І', 'А']),
        intro('Е'),
        find('Е', ['Е', 'О']),
        bySound('Е', ['Е', 'А', 'У']),
        intro('И'),
        find('И', ['И', 'І']),
        bySound('И', ['И', 'І', 'О']),
        say('И'),
      ],
    },
    {
      id: 'vowels-2',
      title: 'Голосна пісенька',
      goal: 'reinforce',
      requires: VOWELS,
      sticker: '🐿️',
      adultNote: 'Закріплюємо всі шість голосних. И та І часто плутаються - це нормально, підказки допоможуть.',
      exercises: [
        bySound('И', ['И', 'Е', 'А']),
        find('Е', ['Е', 'И', 'О'], 'lower'),
        match('а', 'о', 'у'),
        bySound('І', ['І', 'И']),
        find('У', ['У', 'А', 'И'], 'lower'),
        match('е', 'и', 'і'),
        bySound('О', ['О', 'У', 'Е']),
        find('А', ['А', 'Е', 'О'], 'lower'),
        bySound('Е', ['Е', 'І', 'У']),
        find('И', ['И', 'І', 'У'], 'lower'),
        say('И', 'lower'),
      ],
    },
    {
      id: 'vowels-3',
      title: 'Кит каже «и-и-и»',
      goal: 'reinforce',
      requires: VOWELS,
      sticker: '🐳',
      adultNote:
        'Окремо тренуємо И. [и] - як у слові «кит»: ротик ледь відкритий, губи спокійні. [і] - усміхаємося широко. Якщо {name} каже «і» замість «и», покажіть різницю перед дзеркалом.',
      exercises: [
        say('И'),
        find('И', ['И', 'І']),
        bySound('И', ['И', 'І', 'Е']),
        say('І'),
        match('и', 'і', 'е'),
        find('И', ['И', 'І', 'У'], 'lower'),
        bySound('І', ['І', 'И']),
        say('И', 'lower'),
        bySound('И', ['И', 'А', 'О'], 'lower'),
        find('І', ['І', 'И', 'Е'], 'lower'),
        say('И'),
      ],
    },
  ),

  // ---------- Л ----------
  stage('l', ['Л']),
  introDay(
    'Звук Л',
    'Л',
    {
      id: 'l-1',
      title: 'Лісовий курінь',
      goal: 'learn',
      requires: withL,
      newLetters: ['Л'],
      sticker: '🐰',
      adultNote:
        'Перша приголосна - [л]. Вимовляйте звук протяжно «л-л-л», а не «ел». Найважливіше - не робити паузи між звуками: тягніть [л], поки пальчик не доїде до голосної, і одразу переходьте в неї: «л-л-ла». Не «л… а… ла».',
      exercises: [
        say('И'),
        intro('Л'),
        bySound('Л', ['Л', 'А', 'Е']),
        blend('Л', 'А'),
        syllable('ла'),
        blend('Л', 'О'),
        syllable('ло'),
        say('Л'),
        blend('Л', 'У'),
        syllable('лу'),
        match('ла', 'ло', 'лу'),
        byEar('ла', 'ло', 'лу'),
      ],
    },
    {
      id: 'l-2',
      title: 'Ла-ло-лу',
      goal: 'reinforce',
      requires: withL,
      sticker: '🦉',
      adultNote:
        'Склади з [л] і всіма голосними. Дужка під складом означає «читай разом»: кулька біжить по дужці, і звук тягнеться без зупинки. Якщо {name} читає по одній букві, проведіть пальцем під складом і протягніть разом: «л-л-лі».',
      exercises: [
        blend('Л', 'И'),
        syllable('ли'),
        blend('Л', 'І'),
        syllable('лі'),
        blend('Л', 'Е'),
        syllable('ле'),
        match('ли', 'лі', 'ле'),
        syllable('ла'),
        syllable('ло'),
        say('Л', 'lower'),
        byEar('лі', 'ли', 'ле'),
      ],
    },
    {
      id: 'l-3',
      title: 'Алло, хто там?',
      goal: 'reinforce',
      requires: withL,
      sticker: '🐭',
      adultNote:
        'Склади, де голосна йде першою: «а-а-ал», «о-о-ол». І перші слова. Слово читаємо по складах, але кожен склад - разом, одним духом: «Ло-ла», а не «Л-о-л-а».',
      exercises: [
        blend('А', 'Л'),
        syllable('ал'),
        blend('О', 'Л'),
        syllable('ол'),
        syllable('ул'),
        match('ал', 'ол', 'ул'),
        say('Л'),
        word('але'),
        build('Лола', ['ле', 'ли']),
        build('алло', ['ла', 'лу']),
        build('але', ['ла', 'ло']),
        byEar('ал', 'ла', 'ол'),
      ],
    },
  ),
  day(
    'Читаємо з Л',
    'ЛО',
    {
      id: 'l-4',
      title: 'Подружки з лісу',
      goal: 'learn',
      requires: withL,
      sticker: '🦋',
      adultNote:
        'Ще один день з [л]: багато коротких слів, по одному. Найлегші - без подвоєних букв: «Ло-ла», «О-лі», «Лі-лі», «ли-ла». Імена пишуться з великої букви - це можна показати.',
      exercises: [
        say('Л'),
        syllable('ел'),
        syllable('ил'),
        match('ел', 'ил', 'ол'),
        word('Лола'),
        word('Олі'),
        build('Лілі', ['ла', 'ле']),
        word('Улі'),
        build('лила', ['лі', 'ле']),
        syllable('ли'),
        word('лила'),
        byEar('Лола', 'Лілі', 'Олі'),
      ],
    },
    {
      id: 'l-5',
      title: 'Лола лила',
      goal: 'reinforce',
      requires: withL,
      sticker: '🐞',
      adultNote:
        'Ще більше окремих слів. У словах з подвоєною [л] («Ал-ла», «Ел-ла») перший склад закінчується на [л], а другий з неї починається - читаємо по дужках.',
      exercises: [
        match('ла', 'лі', 'ли', 'ле'),
        word('лила'),
        word('лили'),
        word('але'),
        say('Л', 'lower'),
        word('Лілі'),
        build('Алла', ['ло', 'ле']),
        build('Елла', ['ал', 'ло']),
        word('алло'),
        word('Лола'),
        byEar('Алла', 'Елла', 'алло'),
        byEar('лила', 'лили', 'Лола'),
      ],
    },
    {
      id: 'l-6',
      title: 'Дай Алі, дай Олі',
      goal: 'reinforce',
      requires: withL,
      sticker: '🐇',
      adultNote:
        'Короткі слова лише з [л] і голосних, кожен склад - два звуки: «А-лі», «Е-лі», «Ло-лі». Так кажемо, коли щось даємо: «дай Алі» (Алі), «дай Лолі» (Лолі).',
      exercises: [
        say('И'),
        syllable('ле'),
        syllable('лу'),
        word('Алі'),
        word('Елі'),
        build('Лолі', ['ла', 'лу']),
        word('лило'),
        say('Л', 'lower'),
        build('Олі', ['ал', 'ли']),
        word('Улі'),
        match('лі', 'ли', 'ле'),
        byEar('Алі', 'Елі', 'Олі'),
      ],
    },
  ),
  day(
    'Фрази з Л',
    'ЛИ',
    {
      id: 'l-7',
      title: 'Лило як з відра',
      goal: 'learn',
      requires: withL,
      sticker: '🐹',
      adultNote:
        'Ще окремі слова з [л]. «Лили», «лила», «лило» відрізняються лише останнім звуком - нехай {name} дочитує слово до кінця, а не вгадує за початком.',
      exercises: [
        say('И', 'lower'),
        match('ол', 'ал', 'ил'),
        word('Лолі'),
        word('Іллі'),
        build('лило', ['ла', 'ле']),
        word('Алла'),
        word('Елла'),
        say('Л'),
        build('Алі', ['ол', 'лу']),
        word('лили'),
        byEar('лили', 'лила', 'лило'),
        byEar('Елла', 'Алла', 'Елі'),
      ],
    },
    {
      id: 'l-8',
      title: 'У кого що?',
      goal: 'reinforce',
      requires: withL,
      sticker: '🐤',
      adultNote:
        'Перші фрази з двох слів: «у Олі», «Ло-ла ли-ла». Між словами - велика відстань: прочитали одне слово, вдихнули, читаємо наступне. Фрази й складаємо - слово за словом, склад за складом.',
      exercises: [
        say('Л', 'lower'),
        word('Улі'),
        word('у Олі'),
        word('у Лоли'),
        match('ал', 'ел', 'ол'),
        build('у Лілі', ['ла', 'ле']),
        word('у Алли'),
        build('у Елли', ['ла', 'ол']),
        word('Лола лила'),
        build('Лола лила', ['лі', 'ле']),
        bySound('И', ['И', 'І', 'Л']),
        byEar('у Олі', 'у Лоли', 'у Алли'),
      ],
    },
  ),

  // ---------- М ----------
  stage('m', ['М']),
  introDay(
    'Звук М',
    'М',
    {
      id: 'm-1',
      title: 'Смачне «м-м-м»',
      goal: 'learn',
      requires: withLM,
      newLetters: ['М'],
      sticker: '🐸',
      adultNote:
        'Новий звук [м]: протяжно, губки разом, «м-м-м», як коли щось смачне. Не кажіть «ем». Тягніть [м] і без паузи переходьте в голосну: «м-м-ма».',
      exercises: [
        say('Л'),
        intro('М'),
        find('М', ['М', 'Л']),
        bySound('М', ['М', 'Л', 'А']),
        blend('М', 'А'),
        syllable('ма'),
        blend('М', 'О'),
        syllable('мо'),
        blend('М', 'И'),
        syllable('ми'),
        say('М'),
        byEar('мо', 'ма', 'ми'),
      ],
    },
    {
      id: 'm-2',
      title: 'Ма-ма',
      goal: 'reinforce',
      requires: withLM,
      sticker: '🦙',
      adultNote: 'Склади з [м] і всіма голосними, а потім перші слова з [м]. Слова й складаємо зі складів: «ма-ма».',
      exercises: [
        blend('М', 'У'),
        syllable('му'),
        blend('М', 'І'),
        syllable('мі'),
        syllable('ме'),
        match('му', 'мі', 'ме'),
        blend('А', 'М'),
        build('мама', ['мо']),
        build('мамо', ['мі', 'ми']),
        say('М', 'lower'),
        word('Емма'),
        byEar('ам', 'ма', 'ом'),
      ],
    },
    {
      id: 'm-3',
      title: 'Ми-ми-ми',
      goal: 'reinforce',
      requires: withLM,
      sticker: '🐼',
      adultNote:
        'Склади, де [м] у кінці («о-о-ом»), і короткі слова з двох складів. «Ми» - одне слово з одного складу: читаємо разом, «м-м-ми».',
      exercises: [
        say('И'),
        blend('О', 'М'),
        syllable('ом'),
        syllable('им'),
        word('ми'),
        word('мамі'),
        build('мимо', ['ма', 'му']),
        say('М'),
        word('мило'),
        build('мала', ['ми', 'ло']),
        match('ам', 'ом', 'ум'),
        byEar('ми', 'мі', 'ма'),
      ],
    },
  ),
  day(
    'Читаємо з М',
    'МА',
    {
      id: 'm-4',
      title: 'М і Л разом',
      goal: 'learn',
      requires: withLM,
      sticker: '🦫',
      adultNote: 'Тепер [м] разом з [л]: «ма-ла», «ми-ло», «Мі-ла». Поки що лише окремі слова - фрази будуть згодом.',
      exercises: [
        find('М', ['М', 'Л', 'И'], 'lower'),
        match('ма', 'ла', 'мі', 'лі'),
        word('мала'),
        word('мило'),
        build('Міла', ['ма', 'ло']),
        build('лама', ['мо']),
        word('мила'),
        say('Л', 'lower'),
        word('малі'),
        build('мило', ['ла', 'мо']),
        say('М'),
        byEar('мило', 'мила', 'мало'),
      ],
    },
    {
      id: 'm-5',
      title: 'Подарунок мамі',
      goal: 'reinforce',
      requires: withLM,
      sticker: '🦘',
      adultNote:
        'Короткі слова, які відрізняються одним звуком: «ма-ло», «ма-ле», «ма-ла». Хай {name} читає кожне до кінця - останній склад теж важливий.',
      exercises: [
        say('И', 'lower'),
        match('ми', 'мі', 'ма', 'мо'),
        word('мало'),
        build('мале', ['ли', 'мо']),
        word('Мілі'),
        word('мили'),
        say('М', 'lower'),
        build('мамі', ['ми', 'мо']),
        word('лама'),
        word('Емма'),
        byEar('мало', 'мале', 'мала'),
      ],
    },
    {
      id: 'm-6',
      title: 'Мило для лами',
      goal: 'reinforce',
      requires: withLM,
      sticker: '🐨',
      adultNote: 'Ще короткі слова з [м] і [л]. Якщо {name} плутає «ми» і «мі», нагадайте: [и] - як у слові «кит», [і] - з усмішкою.',
      exercises: [
        bySound('М', ['М', 'Л', 'А'], 'lower'),
        blend('И', 'М'),
        syllable('им'),
        word('мимо'),
        word('Міла'),
        build('мило', ['ма', 'лі']),
        say('И'),
        word('малі'),
        build('мила', ['мі', 'ло']),
        say('М'),
        byEar('Міла', 'мила', 'мило'),
      ],
    },
  ),
  day(
    'Фрази з М',
    'МИ',
    {
      id: 'm-7',
      title: 'Лама і мама',
      goal: 'learn',
      requires: withLM,
      sticker: '🦒',
      adultNote: 'Повторюємо всі слова з [м] перед фразами. Слова й складаємо зі складів: «ла-ма».',
      exercises: [
        say('М', 'lower'),
        match('ам', 'ом', 'им', 'ум'),
        word('мама'),
        build('мамо', ['ми', 'ла']),
        word('Мілі'),
        word('мала'),
        say('И'),
        build('лама', ['ли', 'мо']),
        word('мимо'),
        word('мили'),
        byEar('мамі', 'мамо', 'мама'),
      ],
    },
    {
      id: 'm-8',
      title: 'Мама мила',
      goal: 'reinforce',
      requires: withLM,
      sticker: '🐑',
      adultNote:
        'Фрази з двох слів. Між словами - велика відстань: прочитали одне слово, вдихнули, читаємо наступне. Фрази й складаємо - слово за словом, склад за складом.',
      exercises: [
        say('И', 'lower'),
        word('Мама мила'),
        build('Ми малі', ['ла', 'мо']),
        word('Лама мала'),
        say('М'),
        build('Мама лила', ['мо', 'ле']),
        word('Міла мила'),
        match('ма', 'ми', 'мі'),
        word('У Міли мило'),
        build('Емма мала', ['ми', 'ло']),
        byEar('Мама мила', 'Мама лила', 'Міла мила'),
      ],
    },
  ),

  // ---------- С ----------
  stage('s', ['С']),
  introDay(
    'Звук С',
    'С',
    {
      id: 's-1',
      title: 'Змійка в траві',
      goal: 'learn',
      requires: withLMS,
      newLetters: ['С'],
      sticker: '🐍',
      adultNote: 'Новий звук [с] - як змійка: «с-с-с». Не кажіть «ес». Тягніть [с] і без паузи переходьте в голосну: «с-с-са».',
      exercises: [
        say('М'),
        intro('С'),
        find('С', ['С', 'О']),
        bySound('С', ['С', 'М', 'Л']),
        blend('С', 'А'),
        syllable('са'),
        blend('С', 'О'),
        syllable('со'),
        blend('С', 'И'),
        syllable('си'),
        say('С'),
        byEar('со', 'са', 'си'),
      ],
    },
    {
      id: 's-2',
      title: 'Оса і сом',
      goal: 'reinforce',
      requires: withLMS,
      sticker: '🐝',
      adultNote: 'Склади й перші слова з [с], поки що по одному. Слова й складаємо зі складів: «са-ло».',
      exercises: [
        blend('С', 'У'),
        syllable('су'),
        syllable('сі'),
        syllable('се'),
        match('су', 'сі', 'се'),
        build('оса', ['су']),
        say('С', 'lower'),
        word('лис'),
        word('ліс'),
        build('сало', ['со', 'лі']),
        build('сила', ['са', 'ло']),
        byEar('лис', 'ліс', 'сом'),
      ],
    },
    {
      id: 's-3',
      title: 'Сім сомів',
      goal: 'reinforce',
      requires: withLMS,
      sticker: '🐠',
      adultNote:
        'Склади, де [с] у кінці («а-а-ас»), і короткі слова з одного складу: «сом», «сім», «сам». Їх читаємо одним духом, тягнучи голосну.',
      exercises: [
        say('И'),
        blend('А', 'С'),
        syllable('ас'),
        syllable('ус'),
        match('ас', 'ос', 'ис'),
        word('сом'),
        word('сім'),
        build('оси', ['са', 'су']),
        say('С'),
        word('сам'),
        build('сама', ['си', 'мо']),
        byEar('сам', 'сом', 'сім'),
      ],
    },
  ),
  day(
    'Читаємо з С',
    'СА',
    {
      id: 's-4',
      title: 'Лиса в лісі',
      goal: 'learn',
      requires: withLMS,
      sticker: '🦦',
      adultNote: 'Ще короткі слова з [с]. «Ли-са» і «лі-си» схожі - нехай {name} уважно дивиться на голосні.',
      exercises: [
        bySound('С', ['С', 'О', 'М'], 'lower'),
        match('си', 'сі', 'се', 'су'),
        word('лиса'),
        word('ліси'),
        build('сила', ['со', 'лі']),
        say('И', 'lower'),
        word('самі'),
        word('усі'),
        build('ліси', ['ла', 'со']),
        say('С', 'lower'),
        byEar('лиса', 'ліси', 'сила'),
      ],
    },
    {
      id: 's-5',
      title: 'Осел і масло',
      goal: 'reinforce',
      requires: withLMS,
      sticker: '🐐',
      adultNote: 'У слові «мас-ло» перший склад закінчується на [с]: «ма-а-ас». Читаємо по дужках, без зупинки всередині складу.',
      exercises: [
        say('С'),
        blend('И', 'С'),
        syllable('ис'),
        word('осел'),
        word('сало'),
        build('масло', ['ма', 'сі']),
        say('И'),
        word('сила'),
        build('осел', ['ос', 'ли']),
        word('сама'),
        byEar('осел', 'оса', 'оси'),
      ],
    },
    {
      id: 's-6',
      title: 'Оса і оси',
      goal: 'reinforce',
      requires: withLMS,
      sticker: '🐛',
      adultNote: 'Повторюємо короткі слова з [с]. Одна - «о-са», багато - «о-си»: різниця лише в останньому звуці.',
      exercises: [
        bySound('И', ['И', 'І', 'С']),
        match('ос', 'ас', 'ус', 'ес'),
        word('оса'),
        build('сало', ['си', 'ле']),
        word('сім'),
        word('масло'),
        say('С', 'lower'),
        build('самі', ['со', 'ми']),
        word('лис'),
        say('И', 'lower'),
        byEar('сало', 'сила', 'сама'),
      ],
    },
  ),
  day(
    'Фрази з С',
    'СИ',
    {
      id: 's-7',
      title: 'Аліса і лиса',
      goal: 'learn',
      requires: withLMS,
      sticker: '🦜',
      adultNote: 'Перше довше слово з трьох складів: «А-лі-са». Читаємо склад за складом, кожен разом.',
      exercises: [
        say('С', 'lower'),
        match('са', 'со', 'си', 'сі'),
        word('Аліса'),
        word('ліс'),
        build('лиса', ['ле', 'со']),
        word('осел'),
        say('И'),
        word('усі'),
        build('сила', ['са', 'лі']),
        word('ліси'),
        byEar('Аліса', 'лиса', 'ліси'),
      ],
    },
    {
      id: 's-8',
      title: 'Лис у лісі',
      goal: 'reinforce',
      requires: withLMS,
      sticker: '🐗',
      adultNote:
        'Фрази з двох слів. Між словами - велика відстань: прочитали одне слово, і лише тоді наступне. «Сім ос» - це сім маленьких ос.',
      exercises: [
        find('С', ['С', 'О', 'Е'], 'lower'),
        word('лиса'),
        build('масло', ['мо']),
        say('И'),
        word('Міла сама'),
        build('Сім ос', ['со', 'си']),
        word('Лис у лісі'),
        build('Ми самі', ['ма', 'си']),
        word('Оса мала'),
        build('Аліса сама', ['ла', 'си']),
        byEar('Міла сама', 'Аліса сама', 'Оса мала'),
      ],
    },
  ),

  // ---------- Н ----------
  stage('n', ['Н']),
  introDay(
    'Звук Н',
    'Н',
    {
      id: 'n-1',
      title: 'Сонний їжачок',
      goal: 'learn',
      requires: withLMSN,
      newLetters: ['Н'],
      sticker: '🐌',
      adultNote:
        'Новий звук [н]: протяжно «н-н-н». Не кажіть «ен». Н і М схожі на слух - нічого страшного, якщо плутаються. Склади тягнемо разом: «н-н-на».',
      exercises: [
        say('С'),
        intro('Н'),
        find('Н', ['Н', 'М']),
        byEar('на', 'ма', 'ла'),
        bySound('Н', ['Н', 'М', 'Л']),
        blend('Н', 'А'),
        syllable('на'),
        blend('Н', 'О'),
        syllable('но'),
        blend('Н', 'І'),
        syllable('ні'),
        say('Н'),
      ],
    },
    {
      id: 'n-2',
      title: 'Сон і сіно',
      goal: 'reinforce',
      requires: withLMSN,
      sticker: '🐢',
      adultNote: 'Склади й окремі слова з [н]. Слова й складаємо зі складів: «сі-но», «ли-мон».',
      exercises: [
        blend('Н', 'И'),
        syllable('ни'),
        syllable('ну'),
        syllable('не'),
        match('ни', 'ну', 'не'),
        word('сон'),
        say('Н', 'lower'),
        build('сіно', ['на', 'со']),
        build('Ніна', ['но', 'ни']),
        build('сани', ['со']),
        build('лимон', ['ла', 'ни']),
        byEar('сон', 'сом', 'ніс'),
      ],
    },
    {
      id: 'n-3',
      title: 'Ні-ні-ні',
      goal: 'reinforce',
      requires: withLMSN,
      sticker: '🦓',
      adultNote: 'Склади, де [н] у кінці («а-а-ан»), і короткі слова: «ні», «ніс», «син». «Ні-но!» - так кличемо Ніну.',
      exercises: [
        say('И'),
        blend('А', 'Н'),
        syllable('ан'),
        syllable('он'),
        match('ан', 'он', 'ин'),
        word('ні'),
        word('ніс'),
        build('Ніно', ['на', 'ни']),
        say('Н'),
        word('син'),
        build('мене', ['ма', 'ни']),
        byEar('ні', 'ну', 'на'),
      ],
    },
  ),
  day(
    'Читаємо з Н',
    'НА',
    {
      id: 'n-4',
      title: 'Сани для Анни',
      goal: 'learn',
      requires: withLMSN,
      sticker: '🐘',
      adultNote: 'Ще короткі слова з [н]. В іменах «Ан-на» та «Ін-на» перший склад закінчується на [н], а другий з неї починається.',
      exercises: [
        bySound('Н', ['Н', 'М', 'И'], 'lower'),
        match('на', 'но', 'ну', 'не'),
        word('Анна'),
        word('Інна'),
        build('сани', ['си', 'но']),
        say('И', 'lower'),
        word('Ані'),
        word('сіно'),
        build('Анна', ['ам', 'ні']),
        say('Н', 'lower'),
        byEar('Анна', 'Інна', 'Ані'),
      ],
    },
    {
      id: 'n-5',
      title: 'Лимон і слон',
      goal: 'reinforce',
      requires: withLMSN,
      sticker: '🦛',
      adultNote: 'У слові «слон» дві приголосні поспіль: «с-с-слон». Тягніть [с] і одразу переходьте в [л], без паузи.',
      exercises: [
        say('Н'),
        blend('І', 'Н'),
        syllable('ін'),
        word('слон'),
        word('лимон'),
        build('сіно', ['са', 'ні']),
        say('И'),
        word('нема'),
        build('Ліна', ['ла', 'ні']),
        word('сон'),
        byEar('слон', 'сон', 'син'),
      ],
    },
    {
      id: 'n-6',
      title: 'Ніна і Ліна',
      goal: 'reinforce',
      requires: withLMSN,
      sticker: '🦚',
      adultNote: 'Повторюємо короткі слова з [н]. Н і И схожі на вигляд: у Н поличка рівна, а в И - навскіс.',
      exercises: [
        find('Н', ['Н', 'И', 'М'], 'lower'),
        match('ни', 'ні', 'ми', 'мі'),
        word('Ніна'),
        word('Ліна'),
        build('нема', ['ні', 'мо']),
        say('И'),
        word('мене'),
        build('лимон', ['лі', 'мо']),
        word('сани'),
        say('Н', 'lower'),
        byEar('Ніна', 'Ліна', 'Ніно'),
      ],
    },
  ),
  day(
    'Фрази з Н',
    'НИ',
    {
      id: 'n-7',
      title: 'Ананас для Олени',
      goal: 'learn',
      requires: withLMSN,
      sticker: '🦩',
      adultNote: 'Довші слова з трьох складів. Довге слово - це просто кілька складів підряд: «а-на-нас».',
      exercises: [
        say('Н', 'lower'),
        match('на', 'ан', 'ни', 'ін'),
        word('Олена'),
        word('ананас'),
        build('Ілона', ['ла', 'ні']),
        say('И'),
        word('слон'),
        build('Олена', ['ла', 'ні']),
        word('налила'),
        word('Анна'),
        byEar('Олена', 'Ілона', 'налила'),
      ],
    },
    {
      id: 'n-8',
      title: 'Лимон для Ніни',
      goal: 'reinforce',
      requires: withLMSN,
      sticker: '🦝',
      adultNote: 'Фрази з двох-трьох слів. Між словами - велика відстань: прочитали одне слово, вдихнули, читаємо наступне.',
      exercises: [
        find('Н', ['Н', 'И', 'М'], 'lower'),
        word('Ніна сама'),
        say('С', 'lower'),
        build('У Анни сани', ['на', 'со']),
        match('на', 'ма', 'ла', 'са'),
        word('Ніна мала'),
        build('Ніна мала', ['но', 'ми']),
        word('На сіні лис'),
        build('У Ніни лимон', ['на', 'ло']),
        word('Ніна налила'),
        byEar('Ніна налила', 'Ніна мала', 'Міла сама'),
        byEar('У Анни сани', 'У Ніни лимон', 'Ніна сама'),
      ],
    },
  ),

  // ---------- К ----------
  stage('k', ['К']),
  introDay(
    'Звук К',
    'К',
    {
      id: 'k-1',
      title: 'Котик на гілочці',
      goal: 'learn',
      requires: withLMSNK,
      newLetters: ['К'],
      sticker: '🐈',
      adultNote:
        'Новий звук [к]: коротко, як крапелька - «к!». Не додавайте «а» в кінці. [к] не протягнеш, тож одразу стрибаємо в голосну і тягнемо її: «ко-о-о».',
      exercises: [
        say('Н'),
        intro('К'),
        find('К', ['К', 'Н']),
        byEar('ко', 'ок', 'кі'),
        bySound('К', ['К', 'С', 'Л']),
        blend('К', 'О'),
        syllable('ко'),
        blend('К', 'А'),
        syllable('ка'),
        blend('К', 'І'),
        syllable('кі'),
        say('К'),
      ],
    },
    {
      id: 'k-2',
      title: 'Коло і кіно',
      goal: 'reinforce',
      requires: withLMSNK,
      sticker: '🦌',
      adultNote: 'Склади й короткі слова з [к]. Слова й складаємо зі складів: «ко-ло», «кі-но».',
      exercises: [
        blend('К', 'У'),
        syllable('ку'),
        syllable('ки'),
        syllable('ке'),
        word('сік'),
        build('коло', ['ка']),
        build('кіно', ['ко', 'на']),
        word('око'),
        say('К', 'lower'),
        build('коса', ['ку', 'си']),
        byEar('коло', 'коса', 'кіно'),
        word('лук'),
      ],
    },
    {
      id: 'k-3',
      title: 'Мак і лак',
      goal: 'reinforce',
      requires: withLMSNK,
      sticker: '🐜',
      adultNote: 'Склади, де [к] у кінці («о-о-ок»), і слова з одного складу: «мак», «лак», «кекс». Голосну тягнемо, [к] - коротко.',
      exercises: [
        say('И'),
        blend('О', 'К'),
        syllable('ок'),
        syllable('ік'),
        match('ак', 'ок', 'ук'),
        word('мак'),
        word('лак'),
        build('ліки', ['ла', 'ко']),
        say('К'),
        build('Ніка', ['ки', 'на']),
        word('кекс'),
        byEar('мак', 'лак', 'лук'),
      ],
    },
  ),
  day(
    'Читаємо з К',
    'КО',
    {
      id: 'k-4',
      title: 'Сумка і миска',
      goal: 'learn',
      requires: withLMSNK,
      sticker: '🦗',
      adultNote: 'Слова, де перший склад закінчується приголосною: «сум-ка», «мис-ка». Читаємо по дужках, кожен склад разом.',
      exercises: [
        bySound('К', ['К', 'Н', 'С'], 'lower'),
        match('ка', 'ко', 'ку', 'ки'),
        word('сумка'),
        build('миска', ['ма', 'ко']),
        say('И'),
        word('маска'),
        build('сумка', ['ма']),
        word('кокос'),
        say('К', 'lower'),
        word('ліки'),
        byEar('маска', 'миска', 'масло'),
      ],
    },
    {
      id: 'k-5',
      title: 'Кулак і носок',
      goal: 'reinforce',
      requires: withLMSNK,
      sticker: '🦥',
      adultNote: 'Ще слова з [к] з двох складів. Слова й складаємо зі складів: «но-сок», «ко-кос».',
      exercises: [
        say('К'),
        blend('И', 'К'),
        syllable('ик'),
        word('кулак'),
        word('носок'),
        build('кокос', ['ка', 'ку']),
        say('И', 'lower'),
        word('сокіл'),
        build('носок', ['на']),
        word('Ніка'),
        byEar('носок', 'сокіл', 'кулак'),
      ],
    },
    {
      id: 'k-6',
      title: 'Око і коса',
      goal: 'reinforce',
      requires: withLMSNK,
      sticker: '🐓',
      adultNote: 'Повторюємо короткі слова з [к]. К, Н та И схожі на вигляд - якщо {name} вагається, обведіть букву пальчиком.',
      exercises: [
        find('К', ['К', 'Н', 'И']),
        match('ак', 'ок', 'ик', 'ук'),
        word('коса'),
        word('мак'),
        build('ліки', ['ле', 'ку']),
        say('И'),
        word('миска'),
        build('кулак', ['ки', 'ло']),
        word('око'),
        say('К', 'lower'),
        byEar('коса', 'кекс', 'коло'),
      ],
    },
  ),
  day(
    'Фрази з К',
    'КИ',
    {
      id: 'k-7',
      title: 'Молоко і калина',
      goal: 'learn',
      requires: withLMSNK,
      sticker: '🐄',
      adultNote: 'Довгі слова з трьох складів. Читаємо склад за складом: «мо-ло-ко», «ка-ли-на».',
      exercises: [
        say('К'),
        match('ко', 'ка', 'кі', 'ке'),
        word('молоко'),
        build('калина', ['ко', 'ни']),
        say('И'),
        word('колесо'),
        build('сокіл', ['ка', 'ко']),
        word('кокос'),
        word('сумка'),
        build('колесо', ['ка', 'лі']),
        byEar('молоко', 'колесо', 'калина'),
      ],
    },
    {
      id: 'k-8',
      title: 'Свято в лісі',
      goal: 'reinforce',
      requires: withLMSNK,
      sticker: '🦢',
      adultNote: 'Фінал! Фрази з усіма буквами. Фрази й складаємо - слово за словом.',
      exercises: [
        find('К', ['К', 'Л', 'Н'], 'lower'),
        build('молоко', ['ма', 'ку']),
        word('сокіл'),
        build('носок', ['на']),
        say('К'),
        word('У Ніки мак'),
        word('Сокіл у лісі'),
        build('Молоко Мілі', ['ма', 'ли']),
        word('Кекс і сік'),
        build('У мами сумка', ['мо', 'ку']),
        word('У Ніни носок'),
        byEar('молоко', 'колесо', 'коло'),
      ],
    },
  ),
];

function buildStages(draft: ReadonlyArray<DayDraft | StageMark>): Stage[] {
  const stages: Stage[] = [];
  let current: { mark: StageMark['stage']; days: Day[]; introDay?: number } | undefined;
  const close = () => {
    if (!current) return;
    if (!current.days.length) throw new Error(`Етап «${current.mark.id}» без жодного дня`);
    stages.push({ ...current.mark, days: current.days as Stage['days'], introDay: current.introDay });
  };
  let dayNumber = 0;
  for (const entry of draft) {
    if ('stage' in entry) {
      close();
      current = { mark: entry.stage, days: [] };
      continue;
    }
    if (!current) throw new Error('План має починатися з позначки етапу');
    dayNumber += 1;
    const { intro, ...d } = entry;
    const n = dayNumber;
    current.days.push({ ...d, day: n, missions: d.missions.map((m, j) => ({ ...m, day: n, order: j + 1 })) as Day['missions'] });
    if (intro) current.introDay = n;
  }
  close();
  return stages;
}

export const COURSE_STAGES: Stage[] = buildStages(DRAFT);

export const COURSE: Day[] = COURSE_STAGES.flatMap((s) => s.days);

export const COURSE_MISSIONS: Mission[] = COURSE.flatMap((d) => d.missions);

export function stageMissions(stage: Stage): Mission[] {
  return stage.days.flatMap((d) => d.missions);
}

/** Місії дня знайомства з буквою і звуком; у голосних їх немає. */
export function introMissions(stage: Stage): Mission[] {
  return stage.days.find((d) => d.day === stage.introDay)?.missions ?? [];
}

/** Спільний етап голосних: один день, і місії в голосних спільні. */
export function isVowelStage(stage: Stage): boolean {
  return stage.letters.every(isVowel);
}

export function previousStage(stage: Stage): Stage | undefined {
  const index = COURSE_STAGES.indexOf(stage);
  return index > 0 ? COURSE_STAGES[index - 1] : undefined;
}

export function findStage(id: string): Stage | undefined {
  return COURSE_STAGES.find((s) => s.id === id);
}

export function stageOfLetter(letter: LetterId): Stage | undefined {
  return COURSE_STAGES.find((s) => s.letters.includes(letter));
}

export function stageOfMission(id: string): Stage | undefined {
  return COURSE_STAGES.find((s) => stageMissions(s).some((m) => m.id === id));
}

/**
 * Ідентифікатори місій, коли план був на 7 днів (w1d<день>m<місія>), → нинішні.
 * Пройдене тоді не губиться: місія з тим самим змістом лишається пройденою.
 */
export const LEGACY_MISSION_IDS: Readonly<Record<string, string>> = {
  w1d1m1: 'vowels-1',
  w1d1m2: 'vowels-2',
  w1d2m1: 'l-1',
  w1d2m2: 'l-2',
  w1d2m3: 'l-3',
  w1d3m1: 'l-4',
  w1d3m2: 'l-5',
  w1d3m3: 'l-8',
  w1d4m1: 'm-1',
  w1d4m2: 'm-2',
  w1d4m3: 'm-4',
  w1d5m1: 's-1',
  w1d5m2: 's-2',
  w1d5m3: 's-8',
  w1d6m1: 'n-1',
  w1d6m2: 'n-2',
  w1d6m3: 'n-8',
  w1d7m1: 'k-1',
  w1d7m2: 'k-2',
  w1d7m3: 'k-8',
};

export function findMission(id: string): Mission | undefined {
  return COURSE_MISSIONS.find((m) => m.id === id);
}
