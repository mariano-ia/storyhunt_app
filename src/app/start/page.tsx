'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, X, Star } from 'lucide-react';
import { trackViewContent, trackInitiateCheckout, trackAddPaymentInfo, trackLead } from '@/lib/analytics';
import { syncExperimentsToPostHog } from '@/lib/experiments';

// ─── Experience Card ────────────────────────────────────────────────────────

type Experience = {
  id: string;
  name: string;
  name_en?: string;
  description_en?: string;
  description?: string;
  web_tagline?: string;
  web_description?: string;
  web_image?: string;
  location?: string;
  duration?: string;
  distance?: string;
  difficulty?: string;
  starting_point?: string;
  slug: string;
  price: number;
  status: string;
};

function difficultyBar(d?: string) {
  if (d === 'easy') return '██░░░';
  if (d === 'medium') return '███░░';
  if (d === 'hard') return '█████';
  return '░░░░░';
}

function ExperienceCard({ exp, onBuy }: { exp: Experience; onBuy: (exp: Experience) => void }) {
  const [flipped, setFlipped] = useState(false);
  const isLive = exp.status === 'published';
  const originalPrice = exp.price > 0 ? Math.ceil(exp.price * 1.5) - 0.01 : 0;
  const ctaLabel = exp.price > 0 ? 'BUY_ACCESS' : 'GET_FREE_ACCESS';

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    setFlipped(!flipped);
  };

  return (
    <div
      className={`experience-card ${isLive ? 'active' : 'coming-soon'} ${flipped ? 'flipped' : ''}`}
      onClick={handleCardClick}
    >
      <div className="card-inner">
        {/* FRONT */}
        <div className="card-front">
          <div className={`card-status mono ${!isLive ? 'coming-soon-badge' : ''}`}>
            <span className={`status-dot ${!isLive ? 'status-dot--pending' : ''}`}></span> {isLive ? 'LIVE' : 'COMING_SOON'}
          </div>
          {exp.web_image ? (
            <img
              className="card-image"
              src={exp.web_image}
              alt={exp.name}
              loading="eager"
              decoding="async"
              style={{ background: '#111' }}
            />
          ) : (
            <div className="card-image" style={{ background: '#111' }}></div>
          )}
          <div className="card-content">
            {exp.location && (
              <span className="card-location-badge mono">{exp.location.toUpperCase()}</span>
            )}
            <h3>{(exp.name || '').toUpperCase()}</h3>
            <p className="card-tagline">{exp.web_tagline || ''}</p>
            {isLive && <span className="card-langs mono">EN | ES</span>}
            <div className="card-front-footer">
              <span className="card-price mono">
                {isLive ? (
                  exp.price > 0 ? (
                    <>
                      <span className="price-original">${originalPrice.toFixed(2)}</span> ${exp.price} USD
                    </>
                  ) : 'FREE'
                ) : 'COMING_SOON'}
              </span>
              {isLive ? (
                <button
                  className="primary-btn mono card-front-cta"
                  onClick={(e) => { e.stopPropagation(); onBuy(exp); }}
                >{ctaLabel}</button>
              ) : (
                <a href="#hunts" className="secondary-btn mono card-front-cta" onClick={(e) => e.stopPropagation()}>NOTIFY_ME</a>
              )}
            </div>
            <span className="card-flip-hint mono always-visible">TAP_FOR_DETAILS &gt;</span>
          </div>
        </div>

        {/* BACK */}
        <div className="card-back">
          {isLive ? (
            <>
              <h3>{(exp.name || '').toUpperCase()}</h3>
              <p className="card-description">{exp.web_description || ''}</p>
              {exp.starting_point && (
                <div className="starting-point-badge">
                  <div className="starting-point-label">START_POINT</div>
                  <div className="starting-point-value">{exp.starting_point}</div>
                </div>
              )}
              <div className="card-meta">
                {exp.duration && <div><span className="label">DURATION:</span> {exp.duration.toUpperCase()}</div>}
                {exp.distance && <div><span className="label">DISTANCE:</span> {exp.distance.toUpperCase()}</div>}
                {exp.difficulty && <div><span className="label">DIFFICULTY:</span> {difficultyBar(exp.difficulty)}</div>}
                <div><span className="label">PRICE:</span> {exp.price > 0 ? (
                  <><span className="price-original">${originalPrice.toFixed(2)}</span> ${exp.price}</>
                ) : 'FREE'}</div>
              </div>
              <button
                className="primary-btn mono card-buy-btn"
                onClick={(e) => { e.stopPropagation(); onBuy(exp); }}
              >
                <span className="btn-text">{ctaLabel}</span>
              </button>
            </>
          ) : (
            <>
              <h3>{(exp.name || '').toUpperCase()}</h3>
              <p className="card-description">{exp.web_description || ''}</p>
              <div className="card-meta">
                <div><span className="label">STATUS:</span> IN_DEVELOPMENT</div>
                {exp.location && <div><span className="label">LOCATION:</span> {exp.location.toUpperCase()}</div>}
              </div>
              <a href="#hunts" className="secondary-btn mono card-notify-btn" onClick={(e) => e.stopPropagation()}>NOTIFY_ME</a>
            </>
          )}
          <span className="card-flip-hint">&lt; FLIP_BACK</span>
        </div>
      </div>
    </div>
  );
}

