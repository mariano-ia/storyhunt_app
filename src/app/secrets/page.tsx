'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ChevronRight, Radio, Eye, Copy, Check } from 'lucide-react';
import { trackLead } from '@/components/MetaPixel';

// ─── NYC Secrets Data ────────────────────────────────────────────────────────

const SECRETS = [
  {
    id: 1,
    label: 'SECRET_001',
    location: '// BROOKLYN BRIDGE',
    title: 'A wine cellar hidden inside a bridge',
    body: 'There is a wine cellar sealed inside the Brooklyn Bridge since 1876. The entrance is still there. Most people walk right over it.',
  },
  {
    id: 2,
    label: 'SECRET_002',
    location: '// CITY HALL',
    title: 'A subway station no train will ever stop at',
    body: 'Beneath City Hall, there is a subway station so beautiful it was closed to the public. Brass chandeliers. Stained glass skylights. You can still see it — stay on the 6 train past the last stop and look out the window as it loops around.',
  },
  {
    id: 3,
    label: 'SECRET_003',
    location: '// CENTRAL PARK',
    title: 'A fortress no one was meant to find',
    body: 'Hidden behind rocks and overgrown trees inside Central Park, there is a stone fortress built in 1814 to defend Manhattan from the British. No signs point to it. No paths lead directly there. Only those who know where to look ever find it.',
  },
];

const MODAL_TRIGGER_INDEX = 0; // Show modal after secret 1 (0-indexed)

// ─── Typing Effect Hook ──────────────────────────────────────────────────────

function useTypingEffect(text: string, active: boolean, speed = 12) {
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
}: {
  onSubmit: (email: string) => void;
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
      trackLead();
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
        onClick={revealed ? handleContinue : undefined}
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
        {revealed ? (
          <>
            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#10B981',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}>ACCESS_GRANTED</p>

            <h3 style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 12,
              lineHeight: 1.3,
            }}>
              2 more secrets unlocked.
            </h3>

            <p style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 14,
              color: '#94A3B8',
              lineHeight: 1.5,
              marginBottom: 16,
            }}>
              And here&apos;s something extra — 25% off if you want to hunt these locations in person.
            </p>

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
            {/* Product explanation header */}
            <img src="/logo.png" alt="StoryHunt" style={{ height: 22, opacity: 0.85, marginBottom: 12 }} />
            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#fff',
              letterSpacing: '0.04em',
              lineHeight: 1.6,
              marginBottom: 4,
              fontWeight: 600,
            }}>
              A mystery experience through New York City.
            </p>
            <p style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 12,
              color: '#64748B',
              marginBottom: 20,
            }}>
              Your phone sends clues. You decode the city.
            </p>

            <div style={{
              height: 1,
              background: 'rgba(255,255,255,0.1)',
              margin: '0 -8px 16px',
            }} />

            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#00d2ff',
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}>1/3 DECODED</p>

            <h3 style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 8,
              lineHeight: 1.3,
            }}>
              2 more secrets unlocked.
            </h3>

            <p style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 14,
              color: '#94A3B8',
              lineHeight: 1.5,
              marginBottom: 20,
            }}>
              Drop your email to see them + get <span style={{ color: '#fff', fontWeight: 600 }}>25% off</span> your first hunt.
            </p>

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
                {submitting ? 'DECODING...' : 'UNLOCK_SECRETS'}
              </button>

              {error && (
                <p style={{ color: '#ff0033', fontFamily: "'Fira Code', monospace", fontSize: 12, textAlign: 'center' }}>
                  {error}
                </p>
              )}
            </form>

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
  const { displayed: bodyText, done } = useTypingEffect(secret.body, active, 12);

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
  hasEmail,
}: {
  onComplete: () => void;
  onModalTrigger: () => void;
  hasEmail: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [modalTriggered, setModalTriggered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleRevealed = useCallback(() => {
    setRevealedCount((c) => c + 1);
  }, []);

  // Auto-trigger modal as soon as the first secret finishes typing (~4s)
  useEffect(() => {
    if (revealedCount > MODAL_TRIGGER_INDEX && !modalTriggered && !hasEmail) {
      setModalTriggered(true);
      onModalTrigger();
    }
  }, [revealedCount, modalTriggered, hasEmail, onModalTrigger]);

  const handleNext = () => {
    const next = currentIndex + 1;

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

  const showNextButton = revealedCount > currentIndex && (hasEmail || currentIndex < MODAL_TRIGGER_INDEX);
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
        }}>{Math.min(currentIndex + 1, SECRETS.length)}/{SECRETS.length}</span>
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
      }}>3/3 SECRETS_DECODED</p>

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
          A chat-based mystery experience through NYC neighborhoods. Your phone sends clues. You decode the city. 2-3 hours. No guide, no group — just you and the streets.
        </p>
      </div>
    </div>
  );
}

