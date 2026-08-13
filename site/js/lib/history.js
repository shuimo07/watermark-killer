// 历史记录管理（localStorage）
import { CONFIG } from '../config.js';

const KEY = 'wz_history_v1';

export function getHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, CONFIG.historyLimit)));
  } catch (e) {
    console.warn('history save failed', e);
  }
}

export function addHistory(item) {
  const arr = getHistory();
  arr.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    time: Date.now(),
    ...item,
  });
  save(arr);
  return arr[0];
}

export function removeHistory(id) {
  save(getHistory().filter((x) => x.id !== id));
}

export function clearHistory() {
  save([]);
}
