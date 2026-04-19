import { writeFileSync } from 'fs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  // Try loading from .env.local
  const { readFileSync } = await import('fs');
  const envFile = readFileSync('.env.local', 'utf-8');
  const match = envFile.match(/^OPENAI_API_KEY=(.+)$/m);
  if (match) process.env.OPENAI_API_KEY = match[1].replace(/^["']|["']$/g, '').trim();
}

const key = process.env.OPENAI_API_KEY;
if (!key) { console.error('No OPENAI_API_KEY found'); process.exit(1); }

const text = `The most beautiful subway station in New York was built in nineteen oh four. Closed since nineteen forty-five. And you can see it today.

Get on the six train. Ride to Brooklyn Bridge — last stop. Don't get off. Stay in the car.

The train loops back through the old City Hall station. Sit on the right side.

Green tiles. Stained glass skylights. Brass chandeliers. All still there.

You're welcome.`;

console.log('Generating voicemail audio...');

const res = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'tts-1-hd',
    voice: 'onyx',
    input: text,
    speed: 0.88,
    response_format: 'mp3',
  }),
});

if (!res.ok) {
  console.error('API error:', res.status, await res.text());
  process.exit(1);
}

const buffer = Buffer.from(await res.arrayBuffer());
writeFileSync('public/voicemail.mp3', buffer);
console.log(`Generated voicemail.mp3 (${(buffer.length / 1024).toFixed(0)} KB)`);
