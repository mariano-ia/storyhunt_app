'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ChevronRight, Radio, Eye } from 'lucide-react';

// ─── NYC Secrets Data ────────────────────────────────────────────────────────

const SECRETS = [
  {
    id: 1,
    label: 'SECRET_001',
    location: '// BROOKLYN BRIDGE',
    title: 'A wine cellar hidden inside a bridge',
    body: 'Deep inside the stone arches of the Brooklyn Bridge, workers in 1876 discovered the perfect conditions for storing wine — cool, dark, and constant temperature. For decades, a secret cellar operated beneath the roadway, filled with bottles of champagne and Bordeaux. The city sold access to fund bridge maintenance. It was sealed after 9/11. The entrance is still there. Most people walk right over it.',
  },
  {
    id: 2,
    label: 'SECRET_002',
    location: '// GRAND CENTRAL TERMINAL',
    title: 'A whisper that travels 30 feet',
    body: 'Stand in the archway near the Oyster Bar in Grand Central Terminal. Face the corner. Whisper something. Someone standing in the opposite corner — 30 feet away — will hear you perfectly, as if you were right next to them. The parabolic arches carry the sound waves across the ceiling. Spies used it. Lovers used it. Most commuters rush past it every day without knowing.',
  },
  {
    id: 3,
    label: 'SECRET_003',
    location: '// CITY HALL',
    title: 'A subway station no train will ever stop at',
    body: 'Beneath City Hall, there is a subway station so beautiful it was never meant for daily use. Brass chandeliers. Herringbone tile. Stained glass skylights. It opened in 1904 as the crown jewel of the NYC subway system. Closed in 1945 because the curved platform couldn\'t fit modern trains. You can still see it — stay on the 6 train past the last stop and look out the window as it loops around.',
  },
  {
    id: 4,
    label: 'SECRET_004',
    location: '// GREENWICH VILLAGE',
    title: 'A door that leads to 1830',
    body: 'At 75½ Bedford Street sits the narrowest house in New York City — 9.5 feet wide. It was built in 1873 in what was once a carriage alley. Edna St. Vincent Millay lived there. Cary Grant lived there. The house has been continuously occupied for 150 years. There is no buzzer. No mailbox visible from the street. Just a red door, barely wider than your shoulders, hiding an entire life inside.',
  },
  {
    id: 5,
    label: 'SECRET_005',
    location: '// CENTRAL PARK',
    title: 'A fortress no one was meant to find',
    body: 'Deep inside Central Park, hidden behind a cascade of rocks and overgrown trees, there is a stone structure called The Blockhouse. Built in 1814 to defend Manhattan from the British, it is the oldest surviving military fortification in the park. No signs point to it. No paths lead directly there. It sits at the northern edge, forgotten by tourists, visited only by those who know where to look. You can touch walls that soldiers once defended.',
  },
];

// ─── Typing Effect Hook ──────────────────────────────────────────────────────

function useTypingEffect(text: string, active: boolean, speed = 18) {
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

// ─── Landing Phase ───────────────────────────────────────────────────────────

function LandingPhase({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'secrets-lead-magnet' }),
      });

      if (!res.ok) throw new Error('Failed');
      onSubmit(email);
    } catch {
      setError('SIGNAL_LOST — try again');
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Scanline overlay */}
      <div className="secrets-scanline" />

      {/* Signal icon */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: '2px solid #ff0033',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        animation: 'secretsPulse 2s ease-in-out infinite',
      }}>
        <Radio size={28} color="#ff0033" />
      </div>

      {/* Title */}
      <h1 className="secrets-glitch" style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 'clamp(20px, 5vw, 28px)',
        fontWeight: 700,
        color: '#ff0033',
        textAlign: 'center',
        marginBottom: 16,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        Transmission_Intercepted
      </h1>

      {/* Subtitle */}
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(15px, 4vw, 18px)',
        color: '#94A3B8',
        textAlign: 'center',
        maxWidth: 380,
        lineHeight: 1.6,
        marginBottom: 8,
      }}>
        5 secrets are hidden in plain sight across New York City.
      </p>
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(15px, 4vw, 18px)',
        color: '#fff',
        textAlign: 'center',
        maxWidth: 380,
        lineHeight: 1.6,
        marginBottom: 40,
      }}>
        Most people walk right past them.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        maxWidth: 380,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}>
          <span style={{
            position: 'absolute',
            left: 14,
            color: '#00d2ff',
            fontFamily: "'Fira Code', monospace",
            fontSize: 14,
            pointerEvents: 'none',
          }}>{'>'}</span>
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="enter your callsign to decode"
            required
            autoComplete="email"
            style={{
              width: '100%',
              padding: '16px 16px 16px 32px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(0,210,255,0.2)',
              borderRadius: 8,
              color: '#fff',
              fontFamily: "'Fira Code', monospace",
              fontSize: 16,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(0,210,255,0.6)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(0,210,255,0.2)'}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '16px 24px',
            background: submitting ? '#661122' : '#ff0033',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontFamily: "'Fira Code', monospace",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: submitting ? 'wait' : 'pointer',
            transition: 'background 0.2s, transform 0.1s',
            minHeight: 52,
          }}
        >
          {submitting ? 'DECODING...' : 'DECODE_SIGNAL'}
        </button>

        {error && (
          <p style={{
            color: '#ff0033',
            fontFamily: "'Fira Code', monospace",
            fontSize: 13,
            textAlign: 'center',
          }}>{error}</p>
        )}
      </form>

      {/* Trust line */}
      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 11,
        color: '#4B5563',
        textAlign: 'center',
        marginTop: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <Lock size={12} />
        encrypted channel — no spam, ever
      </p>
    </div>
  );
}

