// Saves each signed-in user's own prices, per part, in Workers KV.
// The user is identified by the Cloudflare Access login token, which is verified here.

const MAX_KEYS = 2000;
let certCache = null;

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getCerts(env) {
  if (certCache && certCache.t > Date.now() - 3600_000) return certCache.keys;
  const r = await fetch(`https://${env.TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('certs');
  const j = await r.json();
  certCache = { t: Date.now(), keys: j.keys };
  return j.keys;
}

async function userEmail(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
    const keys = await getCerts(env);
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.POLICY_AUD)) return null;
    if (payload.iss !== `https://${env.TEAM_DOMAIN}`) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch (e) {
    return null;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/prices') return env.ASSETS.fetch(request);

    const email = await userEmail(request, env);
    if (!email) return json({ error: 'not signed in' }, 401);
    const kvKey = 'u:' + email;

    if (request.method === 'GET') {
      const prices = (await env.PRICES.get(kvKey, 'json')) || {};
      return json({ email, prices });
    }

    if (request.method === 'PUT') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const key = typeof body.key === 'string' ? body.key.trim().slice(0, 140) : '';
      if (!key) return json({ error: 'missing key' }, 400);
      const prices = (await env.PRICES.get(kvKey, 'json')) || {};
      if (body.price === null) {
        delete prices[key];
      } else {
        const p = Number(body.price);
        if (!isFinite(p) || p < 0 || p > 1000000) return json({ error: 'bad price' }, 400);
        if (!(key in prices) && Object.keys(prices).length >= MAX_KEYS) return json({ error: 'too many saved prices' }, 400);
        prices[key] = Math.round(p * 100) / 100;
      }
      await env.PRICES.put(kvKey, JSON.stringify(prices));
      return json({ ok: true });
    }

    return json({ error: 'method not allowed' }, 405);
  },
};
