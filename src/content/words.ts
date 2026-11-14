import type { WordEntry } from './types';

/**
 * Банк коротких справжніх українських слів і фраз.
 * `split` - поділ на склади (дефіс) і слова (пробіл).
 * Тести перевіряють, що поділ збігається зі словом, а в місії слово
 * трапляється лише тоді, коли дитині доступні всі його букви.
 * `clear` - картинка однозначно називає слово (можна просити скласти слово за картинкою).
 */
const LIST: WordEntry[] = [
  // Л + голосні. Слова без подвоєних букв - найлегші: кожен склад з двох звуків.
  { text: 'алло', split: 'ал-ло', picture: '📞', clear: true },
  { text: 'Алла', split: 'Ал-ла', picture: '👩', note: 'Алла - ім’я.' },
  { text: 'Лола', split: 'Ло-ла', picture: '👧', note: 'Лола - ім’я.' },
  { text: 'Елла', split: 'Ел-ла', picture: '👱‍♀️', note: 'Елла - ім’я.' },
  { text: 'Олі', split: 'О-лі', picture: '👧' },
  { text: 'Лілі', split: 'Лі-лі', picture: '🧒', note: 'Лілі - так кажемо про Лілю: «дай Лілі».' },
  { text: 'Улі', split: 'У-лі', picture: '👩‍🦰', note: 'Улі - так кажемо про Улю: «дай Улі».' },
  { text: 'лила', split: 'ли-ла', picture: '🫗', note: 'Лила - від «лити»: вона лила воду.' },
  { text: 'лили', split: 'ли-ли', picture: '💦', note: 'Лили - від «лити»: вони лили воду.', pickable: false },
  { text: 'але', split: 'а-ле', picture: '🤔', note: 'Але - як у «хочу, але не можу».', pickable: false },
  { text: 'у Олі', split: 'у О-лі', picture: '🎀', note: 'У Олі (є бантик).', pickable: false },
  { text: 'у Лоли', split: 'у Ло-ли', picture: '🎈', note: 'У Лоли (є кулька).', pickable: false },
  { text: 'у Алли', split: 'у Ал-ли', picture: '💐', note: 'У Алли (є квіти).', pickable: false },
  { text: 'у Елли', split: 'у Ел-ли', picture: '👒', note: 'У Елли (є капелюшок).', pickable: false },
  { text: 'у Лілі', split: 'у Лі-лі', picture: '🧸', note: 'У Лілі (є ведмедик).', pickable: false },
  { text: 'Лола лила', split: 'Ло-ла ли-ла', picture: '🫗' },
  { text: 'Алі', split: 'А-лі', picture: '👩‍🦱', note: 'Алі - так кажемо про Алю: «дай Алі».' },
  { text: 'Елі', split: 'Е-лі', picture: '👧🏾', note: 'Елі - так кажемо про Елю: «дай Елі».' },
  { text: 'Лолі', split: 'Ло-лі', picture: '🧒🏻', note: 'Лолі - так кажемо про Лолу: «дай Лолі».' },
  { text: 'Іллі', split: 'Іл-лі', picture: '🧒🏽', note: 'Іллі - так кажемо про Іллю: «дай Іллі».' },
  { text: 'лило', split: 'ли-ло', picture: '🌧️', note: 'Лило - від «лити»: лило як з відра.', pickable: false },

  // М окремо
  { text: 'мама', split: 'ма-ма', picture: '👩‍👧', clear: true },
  { text: 'мамо', split: 'ма-мо', picture: '🙋‍♀️', note: 'Мамо! - кличемо маму.' },
  { text: 'мамі', split: 'ма-мі', picture: '💝', note: 'Подарунок мамі.', pickable: false },
  { text: 'ми', split: 'ми', picture: '👫' },
  { text: 'Емма', split: 'Ем-ма', picture: '👧🏼', note: 'Емма - ім’я.' },
  { text: 'у мами', split: 'у ма-ми', picture: '👛', note: 'У мами (є гаманець).', pickable: false },
  { text: 'мимо', split: 'ми-мо', picture: '🚶', note: 'Мимо - пройти мимо.', pickable: false },

  // М + Л
  { text: 'мала', split: 'ма-ла', picture: '🐣', pickable: false },
  { text: 'малі', split: 'ма-лі', picture: '🐥🐥', pickable: false },
  { text: 'мале', split: 'ма-ле', picture: '🐁', pickable: false },
  { text: 'мало', split: 'ма-ло', picture: '🤏' },
  { text: 'мила', split: 'ми-ла', picture: '🧽', note: 'Мила - від «мити»: мама мила посуд.', pickable: false },
  { text: 'мило', split: 'ми-ло', picture: '🧼', clear: true },
  { text: 'Міла', split: 'Мі-ла', picture: '👧🏻', note: 'Міла - ім’я.' },
  { text: 'лама', split: 'ла-ма', picture: '🦙', clear: true },
  { text: 'Мілі', split: 'Мі-лі', picture: '👧🏻', note: 'Мілі - так кажемо про Мілу: «дай Мілі».' },
  { text: 'мили', split: 'ми-ли', picture: '🫧', note: 'Мили - від «мити»: ми мили руки.', pickable: false },
  { text: 'Мама мила', split: 'Ма-ма ми-ла', picture: '🧽' },
  { text: 'Ми малі', split: 'Ми ма-лі', picture: '🧒🧒' },
  { text: 'Лама мала', split: 'Ла-ма ма-ла', picture: '🦙' },
  { text: 'У Міли мило', split: 'У Мі-ли ми-ло', picture: '🫧' },
  { text: 'Мама лила', split: 'Ма-ма ли-ла', picture: '🫗', pickable: false },
  { text: 'Міла мила', split: 'Мі-ла ми-ла', picture: '🧽', pickable: false },
  { text: 'Емма мала', split: 'Ем-ма ма-ла', picture: '👶' },

  // + С
  { text: 'оса', split: 'о-са', picture: '🐝', clear: true },
  { text: 'сом', split: 'сом', picture: '🐟', note: 'Сом - велика річкова риба.' },
  { text: 'сало', split: 'са-ло', picture: '🥓', clear: true },
  { text: 'лис', split: 'лис', picture: '🦊' },
  { text: 'ліс', split: 'ліс', picture: '🌲', clear: true },
  { text: 'лиса', split: 'ли-са', picture: '🦊', note: 'Лиса - лисиця.' },
  { text: 'сила', split: 'си-ла', picture: '💪' },
  { text: 'сама', split: 'са-ма', picture: '🙋‍♀️', note: 'Сама - без допомоги.' },
  { text: 'масло', split: 'мас-ло', picture: '🧈', clear: true },
  { text: 'ліси', split: 'лі-си', picture: '🌲🌲', pickable: false },
  { text: 'сім', split: 'сім', picture: '7️⃣', clear: true },
  { text: 'сам', split: 'сам', picture: '🙋‍♂️', note: 'Сам - без допомоги.' },
  { text: 'самі', split: 'са-мі', picture: '🙌', note: 'Самі - без допомоги: ми самі.', pickable: false },
  { text: 'оси', split: 'о-си', picture: '🐝🐝', pickable: false },
  { text: 'усі', split: 'у-сі', picture: '👨‍👩‍👧‍👦', note: 'Усі - кожен, ніхто не залишився.', pickable: false },
  { text: 'осел', split: 'о-сел', picture: '🫏', clear: true },
  { text: 'Аліса', split: 'А-лі-са', picture: '👧🏼', note: 'Аліса - ім’я.' },
  { text: 'Міла сама', split: 'Мі-ла са-ма', picture: '🙋‍♀️' },
  { text: 'Лис у лісі', split: 'Лис у лі-сі', picture: '🌳' },
  { text: 'Оса мала', split: 'О-са ма-ла', picture: '🐝' },
  { text: 'Сім ос', split: 'Сім ос', picture: '🐝', note: 'Сім ос - сім маленьких ос.' },
  { text: 'Ми самі', split: 'Ми са-мі', picture: '🙌', pickable: false },
  { text: 'Аліса сама', split: 'А-лі-са са-ма', picture: '🙋‍♀️' },

  // + Н
  { text: 'сон', split: 'сон', picture: '😴' },
  { text: 'ніс', split: 'ніс', picture: '👃', clear: true },
  { text: 'сіно', split: 'сі-но', picture: '🌾' },
  { text: 'Ніна', split: 'Ні-на', picture: '👧🏽', note: 'Ніна - ім’я.' },
  { text: 'лимон', split: 'ли-мон', picture: '🍋', clear: true },
  { text: 'сани', split: 'са-ни', picture: '🛷', clear: true },
  { text: 'ананас', split: 'а-на-нас', picture: '🍍', clear: true },
  { text: 'налила', split: 'на-ли-ла', picture: '🫗', note: 'Налила - від «налити»: налила соку.', pickable: false },
  { text: 'Олена', split: 'О-ле-на', picture: '👩🏼', note: 'Олена - ім’я.' },
  { text: 'ні', split: 'ні', picture: '🙅', note: 'Ні - коли не погоджуємось.', pickable: false },
  { text: 'син', split: 'син', picture: '👦', note: 'Син - хлопчик у мами й тата.', pickable: false },
  { text: 'Ніно', split: 'Ні-но', picture: '🙋‍♀️', note: 'Ніно! - кличемо Ніну.' },
  { text: 'мене', split: 'ме-не', picture: '🙋', note: 'Мене - як у «обійми мене».', pickable: false },
  { text: 'нема', split: 'не-ма', picture: '🤷', note: 'Нема - немає, нічого нема.', pickable: false },
  { text: 'Анна', split: 'Ан-на', picture: '👩🏻', note: 'Анна - ім’я.' },
  { text: 'Інна', split: 'Ін-на', picture: '👩🏽', note: 'Інна - ім’я.' },
  { text: 'Ані', split: 'А-ні', picture: '👧🏽', note: 'Ані - так кажемо про Аню: «дай Ані».' },
  { text: 'Ліна', split: 'Лі-на', picture: '👧🏿', note: 'Ліна - ім’я.' },
  { text: 'Ілона', split: 'І-ло-на', picture: '👩🏾', note: 'Ілона - ім’я.' },
  { text: 'слон', split: 'слон', picture: '🐘', clear: true },
  { text: 'Ніна мала', split: 'Ні-на ма-ла', picture: '👶' },
  { text: 'На сіні лис', split: 'На сі-ні лис', picture: '🦊' },
  { text: 'У Ніни лимон', split: 'У Ні-ни ли-мон', picture: '🍋' },
  { text: 'Ніна налила', split: 'Ні-на на-ли-ла', picture: '🫗', pickable: false },
  { text: 'Ніна сама', split: 'Ні-на са-ма', picture: '🙋‍♀️' },
  { text: 'У Анни сани', split: 'У Ан-ни са-ни', picture: '🛷' },

  // + К
  { text: 'сік', split: 'сік', picture: '🧃', clear: true },
  { text: 'коло', split: 'ко-ло', picture: '⭕', clear: true },
  { text: 'кіно', split: 'кі-но', picture: '🎬' },
  { text: 'сумка', split: 'сум-ка', picture: '👜', clear: true },
  { text: 'маска', split: 'мас-ка', picture: '🎭', clear: true },
  { text: 'кулак', split: 'ку-лак', picture: '✊', clear: true },
  { text: 'лук', split: 'лук', picture: '🏹', clear: true, note: 'Лук - щоб стріляти стрілами.' },
  { text: 'кекс', split: 'кекс', picture: '🧁', clear: true },
  { text: 'око', split: 'о-ко', picture: '👁️', clear: true },
  { text: 'мак', split: 'мак', picture: '🌺', note: 'Мак - червона квітка.' },
  { text: 'лак', split: 'лак', picture: '💅', note: 'Лак для нігтів.' },
  { text: 'коса', split: 'ко-са', picture: '👱‍♀️', note: 'Коса - заплетене волосся.', pickable: false },
  { text: 'кокос', split: 'ко-кос', picture: '🥥', clear: true },
  { text: 'ліки', split: 'лі-ки', picture: '💊', clear: true },
  { text: 'Ніка', split: 'Ні-ка', picture: '👧🏼', note: 'Ніка - ім’я.' },
  { text: 'миска', split: 'мис-ка', picture: '🥣', clear: true },
  { text: 'молоко', split: 'мо-ло-ко', picture: '🥛', clear: true },
  { text: 'сокіл', split: 'со-кіл', picture: '🦅', clear: true },
  { text: 'калина', split: 'ка-ли-на', picture: '🍒', note: 'Калина - червоні ягідки на кущі.' },
  { text: 'носок', split: 'но-сок', picture: '🧦', clear: true },
  { text: 'колесо', split: 'ко-ле-со', picture: '🛞', clear: true },
  { text: 'Сокіл у лісі', split: 'Со-кіл у лі-сі', picture: '🦅' },
  { text: 'Молоко Мілі', split: 'Мо-ло-ко Мі-лі', picture: '🥛' },
  { text: 'У Ніни носок', split: 'У Ні-ни но-сок', picture: '🧦' },
  { text: 'У мами сумка', split: 'У ма-ми сум-ка', picture: '👜' },
  { text: 'У Ніки мак', split: 'У Ні-ки мак', picture: '🌺' },
  { text: 'Кекс і сік', split: 'Кекс і сік', picture: '🧁' },

  // + В
  { text: 'вона', split: 'во-на', picture: '👧', note: 'Вона - про дівчинку.', pickable: false },
  { text: 'вони', split: 'во-ни', picture: '🧑‍🤝‍🧑', note: 'Вони - про кількох.', pickable: false },
  { text: 'він', split: 'він', picture: '👦', note: 'Він - про хлопчика.', pickable: false },
  { text: 'вам', split: 'вам', picture: '🫴', note: 'Вам - як у «це вам».', pickable: false },
  { text: 'лев', split: 'лев', picture: '🦁', clear: true },
  { text: 'Вова', split: 'Во-ва', picture: '👦🏼', note: 'Вова - ім’я.' },
  { text: 'вуса', split: 'ву-са', picture: '🥸', note: 'Вуса - як у тата чи в кота.' },
  { text: 'вікно', split: 'вік-но', picture: '🪟', clear: true },
  { text: 'вилка', split: 'вил-ка', picture: '🍴', clear: true },
  { text: 'кавун', split: 'ка-вун', picture: '🍉', clear: true },
  { text: 'Віка', split: 'Ві-ка', picture: '👧🏻', note: 'Віка - ім’я.' },
  { text: 'весна', split: 'вес-на', picture: '🌷' },
  { text: 'весло', split: 'вес-ло', picture: '🛶', note: 'Весло - щоб плисти човном.' },
  { text: 'вовна', split: 'вов-на', picture: '🧶', note: 'Вовна - з неї в’яжуть шкарпетки.' },
  { text: 'вісім', split: 'ві-сім', picture: '8️⃣', clear: true },
  { text: 'сови', split: 'со-ви', picture: '🦉🦉', pickable: false },
  { text: 'Іван', split: 'І-ван', picture: '🧔', note: 'Іван - ім’я.' },
  { text: 'нова', split: 'но-ва', picture: '✨', note: 'Нова - щойно куплена.', pickable: false },
  { text: 'весело', split: 'ве-се-ло', picture: '😄', pickable: false },
  { text: 'веселі', split: 'ве-се-лі', picture: '🥳', pickable: false },
  { text: 'Іванко', split: 'І-ван-ко', picture: '👦🏽', note: 'Іванко - ім’я.' },
  { text: 'Вовк і сова', split: 'Вовк і со-ва', picture: '🐺' },
  { text: 'У Віки вилка', split: 'У Ві-ки вил-ка', picture: '🍴' },
  { text: 'Вона весела', split: 'Во-на ве-се-ла', picture: '😄', pickable: false },
  { text: 'Вікно нове', split: 'Вік-но но-ве', picture: '🪟' },
  { text: 'У Вови кавун', split: 'У Во-ви ка-вун', picture: '🍉' },

  // + П
  { text: 'суп', split: 'суп', picture: '🍲', clear: true },
  { text: 'лапа', split: 'ла-па', picture: '🐾', clear: true },
  { text: 'липа', split: 'ли-па', picture: '🌳', note: 'Липа - дерево із запашним цвітом.' },
  { text: 'пес', split: 'пес', picture: '🐕', clear: true },
  { text: 'пила', split: 'пи-ла', picture: '🪚', note: 'Пила - щоб різати дерево.' },
  { text: 'мапа', split: 'ма-па', picture: '🗺️', clear: true },
  { text: 'кепка', split: 'кеп-ка', picture: '🧢', clear: true },
  { text: 'павук', split: 'па-вук', picture: '🕷️', clear: true },
  { text: 'лампа', split: 'лам-па', picture: '💡' },
  { text: 'пісок', split: 'пі-сок', picture: '🏖️' },
  { text: 'пума', split: 'пу-ма', picture: '🐆', note: 'Пума - велика дика кішка.' },
  { text: 'піна', split: 'пі-на', picture: '🫧', note: 'Піна - з мила у ванні.' },
  { text: 'Павло', split: 'Пав-ло', picture: '👨🏻', note: 'Павло - ім’я.' },
  { text: 'Поліна', split: 'По-лі-на', picture: '👩🏻‍🦱', note: 'Поліна - ім’я.' },
  { text: 'панама', split: 'па-на-ма', picture: '👒', note: 'Панама - літній капелюшок.' },
  { text: 'пакунок', split: 'па-ку-нок', picture: '🎁', clear: true },
  { text: 'Павук на липі', split: 'Па-вук на ли-пі', picture: '🕷️' },
  { text: 'У Павла лампа', split: 'У Пав-ла лам-па', picture: '💡' },
  { text: 'Пес у лісі', split: 'Пес у лі-сі', picture: '🐕' },
  { text: 'Суп і сік', split: 'Суп і сік', picture: '🍲' },
  { text: 'У Поліни панама', split: 'У По-лі-ни па-на-ма', picture: '👒' },

  // + Р
  { text: 'рис', split: 'рис', picture: '🍚', clear: true },
  { text: 'сир', split: 'сир', picture: '🧀', clear: true },
  { text: 'нора', split: 'но-ра', picture: '🕳️', note: 'Нора - хатинка лиса чи кролика під землею.' },
  { text: 'рак', split: 'рак', picture: '🦞', note: 'Рак - живе в річці й ходить задки.' },
  { text: 'комар', split: 'ко-мар', picture: '🦟', clear: true },
  { text: 'перо', split: 'пе-ро', picture: '🪶', clear: true },
  { text: 'ріка', split: 'рі-ка', picture: '🏞️' },
  { text: 'морква', split: 'мор-ква', picture: '🥕', clear: true },
  { text: 'Рома', split: 'Ро-ма', picture: '👦🏻', note: 'Рома - ім’я.' },
  { text: 'Іра', split: 'І-ра', picture: '👧🏼', note: 'Іра - ім’я.' },
  { text: 'кран', split: 'кран', picture: '🏗️', note: 'Кран - підіймає важке на будові.' },
  { text: 'рама', split: 'ра-ма', picture: '🖼️', note: 'Рама - для картини чи вікна.' },
  { text: 'корова', split: 'ко-ро-ва', picture: '🐄', clear: true },
  { text: 'сорока', split: 'со-ро-ка', picture: '🐦', note: 'Сорока - біло-чорна пташка.' },
  { text: 'корона', split: 'ко-ро-на', picture: '👑', clear: true },
  { text: 'Марина', split: 'Ма-ри-на', picture: '👩🏻', note: 'Марина - ім’я.' },
  { text: 'Ірина', split: 'І-ри-на', picture: '👩🏼‍🦰', note: 'Ірина - ім’я.' },
  { text: 'Сир і рис', split: 'Сир і рис', picture: '🧀' },
  { text: 'У Роми морква', split: 'У Ро-ми мор-ква', picture: '🥕' },
  { text: 'Сорока на сосні', split: 'Со-ро-ка на со-сні', picture: '🌲' },
  { text: 'У Ірини корона', split: 'У І-ри-ни ко-ро-на', picture: '👑' },

  // Для вільної практики, коли дорослий відкриє інші букви
  { text: 'тато', split: 'та-то', picture: '👨', clear: true },
  { text: 'кіт', split: 'кіт', picture: '🐈', clear: true },
  { text: 'нота', split: 'но-та', picture: '🎵', clear: true },
  { text: 'рука', split: 'ру-ка', picture: '✋', clear: true },
  { text: 'роса', split: 'ро-са', picture: '💧' },
  { text: 'рот', split: 'рот', picture: '👄', clear: true },
  { text: 'сова', split: 'со-ва', picture: '🦉', clear: true },
  { text: 'вовк', split: 'вовк', picture: '🐺', clear: true },
  { text: 'дім', split: 'дім', picture: '🏠', clear: true },
  { text: 'дуб', split: 'дуб', picture: '🌳' },
];

export const WORDS: Record<string, WordEntry> = Object.fromEntries(LIST.map((w) => [w.text, w]));

export const ALL_WORDS: readonly WordEntry[] = LIST;

export function getWord(key: string): WordEntry {
  const word = WORDS[key];
  if (!word) throw new Error(`Слова «${key}» немає в банку слів`);
  return word;
}

/** Слова фрази, кожне - масив складів: «Ма-ма ми-ла» → [["Ма","ма"],["ми","ла"]]. */
export function wordsOf(entry: WordEntry): string[][] {
  return entry.split.split(' ').map((w) => w.split('-'));
}

export function syllablesOf(entry: WordEntry): string[] {
  return wordsOf(entry).flat();
}

export function isPhrase(entry: WordEntry): boolean {
  return entry.text.includes(' ');
}
