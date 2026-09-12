// ============================================================
// scripts/core/crypto.js — PBKDF2 hashing untuk PIN (Web Crypto)
// KelolaRacun
// ============================================================

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function generateSalt(length = 16) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bufToHex(bytes);
}

export async function hashPin(pin, saltHex) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const salt = hexToBuf(saltHex);
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
      return bufToHex(bits);
    } catch (e) {
      console.warn('[crypto] WebCrypto deriveBits gagal, fallback ke server:', e);
    }
  }

  const res = await fetch('/api/hash-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, salt: saltHex })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal proses hash PIN di server');
  }
  const data = await res.json();
  return data.hash;
}

export async function verifyPin(input, saltHex, expectedHex) {
  const candidate = await hashPin(input, saltHex);
  const a = hexToBuf(candidate);
  const b = hexToBuf(expectedHex);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}