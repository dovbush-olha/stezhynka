import { useSyncExternalStore } from 'react';
import { BUILTIN_VOICE } from '../content/builtinVoice';
import { setMicOpen } from './audio';
import { tx } from './db';

export { soundKey } from '../logic/voice';

/**
 * Голос, який чує дитина: звуки букв, склади й слова.
 * Свої записи дорослого лежать в IndexedDB на самому пристрої і мають перевагу;
 * для решти звучить вбудований голос «Стежинки» (public/voice, див. scripts/import-voice.mjs).
 */

const BUILTIN_KEYS: ReadonlySet<string> = new Set(Object.keys(BUILTIN_VOICE));

/** Записи дорослого на цьому пристрої. */
let own = new Set<string>();
/** Усе, що можна відтворити: свої записи й вбудований голос. */
let playable: ReadonlySet<string> = BUILTIN_KEYS;
let listeners: Array<() => void> = [];

function setOwn(next: Set<string>) {
  own = next;
  playable = new Set([...BUILTIN_KEYS, ...own]);
  listeners.forEach((l) => l());
}

export async function loadRecordingKeys() {
  try {
    const all = await tx('recordings', 'readonly', (s) => s.getAllKeys());
    setOwn(new Set(all.map(String)));
  } catch {
    // IndexedDB недоступна (приватний режим) - звучить лише вбудований голос.
  }
}

/** Чи є що відтворити для цього ключа: свій запис або вбудований голос. */
export function hasRecording(key: string): boolean {
  return playable.has(key);
}

/** Чи є для ключа вбудований голос «Стежинки». */
export function hasBuiltinVoice(key: string): boolean {
  return BUILTIN_KEYS.has(key);
}

export async function saveRecording(key: string, blob: Blob) {
  await tx('recordings', 'readwrite', (s) => s.put(blob, key));
  setOwn(new Set(own).add(key));
}

export async function deleteRecording(key: string) {
  await tx('recordings', 'readwrite', (s) => s.delete(key));
  const next = new Set(own);
  next.delete(key);
  setOwn(next);
}

/**
 * Звучить завжди щось одне. Кожен новий звук скасовує попередній - і той, що звучить,
 * і той, що ще читається зі сховища чи завантажується: інакше повільний старий запит
 * може пізніше перебити новий звук.
 */
let current: HTMLAudioElement | undefined;
let generation = 0;
/** Поки відкритий мікрофон, нічого не відтворюємо, щоб звук не потрапив у запис. */
let micOpen = false;

/** Зупиняє все, що звучить чи от-от мало зазвучати. Повертає номер нового запиту. */
function claim(): number {
  current?.pause();
  current = undefined;
  return ++generation;
}

export function stopPlayback() {
  claim();
}

/** Відтворює url і чекає кінця звуку (або поки його перебʼє інший). false - не зазвучало. */
async function playUrl(url: string, gen: number): Promise<boolean> {
  if (gen !== generation || micOpen) return false;
  const el = new Audio(url);
  current = el;
  const finished = new Promise<void>((resolve) => {
    el.onended = el.onpause = el.onerror = () => resolve();
  });
  try {
    await el.play();
  } catch {
    if (current === el) current = undefined;
    return false;
  }
  await finished;
  if (current === el) current = undefined;
  return true;
}

async function playBlobAs(blob: Blob, gen: number): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  try {
    return await playUrl(url, gen);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Відтворює запис і чекає, поки він дозвучить; попередній звук зупиняється. */
export function playBlob(blob: Blob): Promise<boolean> {
  return playBlobAs(blob, claim());
}

/** Відтворює свій запис дорослого, а якщо його немає - вбудований голос. */
export async function playRecording(key: string): Promise<boolean> {
  const gen = claim();
  if (own.has(key)) {
    try {
      const blob = await tx<Blob | undefined>('recordings', 'readonly', (s) => s.get(key));
      if (blob) return await playBlobAs(blob, gen);
    } catch {
      // Не вдалося прочитати свій запис - спробуємо вбудований голос.
    }
  }
  return builtinVoice(key, gen);
}

/**
 * Відтворює вбудований голос «Стежинки», навіть якщо є свій запис (щоб дорослий міг порівняти).
 */
export function playBuiltinVoice(key: string): Promise<boolean> {
  return builtinVoice(key, claim());
}

/**
 * Файл беремо через fetch і граємо як blob: Safari не відтворює аудіо, яке service worker
 * віддає з кешу без підтримки Range-запитів.
 */
async function builtinVoice(key: string, gen: number): Promise<boolean> {
  const file = BUILTIN_VOICE[key];
  if (!file) return false;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}voice/${file}`);
    return response.ok ? await playBlobAs(await response.blob(), gen) : false;
  } catch {
    return false;
  }
}

function subscribe(l: () => void) {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

const getPlayable = () => playable;
const getOwn = () => own;

/** Що можна відтворити: свої записи й вбудований голос. */
export function useRecordingKeys(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getPlayable, getPlayable);
}

/** Лише записи дорослого на цьому пристрої (для розділу «Ваш голос»). */
export function useOwnRecordingKeys(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getOwn, getOwn);
}

/** Чи можна записувати звук на цьому пристрої (потрібне https або localhost). */
export function canRecord(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
}

/** Записує звук до виклику stop() або максимум maxMs. `done` - готовий запис. */
export async function startRecording(maxMs = 2500): Promise<{ stop: () => void; done: Promise<Blob> }> {
  // Тиша перед записом: голос із динаміка чи «бульбашка» дотику інакше потрапляють у запис.
  claim();
  setMic(true);
  let stream: MediaStream | undefined;
  try {
    // Шумоподавлення «з'їдає» шиплячі й свистячі (с-с-с, ш-ш-ш), а ехоподавлення на iPhone
    // вмикає «телефонний» режим звуку. Обидва не потрібні: поки йде запис, нічого не звучить.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    const tracks = stream.getTracks();
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        tracks.forEach((t) => t.stop());
        setMic(false);
        resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      };
    });
    const stop = () => {
      window.clearTimeout(timer);
      if (rec.state === 'recording') rec.stop();
    };
    rec.start();
    const timer = window.setTimeout(stop, maxMs);
    return { stop, done };
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    setMic(false);
    throw e;
  }
}

function setMic(open: boolean) {
  micOpen = open;
  setMicOpen(open);
}

/** Питаємо дозвіл на мікрофон заздалегідь, у режимі дорослого, щоб дитина не бачила цього питання. */
export async function requestMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