// ─── Secret Card ─────────────────────────────────────────────────────────────

function SecretCard({
  secret,
  active,
  revealed,
  onRevealed,
}: {
  secret: typeof SECRETS[0];
  active: boolean;
  revealed: boolean;
  onRevealed: () => void;
}) {
  const { displayed: bodyText, done } = useTypingEffect(secret.body, active, 14);

  useEffect(() => {
    if (done && !revealed) onRevealed();
  }, [done, revealed, onRevealed]);

  if (!active && !revealed) return null;

  return (
    <div style={{
      padding: '24px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      animation: !revealed ? 'secretsFadeIn 0.4s ease-out' : undefined,
    }}>
      {/* Label + location */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          color: '#00d2ff',
          letterSpacing: '0.1em',
        }}>{secret.label}</span>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#4B5563',
        }}>{secret.location}</span>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 18,
        fontWeight: 600,
        color: '#fff',
        marginBottom: 12,
        lineHeight: 1.3,
      }}>{secret.title}</h3>

      {/* Body — typing or full */}
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 15,
        color: '#CBD5E1',
        lineHeight: 1.7,
        minHeight: revealed ? undefined : 80,
      }}>
        {revealed ? secret.body : bodyText}
        {!revealed && !done && <span className="secrets-cursor">|</span>}
      </p>
    </div>
  );
}

// ─── Experience Phase ────────────────────────────────────────────────────────

function ExperiencePhase({ onComplete }: { onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleRevealed = useCallback(() => {
    setRevealedCount((c) => c + 1);
  }, []);

  const handleNext = () => {
    const next = currentIndex + 1;
    if (next >= SECRETS.length) {
      onComplete();
    } else {
      setCurrentIndex(next);
      // Scroll to bottom after short delay
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  };

  const showNextButton = revealedCount > currentIndex;
  const isLast = currentIndex === SECRETS.length - 1;

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header bar */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 13,
          color: '#ff0033',
          letterSpacing: '0.08em',
        }}>DECODING_NYC</span>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
          color: '#4B5563',
        }}>{currentIndex + 1}/{SECRETS.length}</span>
      </div>

      {/* Secrets container */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 20px 120px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {SECRETS.map((secret, i) => (
          <SecretCard
            key={secret.id}
            secret={secret}
            active={i === currentIndex}
            revealed={i < currentIndex}
            onRevealed={handleRevealed}
          />
        ))}
      </div>

      {/* Next button — fixed at bottom */}
      {showNextButton && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px',
          background: 'linear-gradient(transparent, #050505 40%)',
          display: 'flex',
          justifyContent: 'center',
          animation: 'secretsFadeIn 0.4s ease-out',
        }}>
          <button
            onClick={handleNext}
            style={{
              padding: '16px 32px',
              background: isLast ? '#ff0033' : 'rgba(0,210,255,0.12)',
              border: `1px solid ${isLast ? '#ff0033' : 'rgba(0,210,255,0.3)'}`,
              borderRadius: 8,
              color: '#fff',
              fontFamily: "'Fira Code', monospace",
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              letterSpacing: '0.05em',
              minHeight: 52,
              transition: 'background 0.2s',
            }}
          >
            {isLast ? 'TRANSMISSION_COMPLETE' : 'NEXT_SECRET'}
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── CTA Phase ───────────────────────────────────────────────────────────────

