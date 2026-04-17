'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, MapPin, Smartphone, Compass, X } from 'lucide-react';

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

function ExperienceCard({ exp, onBuy }: { exp: Experience; onBuy: (id: string) => void }) {
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
            <img className="card-image" src={exp.web_image} alt={exp.name} loading="lazy" />
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
                  onClick={(e) => { e.stopPropagation(); onBuy(exp.id); }}
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
                onClick={(e) => { e.stopPropagation(); onBuy(exp.id); }}
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

// ─── Language Picker Modal ──────────────────────────────────────────────────

function LangPicker({ experienceId, onClose }: { experienceId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const startCheckout = async (lang: 'en' | 'es') => {
    setLoading(true);
    setError('');
    try {
      const body: any = { experience_id: experienceId, lang };
      if (promoCode.trim()) body.coupon_code = promoCode.trim().toUpperCase();

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Error creating checkout session');
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please try again.');
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
        maxWidth: 380,
        background: '#0A0A0A',
        border: '1px solid rgba(255,0,51,0.3)',
        borderRadius: 16,
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            color: '#4B5563',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={20} />
        </button>

        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#ff0033',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}>SELECT_LANGUAGE</p>

        <p style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 14,
          color: '#94A3B8',
          marginBottom: 24,
        }}>Choose your preferred language</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => startCheckout('en')}
            disabled={loading}
            style={{
              padding: '16px 24px',
              background: loading ? '#661122' : '#ff0033',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontFamily: "'Fira Code', monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: loading ? 'wait' : 'pointer',
              minHeight: 52,
            }}
          >
            {loading ? 'LOADING...' : 'ENGLISH'}
          </button>
          <button
            onClick={() => startCheckout('es')}
            disabled={loading}
            style={{
              padding: '16px 24px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
              color: '#fff',
              fontFamily: "'Fira Code', monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: loading ? 'wait' : 'pointer',
              minHeight: 52,
            }}
          >
            ESPAÑOL
          </button>
        </div>

        <input
          type="text"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="PROMO_CODE"
          style={{
            width: '100%',
            padding: '12px',
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
          }}
        />

        {error && (
          <p style={{
            marginTop: 12,
            fontFamily: "'Fira Code', monospace",
            fontSize: 12,
            color: '#ff0033',
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
  const [pickerExpId, setPickerExpId] = useState<string | null>(null);

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
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div style={{
      background: '#050505',
      color: '#fff',
      minHeight: '100dvh',
    }}>
      {/* ─── Hero with video background ───────────────────────────── */}
      <section style={{
        minHeight: '100dvh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            opacity: 0.4,
          }}
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(5,5,5,0.6) 0%, rgba(5,5,5,0.85) 60%, #050505 100%)',
          zIndex: 1,
        }} />

        {/* Scanline */}
        <div className="start-scanline" />

        {/* Hero content */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '32px 24px 32px',
          minHeight: '100dvh',
        }}>
          {/* Top: logo + tag */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <img src="/logo.png" alt="StoryHunt" style={{ height: 24, opacity: 0.8 }} />
            <div style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 10,
              color: '#ff0033',
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ff0033',
                animation: 'startBlink 1.5s ease-in-out infinite',
              }} />
              LIVE_IN_NYC
            </div>
          </div>

          {/* Middle: main title */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#00d2ff',
              letterSpacing: '0.15em',
              marginBottom: 20,
              opacity: 0.7,
            }}>
              // SIGNAL_ACQUIRED
            </p>

            <h1 className="start-glitch" style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 'clamp(24px, 7vw, 42px)',
              fontWeight: 700,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              lineHeight: 1.15,
              marginBottom: 28,
            }}>
              A mystery walk<br />through<br /><span style={{ color: '#ff0033' }}>New York City</span>
            </h1>

            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 'clamp(14px, 4vw, 17px)',
              color: '#fff',
              letterSpacing: '0.04em',
              lineHeight: 1.7,
              marginBottom: 8,
              fontWeight: 500,
            }}>
              Your phone sends clues.<br />You decode the city.
            </p>

            <p style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 13,
              color: '#64748B',
            }}>
              No guide. No group. Just you and the streets.
            </p>
          </div>

          {/* Bottom: how it works (compact) + CTA */}
          <div>
            {/* Compact how-it-works */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 24,
              maxWidth: 400,
              margin: '0 auto 24px',
            }}>
              {[
                { icon: Smartphone, label: '01', text: 'Open your phone' },
                { icon: MapPin, label: '02', text: 'Walk to the start' },
                { icon: Compass, label: '03', text: 'Decode the city' },
              ].map(({ icon: Icon, label, text }, i) => (
                <div
                  key={i}
                  style={{
                    padding: '12px 8px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    textAlign: 'center',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div style={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: 9,
                    color: '#ff0033',
                    letterSpacing: '0.1em',
                    marginBottom: 4,
                  }}>{label}</div>
                  <Icon size={18} color="#00d2ff" style={{ marginBottom: 4 }} />
                  <div style={{
                    fontFamily: "'Fira Sans', sans-serif",
                    fontSize: 11,
                    color: '#fff',
                    lineHeight: 1.3,
                  }}>{text}</div>
                </div>
              ))}
            </div>

            {/* CTA */}
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
              CHOOSE_YOUR_HUNT
              <ChevronRight size={20} />
            </a>

            {/* Price */}
            <p style={{
              textAlign: 'center',
              marginTop: 14,
              fontFamily: "'Fira Code', monospace",
            }}>
              <span style={{ color: '#4B5563', textDecoration: 'line-through', fontSize: 14, marginRight: 8 }}>$14.99</span>
              <span style={{ color: '#ff0033', fontSize: 18, fontWeight: 700 }}>$9.99</span>
              <span style={{ color: '#64748B', fontSize: 12, marginLeft: 8 }}>per group</span>
            </p>
          </div>
        </div>
      </section>

      {/* ─── Not a tour ───────────────────────────────────────────── */}
      <section style={{
        padding: '60px 24px',
        maxWidth: 600,
        margin: '0 auto',
      }}>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          color: '#ff0033',
          letterSpacing: '0.1em',
          textAlign: 'center',
          marginBottom: 32,
        }}>NOT_A_TOUR</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}>
          {[
            { label: 'Duration', value: '2-3 hours' },
            { label: 'Group size', value: 'You + your group' },
            { label: 'Guide', value: 'Your phone' },
            { label: 'Schedule', value: 'Anytime' },
          ].map(({ label, value }, i) => (
            <div key={i} style={{
              padding: 14,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10,
            }}>
              <div style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: 10,
                color: '#4B5563',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>{label}</div>
              <div style={{
                fontFamily: "'Fira Sans', sans-serif",
                fontSize: 14,
                color: '#fff',
                fontWeight: 500,
              }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{
          padding: '16px',
          background: 'rgba(255,0,51,0.05)',
          border: '1px solid rgba(255,0,51,0.15)',
          borderRadius: 10,
          textAlign: 'center',
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 14,
          color: '#94A3B8',
          lineHeight: 1.6,
        }}>
          One purchase covers <span style={{ color: '#fff', fontWeight: 600 }}>your entire group</span>.
          <br />No per-person pricing.
        </div>
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
        }}>AVAILABLE_HUNTS</p>

        {!loaded ? (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: 40 }}>Loading...</div>
        ) : experiences.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: 40 }}>No hunts available</div>
        ) : (
          <div className="experience-grid">
            {experiences.map(exp => (
              <ExperienceCard key={exp.id} exp={exp} onBuy={setPickerExpId} />
            ))}
          </div>
        )}
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
          START_YOUR_HUNT
          <ChevronRight size={18} />
        </a>

        <div style={{ marginTop: 40 }}>
          <img src="/logo.png" alt="StoryHunt" style={{ height: 20, opacity: 0.4 }} />
        </div>
      </section>

      {pickerExpId && (
        <LangPicker
          experienceId={pickerExpId}
          onClose={() => setPickerExpId(null)}
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
        }

        .experience-card.flipped .card-inner {
          transform: rotateY(180deg);
        }

        .card-front, .card-back {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
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
          transform: rotateY(180deg);
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

        @keyframes startBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
