'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ChevronRight, Phone, X, Copy, Check, Play, Pause } from 'lucide-react';

// ─── Subtitle Data (timed to audio) ─────────────────────────────────────────

type Subtitle = {
  start: number; // seconds
  end: number;
  text: string;
};

const SUBTITLES: Subtitle[] = [
  { start: 0.0, end: 3.8, text: "You're looking for a door, not a front door, a side door." },
  { start: 3.8, end: 6.4, text: "Red brick, no number on it." },
  { start: 6.4, end: 9.6, text: "There's a fire escape above it, but nobody uses it." },
  { start: 9.6, end: 12.8, text: "If you walk past the bodega on the corner," },
  { start: 12.8, end: 15.0, text: "count three buildings east." },
  { start: 15.0, end: 16.8, text: "The one with the faded awning." },
  { start: 16.8, end: 18.8, text: "Look down, there's a grate." },
  { start: 18.8, end: 21.5, text: "But that's not a grate, that's the entrance." },
  { start: 21.5, end: 24.3, text: "They sealed it in '94, but the lock," },
  { start: 24.3, end: 26.4, text: "the lock was never replaced." },
  { start: 26.4, end: 29.0, text: "Go at night, after the restaurant closes," },
  { start: 29.1, end: 31.1, text: "you'll hear it before you see it." },
  { start: 31.1, end: 35.2, text: "A low hum, like the city breathing underneath itself." },
  { start: 35.2, end: 37.9, text: "Don't bring a flashlight, your phone is enough," },
  { start: 37.9, end: 40.2, text: "and don't tell anyone where you're going." },
  { start: 40.2, end: 41.7, text: "You'll know you're in the right place" },
  { start: 41.7, end: 43.8, text: "when you see the tiles." },
  { start: 43.8, end: 46.8, text: "Green and white, 1912." },
  { start: 46.8, end: 49.7, text: "They built this before anyone was watching." },
  { start: 49.7, end: 52.8, text: "The corridor goes north for about 200 feet," },
  { start: 52.8, end: 54.4, text: "then it splits." },
  { start: 54.4, end: 57.5, text: "Take the left, always the left." },
  { start: 57.5, end: 60.8, text: "There's a room at the end, small concrete walls." },
  { start: 60.8, end: 62.8, text: "Someone left a chair there." },
  { start: 62.8, end: 66.0, text: "And on the wall, coordinates." },
  { start: 66.0, end: 68.6, text: "Written in chalk, I checked them." },
  { start: 68.6, end: 70.4, text: "They point to another door." },
  { start: 70.4, end: 72.4, text: "I haven't opened that one yet." },
];

const MODAL_TRIGGER_TIME = 10; // Early — after fire escape line

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
        body: JSON.stringify({ email, source: 'voicemail-lead-magnet' }),
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
      animation: 'vmFadeIn 0.3s ease-out',
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
              KEEP_LISTENING
              <ChevronRight size={16} />
            </button>
          </>
        ) : (
          <>
            <p style={{
              fontFamily: "'Fira Code', monospace",
              fontSize: 11,
              color: '#ff0033',
              letterSpacing: '0.1em',
              marginBottom: 16,
            }}>PLAYBACK_PAUSED</p>

            <h3 style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 8,
              lineHeight: 1.3,
            }}>
              Want to hear the rest?
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
                {submitting ? 'CONNECTING...' : 'UNLOCK_DISCOUNT'}
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
              skip — just let me listen
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
    }}>
      <div className="vm-scanline" />

      {/* Logo */}
      <img src="/logo.png" alt="StoryHunt" style={{ height: 28, opacity: 0.7, marginBottom: 40 }} />

      {/* Phone icon */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        border: '2px solid #ff0033',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        animation: 'vmPulse 2s ease-in-out infinite',
      }}>
        <Phone size={28} color="#ff0033" />
      </div>

      {/* Label */}
      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 11,
        color: '#00d2ff',
        letterSpacing: '0.1em',
        marginBottom: 16,
        opacity: 0.7,
      }}>04:12 AM // UNKNOWN_NUMBER</p>

      <h1 className="vm-glitch" style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 'clamp(18px, 5vw, 26px)',
        fontWeight: 700,
        color: '#ff0033',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        Voicemail_Recovered
      </h1>

      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(15px, 4vw, 17px)',
        color: '#94A3B8',
        textAlign: 'center',
        maxWidth: 340,
        lineHeight: 1.6,
        marginBottom: 8,
      }}>
        A voicemail was left at 4:12 AM from an unknown number. It describes a location somewhere in New York City.
      </p>
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(15px, 4vw, 17px)',
        color: '#fff',
        textAlign: 'center',
        maxWidth: 340,
        lineHeight: 1.6,
        marginBottom: 40,
      }}>
        No one has identified it yet.
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
            animation: 'vmFadeIn 0.5s ease-out',
          }}
        >
          PLAY_VOICEMAIL
          <Play size={18} />
        </button>
      )}
    </div>
  );
}

// ─── Player Phase ────────────────────────────────────────────────────────────

