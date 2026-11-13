import type { HelperMood } from '../Helper';
import type { ExerciseResult } from '../../logic/progress';
import type { ReadingCheck } from '../../logic/readingCheck';
import type { ReadingCase } from '../text';

export interface HelperFeedback {
  mood: HelperMood;
  text: string;
}

export interface ExerciseProps<E> {
  exercise: E;
  seed: string;
  readingCase: ReadingCase;
  /** Хто перевіряє читання вголос: запис (дорослий послухає потім) чи дорослий поруч, одразу. */
  readingCheck: ReadingCheck;
  /** Склади з дужками й кнопка 🔊 видно одразу, без натискання «Підказка». */
  openHints: boolean;
  completed: boolean;
  onFeedback: (f: HelperFeedback) => void;
  onComplete: (r: ExerciseResult) => void;
}
