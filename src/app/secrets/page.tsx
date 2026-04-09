'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ChevronRight, Radio, Eye, X, Copy, Check } from 'lucide-react';

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

const MODAL_TRIGGER_INDEX = 1; // Show modal after secret 2 (0-indexed)

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

// ─── Email Modal ─────────────────────────────────────────────────────────────

function EmailModal({
  onSubmit,
  onSkip,
}: {
  onSubmit: (email: string) => void;
  onSkip: () => void;
}) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

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
      setRevealed(true);
    } catch {
      setError('SIGNAL_LOST — try again');
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText('DECODED25');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    onSubmit(email);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      animation: 'secretsFadeIn 0.3s ease-out',
    }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={revealed ? handleContinue : onSkip}
      />

      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 380,
        background: '#0A0A0A',
        border: `1px solid ${revealed ? 'rgba(16,185,129,0.3)' : 'rgba(255,0,51,0.3)'}`,
        borderRadius: 16,
        padding: '32px 24px',
        textAlign: 'center',
      }}>
        {!revealed && (
          <button
            onClick={onSkip}
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
        )}

        {revealed ? (
          <>
            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#10B981',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}>DISCOUNT_REVEALED</p>

            <h3 style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 12,
              lineHeight: 1.3,
            }}>
              25% off your first hunt
            </h3>

            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 24px',
                background: 'rgba(255,0,51,0.15)',
                border: '1px solid rgba(255,0,51,0.3)',
                borderRadius: 8,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              <span style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: 22,
                fontWeight: 700,
                color: '#ff0033',
                letterSpacing: '0.15em',
              }}>DECODED25</span>
              {copied ? <Check size={18} color="#10B981" /> : <Copy size={18} color="#ff0033" />}
            </button>
            {copied && (
              <p style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: 11,
                color: '#10B981',
                marginBottom: 8,
              }}>copied!</p>
            )}

            <button
              onClick={handleContinue}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '14px 24px',
                background: '#ff0033',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontFamily: "'Fira Code', monospace",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                minHeight: 48,
                marginTop: 16,
              }}
            >
              SEE_SECRET_3
              <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <>
            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#00d2ff',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}>2/5 DECODED</p>

            <h3 style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 8,
              lineHeight: 1.3,
            }}>
              Want the last 3 secrets?
            </h3>

            <p style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 15,
              color: '#94A3B8',
              lineHeight: 1.5,
              marginBottom: 8,
            }}>
              Drop your email and unlock <span style={{ color: '#fff', fontWeight: 600 }}>25% off</span> your first mystery walk.
            </p>

            <div style={{
              display: 'inline-block',
              padding: '6px 16px',
              background: 'rgba(255,0,51,0.1)',
              border: '1px solid rgba(255,0,51,0.2)',
              borderRadius: 6,
              marginBottom: 20,
            }}>
              <span style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: 14,
                fontWeight: 700,
                color: '#ff0033',
                letterSpacing: '0.1em',
                filter: 'blur(6px)',
                userSelect: 'none',
              }}>DECODED25</span>
            </div>

            <form onSubmit={handleSubmit} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{
                  position: 'absolute',
                  left: 14,
                  color: '#00d2ff',
                  fontFamily: "'Fira Code', monospace",
                  fontSize: 14,
                  pointerEvents: 'none',
                }}>{'>'}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your email"
                  required
                  autoComplete="email"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '14px 14px 14px 32px',
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
                  padding: '14px 24px',
                  background: submitting ? '#661122' : '#ff0033',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontFamily: "'Fira Code', monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: submitting ? 'wait' : 'pointer',
                  minHeight: 48,
                }}
              >
                {submitting ? 'DECODING...' : 'UNLOCK_DISCOUNT'}
              </button>

              {error && (
                <p style={{ color: '#ff0033', fontFamily: "'Fira Code', monospace", fontSize: 12, textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </form>

            <button
              onClick={onSkip}
              style={{
                background: 'none',
                border: 'none',
                color: '#4B5563',
                fontFamily: "'Fira Code', monospace",
                fontSize: 12,
                cursor: 'pointer',
                marginTop: 16,
                padding: '8px 16px',
              }}
            >
              skip — just show me the secrets
            </button>

            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 10,
              color: '#374151',
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}>
              <Lock size={10} />
              no spam, ever
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Splash Phase ────────────────────────────────────────────────────────────

function SplashPhase({ onReady }: { onReady: () => void }) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowButton(true), 1500);
    return () => clearTimeout(t);
  }, []);

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
      <div className="secrets-scanline" />

      {/* Logo */}
      <img src="/logo.png" alt="StoryHunt" style={{ height: 28, opacity: 0.7, marginBottom: 40 }} />

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

      {showButton && (
        <button
          onClick={onReady}
          style={{
            padding: '16px 36px',
            background: '#ff0033',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontFamily: "'Fira Code', monospace",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            animation: 'secretsFadeIn 0.5s ease-out',
          }}
        >
          DECODE_SIGNAL
          <ChevronRight size={18} />
        </button>
      )}
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

      <h3 style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 18,
        fontWeight: 600,
        color: '#fff',
        marginBottom: 12,
        lineHeight: 1.3,
      }}>{secret.title}</h3>

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