// ─── FAQ Accordion ──────────────────────────────────────────────────────────

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: 'Do I need international data?',
    a: 'Yes — basic 4G/5G to receive clues as you walk. Most US carriers and prepaid SIMs work fine. Wifi-only doesn’t work mid-walk.',
  },
  {
    q: 'Can I do it with my partner or friends?',
    a: 'Yes — one purchase covers your whole group. You walk and decode together, sharing the same chat.',
  },
  {
    q: 'How long is the walk?',
    a: '2–3 hours total, ~2–3 km with frequent stops. You can pause and resume anytime within 30 days.',
  },
  {
    q: 'What’s the refund policy?',
    a: 'If something is genuinely broken on our end, full refund. Just email hello@storyhunt.city.',
  },
];

function FaqItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);

  // Typewriter: only runs when item opens. Skips animation if user has prefers-reduced-motion.
  useEffect(() => {
    if (!isOpen) {
      setTyped('');
      setDone(false);
      return;
    }
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setTyped(a);
      setDone(true);
      return;
    }
    let i = 0;
    const tick = setInterval(() => {
      i++;
      setTyped(a.slice(0, i));
      if (i >= a.length) {
        clearInterval(tick);
        setDone(true);
      }
    }, 18);
    return () => clearInterval(tick);
  }, [isOpen, a]);

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      width: '100%',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '16px 0',
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          textAlign: 'left',
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        <span>{q}</span>
        <ChevronDown
          size={18}
          style={{
            color: '#00d2ff',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </button>
      {isOpen && (
        <div style={{
          padding: '0 0 16px',
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 14,
          color: '#94A3B8',
          lineHeight: 1.6,
          minHeight: '3em',
        }}>
          {typed}
          {!done && <span className="faq-cursor">|</span>}
        </div>
      )}
    </div>
  );
}

// ─── Language Picker Modal ──────────────────────────────────────────────────

// Detect language from URL, localStorage, then navigator. URL > stored > browser.
function detectLang(): 'en' | 'es' {
  if (typeof window === 'undefined') return 'en';
  const params = new URLSearchParams(window.location.search);
  const urlLang = params.get('lang');
  if (urlLang === 'es' || urlLang === 'en') return urlLang;
  try {
    const stored = window.localStorage.getItem('storyhunt_lang');
    if (stored === 'es' || stored === 'en') return stored;
  } catch { /* localStorage unavailable */ }
  const browserLang = (navigator.language || '').toLowerCase();
  return browserLang.startsWith('es') ? 'es' : 'en';
}

function detectPromoFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return (params.get('promo') || '').trim().toUpperCase();
}

