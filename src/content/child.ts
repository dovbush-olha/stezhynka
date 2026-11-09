/**
 * Дитина, яка грається: ім'я, звертання і рід.
 * Тексти застосунку пишемо з маркерами, а підставляємо ім'я й закінчення лише під час показу:
 *   {name}          - ім'я: «Майя», «Андрій»
 *   {voc}           - звертання (кличний відмінок): «Майє», «Андрію»
 *   {сама|сам}      - слово для дівчинки | для хлопчика
 */

export type Gender = 'girl' | 'boy';

export interface Child {
  name: string;
  vocative: string;
  gender: Gender;
}

/** Профіль тих, хто грався ще до того, як застосунок почав питати ім'я. */
export const LEGACY_CHILD: Child = { name: 'Майя', vocative: 'Майє', gender: 'girl' };

export const MAX_NAME_LENGTH = 24;

export function isChild(v: unknown): v is Child {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.name === 'string' &&
    c.name.trim() !== '' &&
    typeof c.vocative === 'string' &&
    c.vocative.trim() !== '' &&
    (c.gender === 'girl' || c.gender === 'boy')
  );
}

export function personalize(text: string, child: Child): string {
  return text
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, girl: string, boy: string) => (child.gender === 'girl' ? girl : boy))
    .replaceAll('{name}', child.name)
    .replaceAll('{voc}', child.vocative);
}

const VOWELS = 'аеєиіїоуюя';

/**
 * Кличний відмінок за звичайними правилами для імен: Олена → Олено, Андрій → Андрію.
 * Усі винятки не вгадає, тому дорослий може виправити звертання вручну.
 */
export function guessVocative(rawName: string, gender: Gender): string {
  const name = rawName.trim();
  if (name.length < 2) return name;
  const lower = name.toLocaleLowerCase('uk-UA');
  const stem = name.slice(0, -1);
  const last = lower.at(-1)!;
  const prev = lower.at(-2)!;

  if (last === 'я') {
    if (prev === 'л' && lower.at(-3) === 'л') return `${stem}е`; // Ілля → Ілле
    return VOWELS.includes(prev) || prev === 'й' ? `${stem}є` : `${stem}ю`; // Марія → Маріє, Оля → Олю
  }
  if (last === 'а') return 'жчшщ'.includes(prev) ? `${stem}е` : `${stem}о`; // Саша → Саше, Олена → Олено
  if (last === 'о') return 'кгх'.includes(prev) ? `${stem}у` : `${stem}е`; // Марко → Марку, Петро → Петре
  if (last === 'й') return `${stem}ю`; // Андрій → Андрію
  if (last === 'ь') return `${stem}ю`; // Василь → Василю
  if (VOWELS.includes(last)) return name;
  if (gender === 'girl') return name; // рідкісні жіночі імена на приголосну залишаємо як є
  if ('кгх'.includes(last)) return `${name}у`; // Олег → Олегу, Марк → Марку
  if ('жчшщ'.includes(last)) return `${name}у`; // Лукаш → Лукашу
  return `${name}е`; // Іван → Іване, Максим → Максиме
}

/** Ім'я з великої літери, без зайвих пробілів. */
export function tidyName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return name ? name[0].toLocaleUpperCase('uk-UA') + name.slice(1) : name;
}
