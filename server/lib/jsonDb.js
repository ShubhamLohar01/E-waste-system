import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

export function collectionExists(name) {
  return fs.existsSync(filePath(name));
}

export function loadCollection(name, initial = []) {
  ensureDir();
  const p = filePath(name);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify(initial, null, 2), 'utf8');
    return [...initial];
  }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [...initial];
  } catch (e) {
    console.error(`[jsonDb] Failed loading ${name}.json — starting fresh`, e.message);
    return [...initial];
  }
}

export function saveCollection(name, arr) {
  ensureDir();
  try {
    fs.writeFileSync(filePath(name), JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    console.error(`[jsonDb] Failed saving ${name}.json`, e.message);
  }
}
