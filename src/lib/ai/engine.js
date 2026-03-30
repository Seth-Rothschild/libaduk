import * as ort from 'onnxruntime-web';

const MODEL_DB_NAME = 'libaduk-ai';
const MODEL_STORE = 'models';
const MODEL_KEY = 'katago';
const SETTINGS_KEY = 'libaduk-ai-settings';
const LETTERS = 'ABCDEFGHJKLMNOPQRST';

const DEFAULT_SETTINGS = { threads: navigator.hardwareConcurrency ?? 1 };

export function loadEngineSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveEngineSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
}

let session = null;
let initialized = false;

function openModelDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MODEL_DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(MODEL_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveModel(buffer) {
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    tx.objectStore(MODEL_STORE).put(buffer, MODEL_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadModel() {
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readonly');
    const req = tx.objectStore(MODEL_STORE).get(MODEL_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function hasModel() {
  const buf = await loadModel();
  return buf !== null;
}

export async function initEngine() {
  if (initialized) return;

  const modelBuffer = await loadModel();
  if (!modelBuffer) {
    throw new Error('No model loaded. Please upload a KataGo ONNX model first.');
  }

  ort.env.wasm.numThreads = loadEngineSettings().threads;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = '/wasm/';

  session = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all'
  });

  initialized = true;
  console.log('[AI] Engine initialized (WASM)');
}

export function isReady() {
  return initialized;
}

function featurize(signMap, currentSign, komi, history) {
  const size = signMap.length;
  const pla = currentSign;
  const opp = pla === 1 ? -1 : 1;

  const binInput = new Float32Array(22 * size * size);
  const globalInput = new Float32Array(19);

  function set(c, h, w, val) {
    binInput[c * size * size + h * size + w] = val;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      set(0, y, x, 1.0);

      const color = signMap[y][x];
      if (color === pla) set(1, y, x, 1.0);
      else if (color === opp) set(2, y, x, 1.0);

      if (color !== 0) {
        const libs = countLiberties(signMap, x, y, size);
        if (libs === 1) set(3, y, x, 1.0);
        if (libs === 2) set(4, y, x, 1.0);
        if (libs === 3) set(5, y, x, 1.0);
      }
    }
  }

  const len = history.length;
  for (let i = 0; i < 5; i++) {
    if (len >= i + 1) {
      const m = history[len - 1 - i];
      if (m && m.x >= 0 && m.x < size && m.y >= 0 && m.y < size) {
        set(9 + i, m.y, m.x, 1.0);
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    if (len >= i + 1) {
      const m = history[len - 1 - i];
      if (m && m.x < 0) {
        globalInput[i] = 1.0;
      }
    }
  }

  globalInput[5] = komi / 20.0;

  return { binInput, globalInput };
}

function countLiberties(signMap, x, y, size) {
  const color = signMap[y][x];
  if (color === 0) return 0;

  const visited = new Set();
  const liberties = new Set();
  const stack = [[x, y]];

  while (stack.length > 0) {
    const [cx, cy] = stack.pop();
    const key = cy * size + cx;
    if (visited.has(key)) continue;
    visited.add(key);

    const neighbors = [];
    if (cx > 0) neighbors.push([cx - 1, cy]);
    if (cx < size - 1) neighbors.push([cx + 1, cy]);
    if (cy > 0) neighbors.push([cx, cy - 1]);
    if (cy < size - 1) neighbors.push([cx, cy + 1]);

    for (const [nx, ny] of neighbors) {
      const nc = signMap[ny][nx];
      if (nc === 0) {
        liberties.add(ny * size + nx);
      } else if (nc === color) {
        stack.push([nx, ny]);
      }
    }
  }

  return Math.min(liberties.size, 4);
}

function pickWeighted(candidates) {
  let total = 0;
  for (const c of candidates) total += c.prob;
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.prob;
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

export async function generateMove(signMap, currentSign, komi, history, difficulty = 10) {
  if (!session) throw new Error('Engine not initialized');

  const size = signMap.length;
  const { binInput, globalInput } = featurize(signMap, currentSign, komi, history);

  const binTensor = new ort.Tensor('float32', binInput, [1, 22, size, size]);
  const globalTensor = new ort.Tensor('float32', globalInput, [1, 19]);

  const results = await session.run({
    bin_input: binTensor,
    global_input: globalTensor
  });

  const policyData = results.policy.data;
  const policyDims = results.policy.dims;
  const numMoves = policyDims.length === 3 ? Number(policyDims[2]) : Number(policyDims[1]);
  const policy = policyData.subarray(0, numMoves);

  let maxLogit = -Infinity;
  for (let i = 0; i < numMoves; i++) {
    if (policy[i] > maxLogit) maxLogit = policy[i];
  }

  const temperature = difficulty >= 10 ? 0.01 : 0.5 + (10 - difficulty) * 0.3;
  const probs = new Float32Array(numMoves);
  let sumProbs = 0;
  for (let i = 0; i < numMoves; i++) {
    probs[i] = Math.exp((policy[i] - maxLogit) / temperature);
    sumProbs += probs[i];
  }
  for (let i = 0; i < numMoves; i++) {
    probs[i] /= sumProbs;
  }

  const indices = Array.from({ length: numMoves }, (_, i) => i);
  indices.sort((a, b) => probs[b] - probs[a]);

  const topK = difficulty >= 10 ? 1 : Math.max(2, 20 - difficulty * 2);
  const candidates = [];
  for (const idx of indices) {
    if (candidates.length >= topK) break;
    if (idx === size * size) {
      candidates.push({ move: 'pass', x: -1, y: -1, prob: probs[idx] });
    } else {
      const y = Math.floor(idx / size);
      const x = idx % size;
      if (signMap[y][x] === 0) {
        candidates.push({ move: LETTERS[x] + String(size - y), x, y, prob: probs[idx] });
      }
    }
  }

  if (candidates.length === 0) return { move: 'pass', x: -1, y: -1 };

  const chosen = pickWeighted(candidates);
  return { move: chosen.move, x: chosen.x, y: chosen.y };
}

export async function getModelSize() {
  const buf = await loadModel();
  return buf ? buf.byteLength : null;
}

export async function deleteModel() {
  if (session) {
    session.release();
    session = null;
  }
  initialized = false;
  const db = await openModelDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, 'readwrite');
    tx.objectStore(MODEL_STORE).delete(MODEL_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dispose() {
  if (session) {
    session.release();
    session = null;
  }
  initialized = false;
}
