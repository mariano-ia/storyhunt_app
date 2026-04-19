import { readFileSync, writeFileSync } from 'fs';

const envFile = readFileSync('.env.local', 'utf-8');
const match = envFile.match(/^OPENAI_API_KEY=(.+)$/m);
const key = match?.[1].replace(/^["']|["']$/g, '').trim();
if (!key) { console.error('No OPENAI_API_KEY'); process.exit(1); }

const file = readFileSync('public/voicemail.mp3');
const formData = new FormData();
formData.append('file', new Blob([file], { type: 'audio/mpeg' }), 'voicemail.mp3');
formData.append('model', 'whisper-1');
formData.append('response_format', 'verbose_json');
formData.append('timestamp_granularities[]', 'segment');

console.log('Transcribing...');

const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}` },
  body: formData,
});

const data = await res.json();
if (!res.ok) { console.error(data); process.exit(1); }

// Output segments as subtitle entries
const segments = data.segments || [];
for (const seg of segments) {
  const start = seg.start.toFixed(1);
  const end = seg.end.toFixed(1);
  console.log(`  { start: ${start}, end: ${end}, text: ${JSON.stringify(seg.text.trim())} },`);
}

writeFileSync('voicemail-segments.json', JSON.stringify(segments, null, 2));
console.log(`\nTotal duration: ${data.duration}s`);
console.log('Saved to voicemail-segments.json');
