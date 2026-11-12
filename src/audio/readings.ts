import { useSyncExternalStore } from 'react';
import { newestFirst, overflow, type PendingReading } from '../logic/readingQueue';
import { tx } from './db';
import { playBlob } from './recordings';

/**
 * Як дитина читала вголос: запис голосу чекає на пристрої, поки дорослий послухає
 * й відмітить у розділі для дорослих. Після відмітки запис видаляється.
 */
interface StoredReading extends PendingReading {
  blob: Blob;
}

let items: PendingReading[] = [];
let listeners: Array<() => void> = [];

function set(next: PendingReading[]) {
  items = newestFirst(next);
  listeners.forEach((l) => l());
}

export async function loadReadings() {
  try {
    const all = await tx<StoredReading[]>('readings', 'readonly', (s) => s.getAll());
    set(all.map(({ id, text, at }) => ({ id, text, at })));
  } catch {
    // IndexedDB недоступна (приватний режим) - просто без записів.
  }
}

export async function saveReading(text: string, blob: Blob) {
  const item: PendingReading = { id: crypto.randomUUID(), text: text.toLocaleLowerCase('uk-UA'), at: new Date().toISOString() };
  await tx('readings', 'readwrite', (s) => s.put({ ...item, blob } satisfies StoredReading));
  const next = [...items, item];
  const drop = overflow(next);
  if (drop.length) await Promise.all(drop.map((id) => tx('readings', 'readwrite', (s) => s.delete(id))));
  set(next.filter((r) => !drop.includes(r.id)));
}

export async function playReading(id: string): Promise<boolean> {
  try {
    const r = await tx<StoredReading | undefined>('readings', 'readonly', (s) => s.get(id));
    return r ? await playBlob(r.blob) : false;
  } catch {
    return false;
  }
}

export async function removeReading(id: string) {
  await tx('readings', 'readwrite', (s) => s.delete(id));
  set(items.filter((r) => r.id !== id));
}

export async function clearReadings() {
  await tx('readings', 'readwrite', (s) => s.clear());
  set([]);
}

function subscribe(l: () => void) {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

const getItems = () => items;

export function usePendingReadings(): PendingReading[] {
  return useSyncExternalStore(subscribe, getItems, getItems);
}
