'use client';

import { useEffect, useState, useCallback } from 'react';
import { Copy, Check, ChevronRight, KeyRound } from 'lucide-react';
import {
  trackViewContent,
  trackInitiateCheckout,
  trackAddPaymentInfo,
  flushPendingEvents,
} from '@/lib/analytics';

// ─── Config ──────────────────────────────────────────────────────────────────
// STREET is the sticker code: founder access + giftable (referral) + the only
// reliable scan-attribution key (UTM is broken; coupon path works e2e).
const PROMO_CODE = 'STREET';
const SCAN_SOURCE = 'scan-sticker';

type Experience = {
  id: string;
  name: string;
  name_en?: string;
  slug: string;
  status: string;
  web_tagline?: string;
  web_tagline_en?: string;
  web_image?: string;
  price: number;
  location?: string;
  duration?: string;
  starting_point?: string;
};

// ─── Intro transmission (the captivating hook) ───────────────────────────────
type LineKind = 'sys' | 'line' | 'emph' | 'hook';
const INTRO_LINES: { text: string; kind: LineKind; pause?: number }[] = [
  { text: 'incoming transmission_', kind: 'sys', pause: 500 },
  { text: 'You scanned a sticker on a wall.', kind: 'line', pause: 350 },
  { text: 'Most people walked right past it.', kind: 'line', pause: 350 },
  { text: "You didn't.", kind: 'emph', pause: 700 },
  { text: 'Not a tour. Not a game.', kind: 'hook', pause: 350 },
  { text: 'For the next 2 hours, New York talks to you — and only you can hear it.', kind: 'line', pause: 200 },
];

// ─── Typing effect ───────────────────────────────────────────────────────────
function useTypingEffect(text: string, active: boolean, speed = 16) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed('');
      setDone(false);
      return;
    }
    let i = 0;
    setDisplayed('');
    setDone(false);
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, active, speed]);

  return { displayed, done };
}

// ─── Intro phase ─────────────────────────────────────────────────────────────
function IntroPhase({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const finished = skipped || idx >= INTRO_LINES.length;
  const current = INTRO_LINES[idx];
  const { displayed, done } = useTypingEffect(current?.text ?? '', !skipped && idx < INTRO_LINES.length);

  // Advance to the next line once the current one finishes typing.
  useEffect(() => {
    if (skipped || !done || idx >= INTRO_LINES.length) return;
    const t = setTimeout(() => setIdx((i) => i + 1), current?.pause ?? 350);
    return () => clearTimeout(t);
  }, [done, idx, skipped, current]);

  const skip = () => setSkipped(true);

  const lineStyle = (kind: LineKind): React.CSSProperties => {
    switch (kind) {
      case 'sys':
        return { fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#00d2ff', letterSpacing: '0.1em', textTransform: 'uppercase' };
      case 'emph':
        return { fontFamily: "'Fira Sans', sans-serif", fontSize: 'clamp(20px, 6vw, 26px)', fontWeight: 700, color: '#fff', lineHeight: 1.25 };
      case 'hook':
        return { fontFamily: "'Fira Code', monospace", fontSize: 'clamp(16px, 4.6vw, 20px)', fontWeight: 700, color: '#ff0033', letterSpacing: '0.02em', lineHeight: 1.3 };
      default:
        return { fontFamily: "'Fira Sans', sans-serif", fontSize: 'clamp(16px, 4.4vw, 19px)', color: '#CBD5E1', lineHeight: 1.55 };
    }
  };

  const visibleLines = skipped ? INTRO_LINES : INTRO_LINES.slice(0, idx);

  return (
    <div
      onClick={!finished ? skip : undefined}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '32px 24px 40px',
        position: 'relative',
        overflow: 'hidden',
        cursor: !finished ? 'pointer' : 'default',
        background: 'radial-gradient(ellipse 78% 48% at 50% 42%, rgba(255,0,51,0.11), transparent 72%)',
      }}
    >
      <div className="scan-scanline" />

      <img src="/logo.png" alt="StoryHunt" style={{ height: 26, opacity: 0.75, marginBottom: 16, alignSelf: 'center' }} />

      <div className="scan-badge">
        <span className="scan-badge-dot" />
        AUTHORIZED ACCESS · NYC
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        {visibleLines.map((l, i) => (
          <p key={i} style={{ ...lineStyle(l.kind), margin: 0, animation: 'scanFadeIn 0.4s ease-out' }}>
            {l.kind === 'sys' && <span style={{ color: '#00d2ff', marginRight: 6 }}>{'>'}</span>}
            {l.kind === 'hook' ? (
              <span className="scan-glitch" data-text={l.text}>{l.text}</span>
            ) : (
              l.text
            )}
          </p>
        ))}

        {/* Currently typing line */}
        {!skipped && idx < INTRO_LINES.length && (
          <p style={{ ...lineStyle(current.kind), margin: 0 }}>
            {current.kind === 'sys' && <span style={{ color: '#00d2ff', marginRight: 6 }}>{'>'}</span>}
            {displayed}
            <span className="scan-cursor">|</span>
          </p>
        )}
      </div>

      {finished ? (
        <button onClick={onDone} className="scan-cta-primary" style={{ marginTop: 36, alignSelf: 'flex-start', animation: 'scanFadeIn 0.5s ease-out' }}>
          CONTINUE <ChevronRight size={18} />
        </button>
      ) : (
        <p style={{ marginTop: 36, fontFamily: "'Fira Code', monospace", fontSize: 11, color: '#374151', letterSpacing: '0.1em' }}>
          tap to skip
        </p>
      )}
    </div>
  );
}