function LangPicker({ experience, onClose }: { experience: Experience; onClose: () => void }) {
  const experienceId = experience.id;
  const price = experience.price || 0;
  const startingPoint = experience.starting_point || 'your starting point';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState<'en' | 'es'>(() => detectLang());
  const [email, setEmail] = useState('');
  const [promoCode, setPromoCode] = useState(() => detectPromoFromUrl());
  const [showPromo, setShowPromo] = useState(() => detectPromoFromUrl() !== '');

  // Fire InitiateCheckout when modal opens (user has clear intent to buy)
  useEffect(() => {
    trackInitiateCheckout(experienceId, price, detectLang(), {
      content_name: experience.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = lang === 'es'
    ? {
        eyebrow: 'ESTÁS POR DESBLOQUEAR',
        intro: <>Una vez que pagues, podés <strong style={{ color: '#fff' }}>jugar ahora o guardar el link para tu viaje</strong>. Tu reloj de 30 días arranca cuando toques &ldquo;Start hunt&rdquo; en el punto de partida — no cuando pagás.</>,
        startPointLabel: 'PUNTO_DE_INICIO',
        cta: 'Continuar al pago',
        ctaHint: '→ Pago seguro vía Stripe',
        emailLabel: 'Email (opcional)',
        emailHint: 'Para enviarte el link de acceso',
        emailPlaceholder: 'tu@email.com',
        promoToggle: '¿Tenés un código promo?',
        promoPlaceholder: 'CODIGO',
        loading: 'PROCESANDO...',
        priceFooter: 'por grupo · paga 1 vez, jugás cuando quieras',
      }
    : {
        eyebrow: 'YOU\'RE ABOUT TO UNLOCK',
        intro: <>After payment, you can <strong style={{ color: '#fff' }}>play now or save the link for your trip</strong>. Your 30-day clock starts when you tap &ldquo;Start hunt&rdquo; at the meeting point — not when you pay.</>,
        startPointLabel: 'MEET_POINT',
        cta: 'Continue to checkout',
        ctaHint: '→ Secure payment via Stripe',
        emailLabel: 'Email (optional)',
        emailHint: 'To send you your access link',
        emailPlaceholder: 'you@email.com',
        promoToggle: 'Have a promo code?',
        promoPlaceholder: 'CODE',
        loading: 'PROCESSING...',
        priceFooter: 'per group · pay once, play whenever',
      };

  const startCheckout = async () => {
    setLoading(true);
    setError('');
    try { window.localStorage.setItem('storyhunt_lang', lang); } catch { /* ignore */ }

    // Fire Lead event if user provided an email (Meta Pixel + GA4)
    if (email.trim()) {
      trackLead({ email: email.trim(), lang, content_ids: [experienceId] });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const body: Record<string, string> = { experience_id: experienceId, lang };
      if (promoCode.trim()) body.coupon_code = promoCode.trim().toUpperCase();
      if (email.trim()) body.email = email.trim();

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.url) {
        // AddPaymentInfo: user is about to enter payment details on Stripe
        trackAddPaymentInfo(experienceId, price, {
          content_name: experience.name,
          coupon: promoCode.trim() || undefined,
        });
        window.location.href = data.url;
      } else {
        setError(data.error || 'Error creating checkout session');
        setLoading(false);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setError(err?.name === 'AbortError'
        ? 'Request timed out. Check your connection and try again.'
        : 'Connection error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 420,
        background: '#0A0A0A',
        border: '1px solid rgba(255,0,51,0.3)',
        borderRadius: 16,
        padding: '24px 24px 20px',
        maxHeight: '92vh',
        overflowY: 'auto',
      }}>
        {/* Top row: language pill + close */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 999,
            padding: 3,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {(['en', 'es'] as const).map(L => (
              <button
                key={L}
                onClick={() => setLang(L)}
                disabled={loading}
                style={{
                  padding: '5px 14px',
                  background: lang === L ? '#ff0033' : 'transparent',
                  border: 'none',
                  borderRadius: 999,
                  color: lang === L ? '#fff' : '#94A3B8',
                  fontFamily: "'Fira Code', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >{L.toUpperCase()}</button>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#4B5563',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Eyebrow + experience name */}
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 10,
          color: '#00d2ff',
          letterSpacing: '0.15em',
          margin: '0 0 6px',
        }}>{t.eyebrow}</p>
        <h2 style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 18,
          color: '#fff',
          margin: '0 0 14px',
          textTransform: 'uppercase',
          letterSpacing: '0.01em',
          lineHeight: 1.25,
        }}>{experience.name}</h2>

        {/* Intro paragraph */}
        <p style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 13,
          color: '#94A3B8',
          lineHeight: 1.6,
          margin: '0 0 14px',
        }}>{t.intro}</p>

        {/* Starting point card */}
        <div style={{
          padding: '10px 12px',
          background: 'rgba(255,0,51,0.06)',
          border: '1px solid rgba(255,0,51,0.2)',
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 9,
            color: '#ff0033',
            letterSpacing: '0.12em',
            marginBottom: 3,
          }}>{t.startPointLabel}</div>
          <div style={{
            fontFamily: "'Fira Sans', sans-serif",
            fontSize: 13,
            color: '#fff',
            fontWeight: 500,
          }}>{startingPoint}</div>
        </div>

        {/* Email field (optional) */}
        <label style={{
          display: 'block',
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#94A3B8',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}>{t.emailLabel} <span style={{ color: '#4B5563', fontWeight: 400 }}>— {t.emailHint}</span></label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(0,210,255,0.2)',
            borderRadius: 8,
            color: '#fff',
            fontFamily: "'Fira Sans', sans-serif",
            fontSize: 14,
            outline: 'none',
            marginBottom: 14,
            boxSizing: 'border-box',
          }}
        />

        {/* Primary CTA — neutral copy, language is set via the pill above */}
        <button
          onClick={startCheckout}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: loading ? '#661122' : '#ff0033',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontFamily: "'Fira Code', monospace",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: loading ? 'wait' : 'pointer',
            minHeight: 50,
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? t.loading : (
            <>
              {t.cta}
              <ChevronRight size={16} />
            </>
          )}
        </button>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 10,
          color: '#4B5563',
          textAlign: 'center',
          margin: '0 0 12px',
          letterSpacing: '0.05em',
        }}>{t.ctaHint}</p>

        {/* Promo code (collapsed) */}
        <div style={{ marginBottom: 14 }}>
          {!showPromo ? (
            <button
              onClick={() => setShowPromo(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontFamily: "'Fira Code', monospace",
                fontSize: 11,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                padding: 0,
              }}
            >▸ {t.promoToggle}</button>
          ) : (
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder={t.promoPlaceholder}
              disabled={loading}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#fff',
                fontFamily: "'Fira Code', monospace",
                fontSize: 13,
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* Price footer */}
        <div style={{
          paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#64748B',
          letterSpacing: '0.04em',
        }}>
          <span style={{ color: '#ff0033', fontSize: 16, fontWeight: 700, marginRight: 6 }}>${price.toFixed(2)}</span>
          {t.priceFooter}
        </div>

        {error && (
          <p style={{
            marginTop: 12,
            fontFamily: "'Fira Code', monospace",
            fontSize: 12,
            color: '#ff0033',
            textAlign: 'center',
          }}>{error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StartPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pickerExp, setPickerExp] = useState<Experience | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Sync any active experiments to PostHog (currently none — hero-copy-v1 retired
  // 2026-05-06 in favor of single Variant D copy).
  useEffect(() => {
    setTimeout(() => syncExperimentsToPostHog(), 1000);
  }, []);

  useEffect(() => {
    fetch('/api/public/experiences')
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data) ? data : data.experiences || [];
        // Show published first, then coming_soon
        const sorted = all.sort((a: Experience, b: Experience) => {
          if (a.status === 'published' && b.status !== 'published') return -1;
          if (a.status !== 'published' && b.status === 'published') return 1;
          return 0;
        });
        setExperiences(sorted);
        setLoaded(true);

        // Fire ViewContent with the published hunts visible above the fold
        const publishedIds = sorted
          .filter((e: Experience) => e.status === 'published')
          .map((e: Experience) => e.id);
        if (publishedIds.length > 0) {
          trackViewContent(publishedIds, { content_name: 'StoryHunt — Available Hunts' });
        }
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div style={{
      background: '#050505',
      color: '#fff',
      minHeight: '100dvh',
    }}>
      {/* ─── Hero with CSS-only background ────────────────────────── */}
      <section style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#050505',
      }}>
        {/* Background: radial accents (red top-left, cyan top-right) + bottom fade to black */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 60% at 15% 10%, rgba(255,0,51,0.18) 0%, transparent 60%),' +
            'radial-gradient(ellipse 70% 60% at 85% 15%, rgba(0,210,255,0.14) 0%, transparent 60%),' +
            'linear-gradient(180deg, rgba(5,5,5,0) 0%, rgba(5,5,5,0.85) 70%, #050505 100%)',
          zIndex: 1,
        }} />

        {/* Scanline */}
        <div className="start-scanline" />

        {/* Hero content — 4 blocks: logo / headline / steps / CTA */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 24px 40px',
          gap: 36,
        }}>
          {/* Block 1: Logo */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img src="/logo.png" alt="StoryHunt" style={{ height: 24, opacity: 0.85 }} />
          </div>

          {/* Block 2: Value proposition */}
          <h1 className="start-glitch" style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 'clamp(20px, 5.5vw, 30px)',
            fontWeight: 700,
            color: '#fff',
            textTransform: 'uppercase',
            letterSpacing: '0.01em',
            lineHeight: 1.2,
            margin: 0,
            textAlign: 'center',
          }}>
            The <span style={{ color: '#ff0033' }}>New York</span> walking tour<br />that chats back
          </h1>

          {/* Block: 3 steps */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
          }}>
            {[
              { label: '01', text: 'Walk real NYC blocks' },
              { label: '02', text: 'A character texts you clues' },
              { label: '03', text: 'Decode hidden stories' },
            ].map(({ label, text }, i) => (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  fontFamily: "'Fira Sans', sans-serif",
                  fontSize: 14,
                  color: '#E2E8F0',
                  lineHeight: 1.4,
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                }}
              >
                <div style={{
                  fontFamily: "'Fira Code', monospace",
                  fontSize: 12,
                  color: '#ff3355',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  marginBottom: 6,
                }}>{label}</div>
                {text}
              </div>
            ))}
          </div>

          {/* Block: CTA + price + buy-ahead badge */}
          <div>
            <a
              href="#hunts"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '18px 36px',
                background: '#ff0033',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontFamily: "'Fira Code', monospace",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                cursor: 'pointer',
                minHeight: 56,
                maxWidth: 400,
                margin: '0 auto',
                boxShadow: '0 0 40px rgba(255,0,51,0.3)',
              }}
            >
              CHOOSE_YOUR_EXPERIENCE
              <ChevronRight size={20} />
            </a>

            <p style={{
              textAlign: 'center',
              marginTop: 14,
              marginBottom: 12,
              fontFamily: "'Fira Code', monospace",
            }}>
              <span style={{ color: '#94A3B8', textDecoration: 'line-through', fontSize: 14, marginRight: 8 }}>$14.99</span>
              <span style={{ color: '#ff3355', fontSize: 18, fontWeight: 700 }}>$9.99</span>
              <span style={{ color: '#CBD5E1', fontSize: 13, marginLeft: 8 }}>flat — covers your whole group</span>
            </p>

            <p style={{
              textAlign: 'center',
              margin: 0,
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 13,
              color: '#E2E8F0',
              lineHeight: 1.5,
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
            }}>
              Full refund if anything’s broken · <span style={{ color: '#fff', fontWeight: 600 }}>30-day flexible window</span>
            </p>
          </div>
        </div>
      </section>

      {/* ─── Editor's Choice: award-style seal ────────────────────── */}
      <section style={{
        padding: '40px 24px 24px',
        maxWidth: 560,
        margin: '0 auto',
        textAlign: 'center',
      }}>
        <div className="editor-badge" style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '20px 40px 22px',
          background: 'linear-gradient(180deg, rgba(255,0,51,0.12), rgba(255,0,51,0.04))',
          border: '1.5px solid rgba(255,0,51,0.55)',
          borderRadius: 12,
          marginBottom: 18,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={16} fill="#FFB800" color="#FFB800" strokeWidth={1.5} />
            ))}
          </div>
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 15,
            color: '#fff',
            letterSpacing: '0.14em',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            Editor&apos;s Choice
          </span>
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 10,
            color: 'rgba(255,255,255,0.72)',
            letterSpacing: '0.2em',
          }}>
            2026 · STORYHUNT NYC
          </span>
        </div>

        <p style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 13,
          color: '#94A3B8',
          lineHeight: 1.55,
          margin: 0,
          maxWidth: 380,
          marginLeft: 'auto',
          marginRight: 'auto',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}>
          Hand-crafted in NYC by writers, photographers, and people who walk these streets.
        </p>
      </section>

      {/* ─── Available Hunts ──────────────────────────────────────── */}
      <section id="hunts" style={{
        padding: '40px 24px 80px',
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          color: '#00d2ff',
          letterSpacing: '0.1em',
          textAlign: 'center',
          marginBottom: 32,
        }}>AVAILABLE_EXPERIENCES</p>

        {!loaded ? (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: 40 }}>Loading...</div>
        ) : experiences.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: 40 }}>No hunts available</div>
        ) : (
          <div className="experience-grid">
            {experiences.map(exp => (
              <ExperienceCard key={exp.id} exp={exp} onBuy={setPickerExp} />
            ))}
          </div>
        )}
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────── */}
      <section style={{
        padding: '20px 24px 60px',
        maxWidth: 720,
        margin: '0 auto',
      }}>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          color: '#00d2ff',
          letterSpacing: '0.1em',
          textAlign: 'center',
          marginBottom: 24,
        }}>FREQUENTLY_ASKED</p>

        <div style={{ width: '100%' }}>
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem
              key={i}
              q={item.q}
              a={item.a}
              isOpen={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────── */}
      <section style={{
        padding: '60px 24px 80px',
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          color: '#ff0033',
          letterSpacing: '0.1em',
          marginBottom: 16,
        }}>READY?</p>

        <h2 style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 'clamp(18px, 5vw, 28px)',
          fontWeight: 700,
          color: '#fff',
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          The city is waiting.
        </h2>

        <a
          href="#hunts"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 32px',
            background: 'transparent',
            border: '1px solid #ff0033',
            borderRadius: 8,
            color: '#ff0033',
            fontFamily: "'Fira Code', monospace",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          START_YOUR_EXPERIENCE
          <ChevronRight size={18} />
        </a>

        <div style={{ marginTop: 40 }}>
          <img src="/logo.png" alt="StoryHunt" style={{ height: 20, opacity: 0.4 }} />
        </div>
      </section>

      {pickerExp && (
        <LangPicker
          experience={pickerExp}
          onClose={() => setPickerExp(null)}
        />
      )}

      <style>{`
        /* Experience cards — copied from StoryHuntWeb home */
        .mono { font-family: 'Space Mono', 'Fira Code', monospace; }

        .experience-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .experience-card {
          perspective: 1000px;
          -webkit-perspective: 1000px;
          aspect-ratio: 3 / 4.5;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .experience-grid { grid-template-columns: 1fr; }
          .experience-card { height: 420px; aspect-ratio: auto; }
        }

        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.8s cubic-bezier(0.19, 1, 0.22, 1);
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
        }

        .experience-card.flipped .card-inner {
          transform: rotateY(180deg);
          -webkit-transform: rotateY(180deg);
        }

        .card-front, .card-back {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          /* overflow: hidden removed — was breaking preserve-3d chain on iOS Safari.
             Content below uses clip-path / own overflow where needed. */
          border-radius: inherit;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }

        .card-front {
          display: flex;
          flex-direction: column;
          background: rgba(5, 5, 5, 0.8);
        }

        .card-image {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          filter: grayscale(0.4) brightness(0.5);
          transition: filter 0.5s cubic-bezier(0.19, 1, 0.22, 1);
        }

        .experience-card:hover .card-image {
          filter: grayscale(0.1) brightness(0.7);
        }

        .card-status {
          position: absolute;
          top: 1rem;
          left: 1rem;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.8rem;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          text-transform: uppercase;
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          color: #fff;
        }

        .card-status .status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
        }

        .experience-card.active .card-status .status-dot {
          background-color: #00ff66;
          box-shadow: 0 0 10px #00ff66;
        }

        .status-dot--pending {
          background-color: #888888 !important;
          box-shadow: none !important;
          animation: none !important;
        }

        .card-content {
          padding: 1.5rem;
          background: linear-gradient(transparent, rgba(5, 5, 5, 0.95));
          position: absolute;
          bottom: 0;
          width: 100%;
          z-index: 2;
        }

        .card-content h3 {
          font-size: 1.8rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1;
          margin-bottom: 0.3rem;
          color: #fff;
        }

        .card-tagline {
          font-size: 0.9rem;
          color: #888888;
          font-style: italic;
          margin-bottom: 0.8rem;
        }

        .card-back {
          transform: rotateY(180deg) translateZ(1px);
          -webkit-transform: rotateY(180deg) translateZ(1px);
          background: rgba(5, 5, 5, 0.95);
          border-color: rgba(255, 0, 51, 0.3);
          padding: 2rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow-y: auto;
        }

        .card-back h3 {
          font-size: 1.3rem;
          font-weight: 900;
          line-height: 1;
          margin-bottom: 1rem;
          color: #ff0033;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .card-description {
          font-size: 0.9rem;
          line-height: 1.7;
          color: #fff;
          opacity: 0.8;
          margin-bottom: 1.5rem;
        }

        .card-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.8rem;
          margin-bottom: 1.5rem;
          font-family: 'Space Mono', 'Fira Code', monospace;
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
          color: #fff;
        }

        @media (max-width: 768px) {
          .card-meta { grid-template-columns: 1fr; }
          .card-back { padding: 1.5rem; }
          .card-back h3 { font-size: 1.1rem; }
          .card-description { font-size: 0.8rem; margin-bottom: 1rem; }
        }

        .card-meta .label { color: #888888; }

        .starting-point-badge {
          background: rgba(255, 0, 51, 0.08);
          border: 1px solid rgba(255, 0, 51, 0.25);
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 1rem;
          font-family: 'Space Mono', 'Fira Code', monospace;
        }
        .starting-point-label {
          font-size: 0.6rem;
          color: #ff0033;
          letter-spacing: 0.15em;
          margin-bottom: 4px;
        }
        .starting-point-value {
          font-size: 0.85rem;
          color: #fff;
          font-weight: 600;
        }

        .card-buy-btn, .card-notify-btn {
          align-self: stretch;
          width: 100%;
          padding: 0.8rem 2rem;
          font-size: 0.75rem;
          cursor: pointer;
          text-align: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .card-location-badge {
          display: inline-block;
          padding: 0.25rem 0.6rem;
          background: #ff0033;
          color: #fff;
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 0.5rem;
        }

        .card-front-cta {
          display: inline-block;
          padding: 0.6rem 1.6rem;
          font-size: 0.7rem;
          margin-bottom: 0.4rem;
          z-index: 3;
          position: relative;
          cursor: pointer;
        }

        .card-price {
          font-size: 0.85rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: 0.03em;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .price-original {
          text-decoration: line-through;
          color: rgba(255, 255, 255, 0.35);
          font-weight: 400;
          font-size: 0.75rem;
        }

        .card-front-footer {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .card-langs {
          font-size: 0.55rem;
          letter-spacing: 1.5px;
          color: rgba(255, 255, 255, 0.35);
          margin-bottom: 0.25rem;
          display: block;
        }

        .card-flip-hint {
          font-family: 'Space Mono', 'Fira Code', monospace;
          text-transform: uppercase;
          font-size: 0.55rem;
          letter-spacing: 0.1em;
          color: #00d2ff;
          opacity: 0.6;
          transition: opacity 0.3s ease;
          display: block;
        }

        .card-flip-hint.always-visible { opacity: 0.7; }
        .experience-card:hover .card-flip-hint { opacity: 1; }

        .experience-card.coming-soon .card-image {
          filter: grayscale(0.8) brightness(0.3);
        }

        .experience-card.coming-soon:hover .card-image {
          filter: grayscale(0.6) brightness(0.4);
        }

        .experience-card.coming-soon .card-content h3 { opacity: 0.6; }
        .coming-soon-badge { color: #888888; }

        .primary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          background: #ff0033;
          color: #fff;
          padding: 1.2rem 3rem;
          font-size: 1rem;
          font-weight: 700;
          position: relative;
          overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          border: 1px solid #ff0033;
          cursor: pointer;
        }

        .primary-btn:hover { transform: translateY(-5px); }

        .secondary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          background: transparent;
          color: #fff;
          padding: 1.2rem 3rem;
          font-size: 1rem;
          font-weight: 700;
          border: 1px solid rgba(255, 255, 255, 0.3);
          cursor: pointer;
        }

        .start-scanline {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          z-index: 3;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px
          );
        }

        .start-glitch {
          animation: startGlitch 4s infinite;
        }

        @keyframes startGlitch {
          0%, 92%, 100% { transform: translate(0); opacity: 1; }
          93% { transform: translate(-2px, 1px); opacity: 0.85; }
          94% { transform: translate(2px, -1px); opacity: 0.95; }
          95% { transform: translate(-1px, 0); opacity: 1; }
        }

        .faq-cursor {
          color: #00d2ff;
          margin-left: 2px;
          animation: faqCursorBlink 0.8s step-end infinite;
        }
        @keyframes faqCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .editor-badge {
          animation: editorBadgePulse 3.6s ease-in-out infinite;
        }
        @keyframes editorBadgePulse {
          0%, 100% {
            box-shadow: 0 0 24px rgba(255, 0, 51, 0.16);
            border-color: rgba(255, 0, 51, 0.5);
          }
          50% {
            box-shadow: 0 0 56px rgba(255, 0, 51, 0.42);
            border-color: rgba(255, 0, 51, 0.85);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .editor-badge { animation: none; }
        }

        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
