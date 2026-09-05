// ============================================================
// scripts/core/eventBus.js — Tiny pub/sub for UI reactivity
// KelolaRacun Phase 3 — Dynamic Screens
// ============================================================

const listeners = new Map();

export function subscribe(eventName, callback) {
  if (!listeners.has(eventName)) listeners.set(eventName, new Set());
  listeners.get(eventName).add(callback);
  return () => unsubscribe(eventName, callback);
}

export function unsubscribe(eventName, callback) {
  listeners.get(eventName)?.delete(callback);
}

export function publish(eventName, detail = {}) {
  const callbacks = listeners.get(eventName);
  if (!callbacks) return;
  callbacks.forEach((cb) => {
    try {
      cb(detail);
    } catch (err) {
      console.error(`[eventBus] listener "${eventName}" gagal:`, err);
    }
  });
}