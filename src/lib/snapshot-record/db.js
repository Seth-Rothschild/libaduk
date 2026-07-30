const DB_NAME = 'snapshot-record';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const FRAMES_STORE = 'frames';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(FRAMES_STORE)) {
        const frameStore = db.createObjectStore(FRAMES_STORE, {
          keyPath: 'frameId',
          autoIncrement: true
        });
        frameStore.createIndex('sessionId', 'sessionId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(db, storeNames, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const result = work(tx);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function createSession(sessionId, startedAt = Date.now()) {
  const db = await openDb();
  await runTransaction(db, SESSIONS_STORE, 'readwrite', (tx) => {
    tx.objectStore(SESSIONS_STORE).put({ sessionId, status: 'recording', startedAt });
  });
}

export async function getAllSessions() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readonly');
    const request = tx.objectStore(SESSIONS_STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.startedAt - a.startedAt));
    request.onerror = () => reject(request.error);
  });
}

export async function getSession(sessionId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readonly');
    const request = tx.objectStore(SESSIONS_STORE).get(sessionId);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function setSessionStatus(sessionId, status) {
  const db = await openDb();
  const tx = db.transaction(SESSIONS_STORE, 'readwrite');
  const store = tx.objectStore(SESSIONS_STORE);
  const session = await new Promise((resolve, reject) => {
    const request = store.get(sessionId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (session) store.put({ ...session, status });
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addFrame(sessionId, blob, timestamp) {
  const db = await openDb();
  await runTransaction(db, FRAMES_STORE, 'readwrite', (tx) => {
    tx.objectStore(FRAMES_STORE).add({ sessionId, blob, timestamp });
  });
}

export async function getFrames(sessionId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FRAMES_STORE, 'readonly');
    const index = tx.objectStore(FRAMES_STORE).index('sessionId');
    const request = index.getAll(sessionId);
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.timestamp - b.timestamp));
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFrame(frameId) {
  const db = await openDb();
  await runTransaction(db, FRAMES_STORE, 'readwrite', (tx) => {
    tx.objectStore(FRAMES_STORE).delete(frameId);
  });
}

export async function deleteSession(sessionId) {
  const db = await openDb();
  const frames = await getFrames(sessionId);
  await runTransaction(db, [SESSIONS_STORE, FRAMES_STORE], 'readwrite', (tx) => {
    tx.objectStore(SESSIONS_STORE).delete(sessionId);
    const frameStore = tx.objectStore(FRAMES_STORE);
    for (const frame of frames) frameStore.delete(frame.frameId);
  });
}