function ExperiencePhase({
  onComplete,
  onModalTrigger,
}: {
  onComplete: () => void;
  onModalTrigger: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [modalTriggered, setModalTriggered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleRevealed = useCallback(() => {
    setRevealedCount((c) => c + 1);
  }, []);

  const handleNext = () => {
    const next = currentIndex + 1;

    // Trigger modal after the 3rd secret
    if (next === MODAL_TRIGGER_INDEX + 1 && !modalTriggered) {
      setModalTriggered(true);
      onModalTrigger();
    }

    if (next >= SECRETS.length) {
      onComplete();
    } else {
      setCurrentIndex(next);
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

      {/* Next button */}
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

function CTAPhase({ hasEmail }: { hasEmail: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText('DECODED25');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      {/* Coupon — only if they gave email */}
      {hasEmail && (
        <div style={{
          padding: '16px 24px',
          background: 'rgba(255,0,51,0.08)',
          border: '1px solid rgba(255,0,51,0.25)',
          borderRadius: 10,
          marginBottom: 28,
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
          animation: 'secretsFadeIn 0.4s ease-out',
        }}>
          <p style={{
            fontFamily: "'Fira Sans', sans-serif",
            fontSize: 13,
            color: '#94A3B8',
            marginBottom: 10,
          }}>
            In case you didn&apos;t copy it — here&apos;s your code:
          </p>
          <button
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              background: 'rgba(255,0,51,0.15)',
              border: '1px solid rgba(255,0,51,0.3)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 20,
              fontWeight: 700,
              color: '#ff0033',
              letterSpacing: '0.15em',
            }}>DECODED25</span>
            {copied ? <Check size={16} color="#10B981" /> : <Copy size={16} color="#ff0033" />}
          </button>
          {copied && (
            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#10B981',
              marginTop: 8,
            }}>copied!</p>
          )}
        </div>
      )}

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
        }}
      >
        START_YOUR_HUNT
        <ChevronRight size={20} />
      </a>

      <img src="/logo.png" alt="StoryHunt" style={{ height: 24, opacity: 0.5, marginTop: 20 }} />

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

type Phase = 'splash' | 'experience' | 'complete';

export default function SecretsPage() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [showModal, setShowModal] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);

  const handleModalTrigger = useCallback(() => {
    if (!hasEmail) {
      setShowModal(true);
    }
  }, [hasEmail]);

  const handleEmailSubmit = useCallback(() => {
    setHasEmail(true);
    setShowModal(false);
  }, []);

  const handleModalSkip = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <div style={{
      background: '#050505',
      color: '#fff',
      minHeight: '100dvh',
      position: 'relative',
    }}>
      {phase === 'splash' && (
        <SplashPhase onReady={() => setPhase('experience')} />
      )}
      {phase === 'experience' && (
        <ExperiencePhase
          onComplete={() => setPhase('complete')}
          onModalTrigger={handleModalTrigger}
        />
      )}
      {phase === 'complete' && (
        <CTAPhase hasEmail={hasEmail} />
      )}

      {showModal && (
        <EmailModal
          onSubmit={handleEmailSubmit}
          onSkip={handleModalSkip}
        />
      )}

      <style>{`
        .secrets-scanline {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          z-index: 1;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,0,51,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(255,0,51,0); }
        }

        @keyframes secretsBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @keyframes secretsFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
