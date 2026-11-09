/**
 * Файл з усім, що застосунок пам'ятає на пристрої: прогрес, ім'я, налаштування і записи голосу.
 * Ним переносять гру на інший телефон або на нову іконку (на iPhone кожна іконка має окреме сховище).
 */
import type { Child } from '../content/child';
import { normalizeState, todayISO, type ProgressState } from './progress';

export const BACKUP_APP = 'stezhynka';
export const BACKUP_FORMAT = 1;

/** Запис голосу у файлі: байти в base64 і тип (на iPhone - audio/mp4, деінде - audio/webm). */
export interface BackupAudio {
  type: string;
  data: string;
}

export interface Backup {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  savedAt: string;
  progress: ProgressState;
  /** Голос дорослого: ключ запису → звук. */
  recordings: Array<BackupAudio & { key: string }>;
  /** Як дитина читала сама і ще чекає, поки дорослий послухає. */
  readings: Array<BackupAudio & { id: string; text: string; at: string }>;
}

export class BackupError extends Error {}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isAudio = (v: Record<string, unknown>) => isString(v.type) && isString(v.data);

/** Читає файл збереження. Помилки - зрозумілими словами для дорослого. */
export function parseBackup(text: string, today = todayISO()): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('Це не файл збереження «Стежинки». Виберіть файл, який зберегли кнопкою «Зберегти прогрес у файл».');
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP) {
    throw new BackupError('Це не файл збереження «Стежинки». Виберіть файл, який зберегли кнопкою «Зберегти прогрес у файл».');
  }
  if (typeof raw.format !== 'number' || raw.format > BACKUP_FORMAT) {
    throw new BackupError('Файл збережено новішою версією застосунку. Оновіть сторінку й спробуйте ще раз.');
  }
  if (!isObject(raw.progress)) throw new BackupError('У файлі немає прогресу. Можливо, він пошкоджений.');

  const recordings = (Array.isArray(raw.recordings) ? raw.recordings : [])
    .filter(isObject)
    .filter((r) => isString(r.key) && isAudio(r))
    .map((r) => ({ key: r.key as string, type: r.type as string, data: r.data as string }));
  const readings = (Array.isArray(raw.readings) ? raw.readings : [])
    .filter(isObject)
    .filter((r) => isString(r.id) && isString(r.text) && isString(r.at) && isAudio(r))
    .map((r) => ({ id: r.id as string, text: r.text as string, at: r.at as string, type: r.type as string, data: r.data as string }));

  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    savedAt: isString(raw.savedAt) ? raw.savedAt : '',
    progress: normalizeState(raw.progress, today),
    recordings,
    readings,
  };
}

/** «stezhynka-Майя-2026-11-09.json» - щоб у «Файлах» було видно, чий і коли. */
export function backupFileName(child: Child | null, date = new Date()): string {
  const name = child?.name.replace(/[^\p{L}\p{N}'’-]+/gu, '-') ?? '';
  return `stezhynka-${name ? `${name}-` : ''}${todayISO(date)}.json`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function base64ToBytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
