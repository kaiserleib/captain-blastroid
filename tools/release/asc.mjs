// Minimal App Store Connect API client for the release scripts.
// Reads ASC_KEY_ID and ASC_ISSUER_ID from the environment (they are in .env.local).
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import process from 'node:process';

const b64 = (b) => Buffer.from(b).toString('base64url');

function token() {
  const kid = process.env.ASC_KEY_ID;
  const iss = process.env.ASC_ISSUER_ID;
  if (!kid || !iss) throw new Error('set ASC_KEY_ID and ASC_ISSUER_ID');
  const key = createPrivateKey(
    readFileSync(`${homedir()}/.appstoreconnect/private_keys/AuthKey_${kid}.p8`),
  );
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }));
  const body = b64(JSON.stringify({ iss, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64(sig)}`;
}

/** Calls the API; throws with Apple's error text on a non-2xx answer. */
export async function asc(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : null;
}