function CTAPhase() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      textAlign: 'center',
      animation: 'secretsFadeIn 0.6s ease-out',
    }}>
      {/* Completed icon */}
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: '2px solid #00d2ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
      }}>
        <Eye size={32} color="#00d2ff" />
      </div>

      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 12,
        color: '#00d2ff',
        letterSpacing: '0.1em',
        marginBottom: 24,
      }}>5/5 SECRETS_DECODED</p>

      <h2 style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(24px, 6vw, 36px)',
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1.2,
        marginBottom: 16,
        maxWidth: 400,
      }}>
        This was just a taste.
      </h2>

      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(16px, 4vw, 20px)',
        color: '#94A3B8',
        lineHeight: 1.5,
        maxWidth: 360,
        marginBottom: 32,
      }}>
        The real hunt sends you into the streets. Your phone guides you. No tour guide. No bus. Just you, the city, and the mystery.
      </p>

      {/* Coupon */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(255,0,51,0.08)',
        border: '1px solid rgba(255,0,51,0.25)',
        borderRadius: 10,
        marginBottom: 28,
        maxWidth: 360,
        width: '100%',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#ff0033',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}>REWARD_UNLOCKED</p>
        <p style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 16,
          color: '#fff',
          marginBottom: 8,
        }}>
          25% off your first hunt
        </p>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 20,
          fontWeight: 700,
          color: '#ff0033',
          letterSpacing: '0.15em',
        }}>DECODED25</p>
      </div>

      {/* Main CTA */}
      <a
        href="https://storyhunt.city"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '18px 36px',
          background: '#ff0033',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          fontFamily: "'Fira Code', monospace",
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          cursor: 'pointer',
          minHeight: 56,
          transition: 'transform 0.1s',
        }}
      >
        START_YOUR_HUNT
        <ChevronRight size={20} />
      </a>

      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 12,
        color: '#4B5563',
        marginTop: 16,
      }}>storyhunt.city</p>

      {/* Product details */}
      <div style={{
        marginTop: 40,
        padding: '20px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)',
        maxWidth: 360,
        width: '100%',
      }}>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#00d2ff',
          letterSpacing: '0.08em',
          marginBottom: 12,
        }}>WHAT_IS_STORYHUNT</p>
        <p style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 14,
          color: '#94A3B8',
          lineHeight: 1.6,
        }}>
          A chat-based mystery walk through NYC neighborhoods. Your phone sends clues. You decode the city. 2-3 hours. No guide, no group — just you and the streets.
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Phase = 'landing' | 'experience' | 'complete';

export default function SecretsPage() {
  const [phase, setPhase] = useState<Phase>('landing');

  return (
    <div style={{
      background: '#050505',
      color: '#fff',
      minHeight: '100dvh',
      position: 'relative',
    }}>
      {phase === 'landing' && (
        <LandingPhase onSubmit={() => setPhase('experience')} />
      )}
      {phase === 'experience' && (
        <ExperiencePhase onComplete={() => setPhase('complete')} />
      )}
      {phase === 'complete' && (
        <CTAPhase />
      )}

      {/* Global styles for this page */}
      <style>{`
        .secrets-scanline {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 1;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.03) 2px,
            rgba(0, 0, 0, 0.03) 4px
          );
        }

        .secrets-glitch {
          animation: secretsGlitch 3s infinite;
        }

        .secrets-cursor {
          color: #00d2ff;
          animation: secretsBlink 0.8s step-end infinite;
        }

        @keyframes secretsGlitch {
          0%, 92%, 100% { transform: translate(0); opacity: 1; }
          93% { transform: translate(-2px, 1px); opacity: 0.8; }
          94% { transform: translate(2px, -1px); opacity: 0.9; }
          95% { transform: translate(-1px, 0); opacity: 1; }
        }

        @keyframes secretsPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 0, 51, 0.3); }
          50% { box-shadow: 0 0 0 12px rgba(255, 0, 51, 0); }
        }

        @keyframes secretsBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @keyframes secretsFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Hide scrollbar but keep scrolling */
        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
