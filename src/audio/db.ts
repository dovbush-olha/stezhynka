/**
 * Сховище звуку на самому пристрої (IndexedDB). Нічого не надсилається в інтернет.
 * - `recordings`: голос дорослого для звуків букв (ключ → Blob);
 * - `readings`: як дитина читала сама, чекає, поки дорослий послухає (див. readings.ts).
 */
const DB_NAME = 'maya-adventures';
const VERSION = 2;

export type StoreName = 'recordings' | 'readings';

let opening: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings');
      if (!db.objectStoreNames.contains('readings')) db.createObjectStore('readings', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      // Інша вкладка оновлює базу - звільняємо її, наступний запит відкриє нову версію.
      req.result.onversionchange = () => {
        req.result.close();
        opening = undefined;
      };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  }).catch((e: unknown) => {
    opening = undefined;
    throw e;
  });
  return opening;
}

export async function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** Кілька дій в одній транзакції: або все записалося, або нічого. */
export async function txAll(store: StoreName, fn: (s: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite');
    fn(t.objectStore(store));
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
