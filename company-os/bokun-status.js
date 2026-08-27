#!/usr/bin/env node
// Bokun REST status check (read-only). Confirms product + distribution status
// via the management API. Creds: BOKUN_ACCESS_KEY/SECRET_KEY in .env.local.
// Transport via curl (handles the sandbox's intercepting TLS proxy).
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.dirname(__dirname);
function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}
const env = loadEnv();
const ACCESS = env.BOKUN_ACCESS_KEY, SECRET = env.BOKUN_SECRET_KEY;
const BASE = 'https://api.bokun.io';

const bokunDate = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const sign = (date, method, p) =>
  crypto.createHmac('sha1', SECRET).update(date + ACCESS + method + p, 'utf8').digest('base64');

function req(method, p, body) {
  const date = bokunDate();
  const sig = sign(date, method, p);
  const args = ['-s', '-X', method,
    '-H', `X-Bokun-Date: ${date}`,
    '-H', `X-Bokun-AccessKey: ${ACCESS}`,
    '-H', `X-Bokun-Signature: ${sig}`,
    '-H', 'X-Bokun-Currency: USD',
    '-H', 'X-Bokun-Lang: EN',
    '-H', 'Content-Type: application/json'];
  if (body) args.push('--data', JSON.stringify(body));
  args.push(`${BASE}${p}`);
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  try { return JSON.parse(out); } catch { return { _raw: out.slice(0, 400) }; }
}

if (!ACCESS || !SECRET) { console.log('MISSING BOKUN creds in .env.local'); process.exit(2); }

const IDS = ['1218385', '1218431', '1218444', '1227395'];
console.log('=== ACTIVITIES ===');
for (const id of IDS) {
  const a = req('GET', `/activity.json/${id}`);
  if (a._raw !== undefined) { console.log(`#${id}: NON-JSON/ERROR →`, a._raw); continue; }
  console.log(`#${id} — ${a.title}`);
  console.log(`   ${JSON.stringify({
    published: a.published,
    price: a.nextDefaultPrice,
    marketplaceVisibilityType: a.marketplaceVisibilityType,
    tripadvisorReview: a.tripadvisorReview,
    reviewRating: a.reviewRating, reviewCount: a.reviewCount,
    affiliateHubProduct: a.affiliateHubProduct,
    lastPublished: a.lastPublished,
    photos: Array.isArray(a.photos) ? a.photos.length : a.photos,
    descLen: (a.description || '').length,
    flags: a.flags,
  })}`);
}
