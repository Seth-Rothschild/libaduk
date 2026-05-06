import { browser } from '$app/environment';

const DB_NAME = 'libaduk';
const DB_VERSION = 1;
const STORE = 'stone-themes';
const ACTIVE_KEY = 'go-theme-active';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db, record) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db, id) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

const sessionUrls = new Map();

function makeThumbnail(blob, w, h) {
  return new Promise((resolve) => {
    const img = new Image();
    const src = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(src);
      canvas.toBlob((thumb) => resolve(URL.createObjectURL(thumb)), 'image/jpeg', 0.8);
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      resolve(null);
    };
    img.src = src;
  });
}

async function makeUrls(theme) {
  const urls = {};
  urls.black = theme.blackStones.map((b) => URL.createObjectURL(b));
  urls.white = theme.whiteStones.map((w) => URL.createObjectURL(w));
  if (theme.board) {
    urls.board = URL.createObjectURL(theme.board);
    urls.boardThumb = await makeThumbnail(theme.board, 152, 88);
  }
  urls.boardColor = theme.boardColor ?? null;
  return urls;
}

function revokeUrls(urls) {
  [...urls.black, ...urls.white].forEach((u) => URL.revokeObjectURL(u));
  if (urls.board) URL.revokeObjectURL(urls.board);
}

class StoneTheme {
  themes = $state([]);
  activeId = $state(null);
  #db = null;

  async init() {
    if (!browser) return;
    this.#db = await openDB();
    const stored = await idbGetAll(this.#db);
    for (const theme of stored) {
      sessionUrls.set(theme.id, await makeUrls(theme));
    }
    this.themes = stored;
    const savedId = localStorage.getItem(ACTIVE_KEY);
    const parsedId = savedId ? Number(savedId) : null;
    this.activeId = stored.some((t) => t.id === parsedId) ? parsedId : null;
  }

  async addTheme(name, { blackStones, whiteStones, board, boardColor }) {
    const record = {
      name,
      blackStones: blackStones ?? [],
      whiteStones: whiteStones ?? [],
      board: board ?? null,
      boardColor: boardColor ?? null
    };
    const id = await idbPut(this.#db, record);
    record.id = id;
    sessionUrls.set(id, await makeUrls(record));
    this.themes = [...this.themes, record];
    return id;
  }

  async setActive(id) {
    this.activeId = id;
    if (id === null) localStorage.removeItem(ACTIVE_KEY);
    else localStorage.setItem(ACTIVE_KEY, String(id));
  }

  async removeTheme(id) {
    await idbDelete(this.#db, id);
    const urls = sessionUrls.get(id);
    if (urls) {
      revokeUrls(urls);
      sessionUrls.delete(id);
    }
    this.themes = this.themes.filter((t) => t.id !== id);
    if (this.activeId === id) {
      await this.setActive(null);
    }
  }

  urlsFor(id) {
    return sessionUrls.get(id) ?? { black: [], white: [] };
  }
}

export const stoneTheme = new StoneTheme();
