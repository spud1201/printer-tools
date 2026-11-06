// Saves each signed-in user's own prices, logo and clients (with saved quotes) in Workers KV.
// The user is identified by the Cloudflare Access login token, which is verified here.

const MAX_KEYS = 2000;
const MAX_CLIENTS = 150;
const MAX_STATE = 60000;
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
    if (url.pathname !== '/api/prices' && url.pathname !== '/api/logo' && url.pathname !== '/api/clients') return env.ASSETS.fetch(request);

    const email = await userEmail(request, env);
    if (!email) return json({ error: 'not signed in' }, 401);
    const kvKey = 'u:' + email;

    if (url.pathname === '/api/clients') {
      const ck = 'cl:' + email;
      const all = (await env.PRICES.get(ck, 'json')) || {};
      if (request.method === 'GET') return json({ clients: all });
      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id') || '';
        delete all[id];
        await env.PRICES.put(ck, JSON.stringify(all));
        return json({ ok: true });
      }
      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
        const id = typeof body.id === 'string' ? body.id : '';
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
        if (!/^c[a-z0-9]{3,24}$/.test(id) || !name) return json({ error: 'bad client' }, 400);
        if (!(id in all) && Object.keys(all).length >= MAX_CLIENTS) return json({ error: 'too many clients' }, 400);
        const rec = all[id] || {};
        rec.name = name;
        rec.updated = Date.now();
        if (typeof body.notes === 'string') rec.notes = body.notes.slice(0, 4000);
        if (body.status === 'quoted' || body.status === 'buying') rec.status = body.status;
        if (body.contact && typeof body.contact === 'object') {
          const c = {};
          for (const f of ['person', 'phone', 'email', 'address']) {
            if (typeof body.contact[f] === 'string' && body.contact[f].trim()) c[f] = body.contact[f].trim().slice(0, f === 'address' ? 300 : 120);
          }
          rec.contact = c;
        }
        if (body.pnote && Number.isInteger(body.pnote.key) && body.pnote.key >= 0 && body.pnote.key < 100000 && typeof body.pnote.text === 'string') {
          rec.pnotes = rec.pnotes || {};
          const t = body.pnote.text.trim().slice(0, 500);
          if (!t) delete rec.pnotes[body.pnote.key];
          else if (body.pnote.key in rec.pnotes || Object.keys(rec.pnotes).length < 300) rec.pnotes[body.pnote.key] = t;
        }
        if (body.tool === 'quote' || body.tool === 'margin') {
          if (!body.state || typeof body.state !== 'object' || JSON.stringify(body.state).length > MAX_STATE) return json({ error: 'quote too large' }, 400);
          rec[body.tool] = body.state;
        }
        all[id] = rec;
        await env.PRICES.put(ck, JSON.stringify(all));
        return json({ ok: true });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    if (url.pathname === '/api/logo') {
      const logoKey = 'logo:' + email;
      if (request.method === 'GET') return json({ logo: (await env.PRICES.get(logoKey)) || null });
      if (request.method === 'DELETE') { await env.PRICES.delete(logoKey); return json({ ok: true }); }
      if (request.method === 'PUT') {
        let body;
        try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
        if (body.logo === null) { await env.PRICES.delete(logoKey); return json({ ok: true }); }
        const v = body.logo;
        if (typeof v !== 'string' || v.length > 400000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+\/=]+$/.test(v)) return json({ error: 'bad logo' }, 400);
        await env.PRICES.put(logoKey, v);
        return json({ ok: true });
      }
      return json({ error: 'method not allowed' }, 405);
    }

    if (request.method === 'GET') {
      const prices = (await env.PRICES.get(kvKey, 'json')) || {};
      return json({ email, prices });
    }

    if (request.method === 'PUT') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      if (body.clear === true) { await env.PRICES.delete(kvKey); return json({ ok: true }); }
      if (body.bulk && typeof body.bulk === 'object' && !Array.isArray(body.bulk)) {
        const cur = (await env.PRICES.get(kvKey, 'json')) || {};
        for (const [k0, v] of Object.entries(body.bulk)) {
          const k = String(k0).trim().slice(0, 140);
          const p = Number(v);
          if (!k || !isFinite(p) || p < 0 || p > 1000000) continue;
          cur[k] = Math.round(p * 100) / 100;
        }
        if (Object.keys(cur).length > MAX_KEYS) return json({ error: 'too many saved prices' }, 400);
        await env.PRICES.put(kvKey, JSON.stringify(cur));
        return json({ ok: true, count: Object.keys(cur).length });
      }
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