// ─── Intro Phase ────────────────────────────────────────────────────────────

function IntroPhase({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 3200),
      setTimeout(() => setStep(3), 5400),
      setTimeout(() => setStep(4), 7400),
      setTimeout(() => onDone(), 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

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

      <img
        src="/logo.png"
        alt="StoryHunt"
        style={{
          height: 28,
          marginBottom: 40,
          opacity: step >= 0 ? 0.7 : 0,
          transition: 'opacity 0.6s',
        }}
      />

      <h1 className="secrets-glitch" style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 'clamp(16px, 4.5vw, 22px)',
        fontWeight: 700,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 28,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        opacity: step >= 0 ? 1 : 0,
        transition: 'opacity 0.8s',
      }}>
        A mystery experience<br />through New York City
      </h1>

      <div style={{
        textAlign: 'center',
        marginBottom: 32,
        opacity: step >= 1 ? 1 : 0,
        transform: step >= 1 ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.6s, transform 0.6s',
      }}>
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 'clamp(13px, 3.5vw, 15px)',
          color: '#fff',
          letterSpacing: '0.04em',
          lineHeight: 1.8,
          marginBottom: 8,
        }}>
          Your phone sends clues.
          <br />You decode the city.
        </p>
        <p style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 'clamp(13px, 3.2vw, 15px)',
          color: '#4B5563',
          lineHeight: 1.5,
        }}>
          No guide. No group. Just you and the streets.
        </p>
      </div>

      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        color: '#64748B',
        textAlign: 'center',
        maxWidth: 320,
        lineHeight: 1.6,
        marginBottom: 28,
        opacity: step >= 2 ? 1 : 0,
        transform: step >= 2 ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.6s, transform 0.6s',
      }}>
        Every hunt is built on <span style={{ color: '#94A3B8' }}>real locations</span> most people never find.
      </p>

      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 'clamp(14px, 3.5vw, 16px)',
        color: '#ff0033',
        textAlign: 'center',
        letterSpacing: '0.05em',
        opacity: step >= 3 ? 1 : 0,
        transform: step >= 3 ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.6s, transform 0.6s',
      }}>
        We found 5 of them.
      </p>

      {step >= 4 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#050505',
          zIndex: 50,
          animation: 'secretsGlitchOut 0.6s ease-in forwards',
        }} />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Phase = 'experience' | 'complete';

export default function SecretsPage() {
  const [phase, setPhase] = useState<Phase>('experience');
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

  return (
    <div style={{
      background: '#050505',
      color: '#fff',
      minHeight: '100dvh',
      position: 'relative',
    }}>
      {phase === 'experience' && (
        <ExperiencePhase
          onComplete={() => setPhase('complete')}
          onModalTrigger={handleModalTrigger}
          hasEmail={hasEmail}
        />
      )}
      {phase === 'complete' && (
        <CTAPhase hasEmail={hasEmail} />
      )}

      {showModal && (
        <EmailModal
          onSubmit={handleEmailSubmit}
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

        @keyframes secretsGlitchOut {
          0% { opacity: 0; transform: scaleY(1); }
          20% { opacity: 1; transform: scaleY(0.02); background: #ff0033; }
          40% { opacity: 1; transform: scaleY(0.02); background: #00d2ff; }
          60% { opacity: 1; transform: scaleY(0.01); background: #ff0033; }
          100% { opacity: 1; transform: scaleY(1); background: #050505; }
        }

        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
