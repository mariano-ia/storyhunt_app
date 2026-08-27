#!/usr/bin/env node
// Dump full description/excerpt for given Bokun activity ids (read-only).
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const REPO = path.dirname(__dirname);
const env = {};
for (const line of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('='); env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
const ACCESS = env.BOKUN_ACCESS_KEY, SECRET = env.BOKUN_SECRET_KEY, BASE = 'https://api.bokun.io';
const get = (p) => {
  const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const sig = crypto.createHmac('sha1', SECRET).update(date + ACCESS + 'GET' + p, 'utf8').digest('base64');
  const out = execFileSync('curl', ['-s', '-X', 'GET', '-H', `X-Bokun-Date: ${date}`, '-H', `X-Bokun-AccessKey: ${ACCESS}`,
    '-H', `X-Bokun-Signature: ${sig}`, '-H', 'X-Bokun-Currency: USD', '-H', 'X-Bokun-Lang: EN',
    '-H', 'Content-Type: application/json', `${BASE}${p}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(out);
};
for (const id of (process.argv.slice(2).length ? process.argv.slice(2) : ['1218385', '1227395', '1218444'])) {
  const a = get(`/activity.json/${id}`);
  console.log(`\n\n========== #${id} — ${a.title} ==========`);
  console.log(`--- EXCERPT (${(a.excerpt || '').length}) ---\n${a.excerpt || '(none)'}`);
  console.log(`\n--- DESCRIPTION (${(a.description || '').length}) ---\n${a.description || '(none)'}`);
}