// ─── Doors phase (experiences + giftable code) ───────────────────────────────
function DoorsPhase({ zone }: { zone: string | null }) {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [lang, setLang] = useState<'es' | 'en'>('en');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const browserLang = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
    setLang(browserLang.startsWith('es') ? 'es' : 'en');
  }, []);

  useEffect(() => {
    fetch('/api/public/experiences')
      .then((r) => r.json())
      .then((data) => {
        const all: Experience[] = Array.isArray(data) ? data : data.experiences || [];
        const published = all.filter((e) => e.status === 'published');
        setExperiences(published);
        if (published.length > 0) {
          trackViewContent(published.map((e) => e.id), { source: SCAN_SOURCE, campaign: zone ? `scan_${zone}` : 'scan_sticker' });
        }
      })
      .catch(() => setError('Could not load doors. Reload the page.'))
      .finally(() => setLoading(false));
  }, [zone]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(PROMO_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async (exp: Experience) => {
    setCheckoutLoading(exp.id);
    setError('');
    const extra = { content_name: exp.name, coupon: PROMO_CODE, source: SCAN_SOURCE, campaign: zone ? `scan_${zone}` : 'scan_sticker' };
    trackInitiateCheckout(exp.id, 0, lang, extra);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience_id: exp.id, lang, coupon_code: PROMO_CODE }),
      });
      const data = await res.json();
      if (data.url) {
        trackAddPaymentInfo(exp.id, 0, extra, { flush: true });
        await flushPendingEvents();
        window.location.href = data.url;
      } else {
        setError(data.error || 'This door is syncing — your code STREET still works at checkout.');
        setCheckoutLoading(null);
      }
    } catch {
      setError('Connection error. Try again.');
      setCheckoutLoading(null);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', padding: '28px 20px 60px', position: 'relative', maxWidth: 560, margin: '0 auto' }}>
      <div className="scan-scanline" />

      {/* Key / code */}
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', border: '2px solid #00ff41', marginBottom: 16, boxShadow: '0 0 24px rgba(0,255,65,0.25)' }}>
          <KeyRound size={26} color="#00ff41" />
        </div>
        <p style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: '#00ff41', letterSpacing: '0.12em', marginBottom: 10 }}>ACCESS_GRANTED</p>
        <h1 style={{ fontFamily: "'Fira Sans', sans-serif", fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: 700, color: '#fff', lineHeight: 1.2, margin: '0 0 8px' }}>
          You found the door.
        </h1>
        <p style={{ fontFamily: "'Fira Sans', sans-serif", fontSize: 15, color: '#94A3B8', lineHeight: 1.5, margin: '0 auto 18px', maxWidth: 360 }}>
          Here&apos;s your key. It&apos;s yours to keep — pass it to anyone who looks closer.
        </p>

        <button onClick={handleCopy} className="scan-code-chip" aria-label="Copy code STREET">
          <span>{PROMO_CODE}</span>
          {copied ? <Check size={18} color="#00ff41" /> : <Copy size={18} color="#ff0033" />}
        </button>
        <p style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: copied ? '#00ff41' : '#4B5563', marginTop: 8, minHeight: 14 }}>
          {copied ? 'copied — applied automatically below' : 'already applied when you pick a door'}
        </p>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '26px 0 22px' }} />

      <p style={{ fontFamily: "'Fira Code', monospace", fontSize: 12, color: '#ff0033', letterSpacing: '0.1em', textAlign: 'center', marginBottom: 18 }}>
        YOU&apos;RE STANDING IN THE RIGHT SPOT — PICK YOUR DOOR
      </p>

      {/* Doors */}
      <div className="scan-doors">
        {loading && <div className="scan-loading">LOADING_DOORS...</div>}
        {!loading && experiences.length === 0 && <div className="scan-loading">NO_DOORS_AVAILABLE</div>}
        {!loading &&
          experiences.map((exp) => {
            const name = lang === 'en' ? exp.name_en || exp.name : exp.name;
            const tagline = lang === 'en' ? exp.web_tagline_en || exp.web_tagline : exp.web_tagline;
            const isLoading = checkoutLoading === exp.id;
            return (
              <button key={exp.id} className="scan-door" onClick={() => handleClaim(exp)} disabled={isLoading} aria-label={`Open ${name}`}>
                {exp.web_image && <div className="scan-door-image" style={{ backgroundImage: `url(${exp.web_image})` }} />}
                <div className="scan-door-overlay" />
                <div className="scan-door-content">
                  <div className="scan-door-meta">
                    {exp.location && <span className="scan-door-location">{exp.location.toUpperCase()}</span>}
                    {exp.price > 0 && <span className="scan-door-price">${exp.price.toFixed(2)}</span>}
                  </div>
                  <h3 className="scan-door-name">{(name || '').toUpperCase()}</h3>
                  {tagline && <p className="scan-door-tagline">{tagline}</p>}
                  <div className="scan-door-cta">{isLoading ? 'OPENING...' : 'STEP_THROUGH →'}</div>
                </div>
              </button>
            );
          })}
      </div>

      {error && <div className="scan-error">{error}</div>}

      <p style={{ fontFamily: "'Fira Sans', sans-serif", fontSize: 12, color: '#4B5563', textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
        No account needed. Your code is already on the house.
      </p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
type Phase = 'intro' | 'doors';

export default function ScanPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [zone, setZone] = useState<string | null>(null);

  // Read ?z= zone tag (per-batch / per-neighborhood attribution) and skip the
  // intro on repeat visits within the same session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setZone(params.get('z'));
    if (sessionStorage.getItem('scan_seen')) setPhase('doors');
  }, []);

  const goToDoors = useCallback(() => {
    sessionStorage.setItem('scan_seen', '1');
    setPhase('doors');
  }, []);

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100dvh', position: 'relative' }}>
      {phase === 'intro' ? <IntroPhase onDone={goToDoors} /> : <DoorsPhase zone={zone} />}

      <style jsx global>{`
        .scan-scanline {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.03) 2px, rgba(0, 0, 0, 0.03) 4px);
        }
        .scan-cursor {
          color: #00d2ff;
          animation: scanBlink 0.8s step-end infinite;
        }
        /* In-world legitimacy badge */
        .scan-badge {
          align-self: center;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          margin-bottom: 30px;
          border: 1px solid rgba(0, 255, 65, 0.35);
          border-radius: 100px;
          background: rgba(0, 255, 65, 0.06);
          font-family: 'Fira Code', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: #7cffa0;
          text-transform: uppercase;
          animation: scanFadeIn 0.5s ease-out;
        }
        .scan-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00ff41;
          box-shadow: 0 0 8px rgba(0, 255, 65, 0.8);
          animation: scanDotPulse 1.6s ease-in-out infinite;
        }
        @keyframes scanDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(0, 255, 65, 0.5); }
          50% { opacity: 0.6; transform: scale(1.15); box-shadow: 0 0 0 5px rgba(0, 255, 65, 0); }
        }
        /* RGB-split glitch on the hook line — mirrors the storyhunt.city hero */
        .scan-glitch {
          position: relative;
          display: inline-block;
          color: #ff0033;
        }
        .scan-glitch::before,
        .scan-glitch::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .scan-glitch::before {
          left: 2px;
          text-shadow: -2px 0 #00d2ff;
          animation: scanGlitchA 3.5s infinite linear alternate-reverse;
        }
        .scan-glitch::after {
          left: -2px;
          text-shadow: 2px 0 #ff2d6d;
          animation: scanGlitchB 3.5s infinite linear alternate-reverse;
        }
        @keyframes scanGlitchA {
          0%, 100% { clip-path: inset(100% 0 0 0); transform: translateX(0); }
          2% { clip-path: inset(18% 0 56% 0); transform: translateX(-3px); }
          4% { clip-path: inset(58% 0 14% 0); transform: translateX(3px); }
          6% { clip-path: inset(100% 0 0 0); }
          48% { clip-path: inset(100% 0 0 0); }
          50% { clip-path: inset(34% 0 38% 0); transform: translateX(2px); }
          52% { clip-path: inset(100% 0 0 0); }
        }
        @keyframes scanGlitchB {
          0%, 100% { clip-path: inset(100% 0 0 0); transform: translateX(0); }
          3% { clip-path: inset(44% 0 24% 0); transform: translateX(3px); }
          5% { clip-path: inset(8% 0 70% 0); transform: translateX(-3px); }
          7% { clip-path: inset(100% 0 0 0); }
          51% { clip-path: inset(54% 0 20% 0); transform: translateX(-2px); }
          53% { clip-path: inset(100% 0 0 0); }
        }
        .scan-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 16px 32px;
          background: #ff0033;
          border: none;
          border-radius: 8px;
          color: #fff;
          font-family: 'Fira Code', monospace;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          min-height: 52px;
        }
        .scan-code-chip {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 12px 24px;
          background: rgba(255, 0, 51, 0.12);
          border: 1px dashed rgba(255, 0, 51, 0.45);
          border-radius: 10px;
          cursor: pointer;
          font-family: 'Fira Code', monospace;
          font-size: 26px;
          font-weight: 700;
          color: #ff0033;
          letter-spacing: 0.18em;
          transition: background 0.2s;
        }
        .scan-code-chip:hover {
          background: rgba(255, 0, 51, 0.18);
        }
        .scan-doors {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        @media (min-width: 600px) {
          .scan-doors {
            grid-template-columns: 1fr 1fr;
          }
        }
        .scan-door {
          all: unset;
          box-sizing: border-box;
          cursor: pointer;
          position: relative;
          aspect-ratio: 4 / 3;
          border: 1px solid #222;
          border-radius: 10px;
          overflow: hidden;
          background: #0a0a0a;
          transition: border-color 0.2s, transform 0.2s;
          display: block;
        }
        .scan-door:hover {
          border-color: #ff0033;
          transform: translateY(-2px);
        }
        .scan-door:disabled {
          opacity: 0.6;
          cursor: wait;
          transform: none;
        }
        .scan-door-image {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.55;
        }
        .scan-door-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.25) 0%, transparent 35%, rgba(0, 0, 0, 0.92) 100%);
        }
        .scan-door-content {
          position: relative;
          z-index: 1;
          height: 100%;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .scan-door-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Fira Code', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          margin-bottom: 10px;
        }
        .scan-door-location {
          color: #bbb;
        }
        .scan-door-price {
          color: #666;
          text-decoration: line-through;
        }
        .scan-door-name {
          font-family: 'Fira Sans', sans-serif;
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 6px;
          line-height: 1.15;
          color: #fff;
        }
        .scan-door-tagline {
          font-family: 'Fira Sans', sans-serif;
          font-size: 13px;
          color: #aaa;
          margin: 0 0 12px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .scan-door-cta {
          font-family: 'Fira Code', monospace;
          font-size: 12px;
          color: #ff0033;
          letter-spacing: 0.1em;
          font-weight: 700;
        }
        .scan-loading {
          color: #555;
          text-align: center;
          padding: 40px;
          font-family: 'Fira Code', monospace;
          font-size: 12px;
          letter-spacing: 0.18em;
        }
        .scan-error {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(255, 0, 51, 0.1);
          border: 1px solid rgba(255, 0, 51, 0.3);
          border-radius: 6px;
          color: #ff8a9c;
          font-family: 'Fira Sans', sans-serif;
          font-size: 13px;
          text-align: center;
        }
        @keyframes scanBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes scanFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scan-cursor { animation: none !important; }
          .scan-badge-dot { animation: none !important; }
          .scan-glitch::before,
          .scan-glitch::after { animation: none !important; display: none; }
        }
        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
