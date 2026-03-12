const DB_NAME = "vr-media-store";
const DB_VERSION = 1;
const STORE_NAME = "files";

export type StoredMediaFile = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  updatedAt: number;
};

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) => {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    };
  });
};

export const saveFileToStore = async (slot: string, file: File | Blob, name?: string, type?: string) => {
  const payload: StoredMediaFile = {
    id: slot,
    name: name ?? (file instanceof File ? file.name : "file"),
    type: type ?? file.type,
    blob: file,
    updatedAt: Date.now()
  };

  await runTransaction("readwrite", (store) => store.put(payload));
};

export const loadFileFromStore = async (slot: string) => {
  const result = await runTransaction<StoredMediaFile | undefined>("readonly", (store) =>
    store.get(slot)
  );
  return result ?? null;
};

export const clearFileFromStore = async (slot: string) => {
  await runTransaction("readwrite", (store) => store.delete(slot));
};
