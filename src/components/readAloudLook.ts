/** Стан запису читання вголос у вправі. */
export type ReadAloudPhase = 'idle' | 'starting' | 'recording' | 'hearing';

/** Як виглядає кругла кнопка: піктограма й колір, які дитина впізнає без підпису. */
export type ReadAloudLookId = 'mic' | 'wait' | 'stop' | 'ear';

export interface ReadAloudLook {
  look: ReadAloudLookId;
  /** Короткий підпис під кнопкою - для дорослого. */
  caption: string;
  /** Кнопку можна натиснути: почати запис або зупинити його. */
  pressable: boolean;
}

/** Підписи: перший - коли дитина читає, другий - коли каже звук букви. */
const LOOKS: Record<ReadAloudPhase, { look: ReadAloudLookId; pressable: boolean; caption: [string, string] }> = {
  idle: { look: 'mic', pressable: true, caption: ['Натисни й читай уголос', 'Натисни й скажи звук'] },
  starting: { look: 'wait', pressable: false, caption: ['Зачекай…', 'Зачекай…'] },
  recording: { look: 'stop', pressable: true, caption: ['Читай! Коли все - натисни ■', 'Кажи! Коли все - натисни ■'] },
  hearing: { look: 'ear', pressable: false, caption: ['Послухай себе', 'Послухай себе'] },
};

/** Вигляд кнопки запису в кожному стані; `say` - дитина каже звук букви, а не читає. */
export function readAloudLook(phase: ReadAloudPhase, say: boolean): ReadAloudLook {
  const { look, pressable, caption } = LOOKS[phase];
  return { look, pressable, caption: caption[say ? 1 : 0] };
}