function PlayerPhase({
  onComplete,
  onModalTrigger,
  paused,
}: {
  onComplete: () => void;
  onModalTrigger: () => void;
  paused: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [modalTriggered, setModalTriggered] = useState(false);
  const [started, setStarted] = useState(false);

  // Start playing on mount
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      audio.play().then(() => {
        setPlaying(true);
        setStarted(true);
      }).catch(() => {
        // Autoplay blocked — user needs to tap
      });
    };

    tryPlay();
  }, []);

  // Pause/resume when modal shows/hides
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !started) return;

    if (paused) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [paused, started]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);

    // Trigger modal
    if (audio.currentTime >= MODAL_TRIGGER_TIME && !modalTriggered) {
      setModalTriggered(true);
      onModalTrigger();
    }
  }, [modalTriggered, onModalTrigger]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setTimeout(onComplete, 1500);
  }, [onComplete]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => {
        setPlaying(true);
        setStarted(true);
      }).catch(() => {});
    }
  };

  // Current subtitle
  const currentSub = SUBTITLES.find(
    s => currentTime >= s.start && currentTime < s.end
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <audio
        ref={audioRef}
        src="/voicemail.mp3"
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleEnded}
      />

      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: paused ? '#F59E0B' : playing ? '#ff0033' : '#4B5563',
            animation: playing && !paused ? 'vmBlink 1.5s ease-in-out infinite' : undefined,
          }} />
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 12,
            color: paused ? '#F59E0B' : '#ff0033',
            letterSpacing: '0.08em',
          }}>{paused ? 'PLAYBACK_PAUSED' : 'PLAYING_VOICEMAIL'}</span>
        </div>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#4B5563',
        }}>04:12 AM</span>
      </div>

      {/* Main content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px 24px',
      }}>
        {/* Voice indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          marginBottom: 40,
          height: 48,
        }}>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                width: 4,
                borderRadius: 2,
                background: '#ff0033',
                opacity: playing && !paused && currentSub ? 1 : 0.2,
                transition: 'height 0.15s, opacity 0.3s',
                height: playing && !paused && currentSub ? undefined : 8,
                animation: playing && !paused && currentSub
                  ? `vmBar 0.8s ease-in-out ${i * 0.12}s infinite alternate`
                  : undefined,
              }}
            />
          ))}
        </div>

        {/* Subtitle */}
        <div style={{
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
        }}>
          <p style={{
            fontFamily: "'Fira Sans', sans-serif",
            fontSize: 'clamp(18px, 5vw, 24px)',
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: 360,
            opacity: currentSub ? 1 : 0.3,
            transition: 'opacity 0.3s',
          }}>
            {currentSub ? currentSub.text : (started ? '...' : 'Tap play to start')}
          </p>
        </div>

        {/* Play/pause button */}
        <button
          onClick={togglePlay}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 40,
            transition: 'border-color 0.2s',
          }}
        >
          {playing ? <Pause size={24} color="#fff" /> : <Play size={24} color="#fff" style={{ marginLeft: 2 }} />}
        </button>
      </div>

      {/* Progress bar + time */}
      <div style={{
        padding: '0 20px 24px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '100%',
          height: 3,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 8,
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: '#ff0033',
            borderRadius: 2,
            transition: 'width 0.3s linear',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 11,
            color: '#4B5563',
          }}>{formatTime(currentTime)}</span>
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 11,
            color: '#4B5563',
          }}>{formatTime(duration)}</span>
        </div>
      </div>
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
      animation: 'vmFadeIn 0.6s ease-out',
    }}>
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: '2px solid #ff0033',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        opacity: 0.6,
      }}>
        <Phone size={32} color="#ff0033" />
      </div>

      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 12,
        color: '#ff0033',
        letterSpacing: '0.1em',
        marginBottom: 24,
      }}>END_OF_VOICEMAIL</p>

      <h2 style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(24px, 6vw, 34px)',
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1.2,
        marginBottom: 12,
        maxWidth: 380,
      }}>
        The coordinates are real.
      </h2>
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(16px, 4vw, 19px)',
        color: '#94A3B8',
        lineHeight: 1.5,
        maxWidth: 360,
        marginBottom: 12,
      }}>
        Somewhere under New York, there are doors that haven&apos;t been opened yet. StoryHunt sends you to find them.
      </p>
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(16px, 4vw, 19px)',
        color: '#fff',
        lineHeight: 1.5,
        maxWidth: 360,
        marginBottom: 32,
      }}>
        Your phone. The city. The mystery.
      </p>

      {/* Coupon */}
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
          animation: 'vmFadeIn 0.4s ease-out',
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

      {/* CTA */}
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

type Phase = 'splash' | 'player' | 'complete';

export default function VoicemailPage() {
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
        <SplashPhase onReady={() => setPhase('player')} />
      )}
      {phase === 'player' && (
        <PlayerPhase
          onComplete={() => setPhase('complete')}
          onModalTrigger={handleModalTrigger}
          paused={showModal}
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
        .vm-scanline {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          z-index: 1;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
          );
        }

        .vm-glitch {
          animation: vmGlitch 3s infinite;
        }

        @keyframes vmGlitch {
          0%, 92%, 100% { transform: translate(0); opacity: 1; }
          93% { transform: translate(-2px, 1px); opacity: 0.8; }
          94% { transform: translate(2px, -1px); opacity: 0.9; }
          95% { transform: translate(-1px, 0); opacity: 1; }
        }

        @keyframes vmPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,0,51,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(255,0,51,0); }
        }

        @keyframes vmFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes vmBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        @keyframes vmBar {
          0% { height: 8px; }
          100% { height: 40px; }
        }

        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
