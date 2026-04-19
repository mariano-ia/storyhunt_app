'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ChevronRight, Phone, Copy, Check, Play, Pause } from 'lucide-react';
import { trackLead } from '@/components/MetaPixel';

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

const AUDIO_START_TIME = 16.8; // Skip directly to "Look down, there's a grate..." (peak tension)
const MODAL_TRIGGER_TIME = 22; // ~5s of playback from start point — gate at "...the lock was never replaced"

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
        body: JSON.stringify({ email, source: 'voicemail-lead-magnet' }),
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
      animation: 'vmFadeIn 0.3s ease-out',
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
              The voicemail is yours.
            </h3>

            <p style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 14,
              color: '#94A3B8',
              lineHeight: 1.5,
              marginBottom: 16,
            }}>
              And here&apos;s something extra — 25% off if you want to hunt the real location.
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
              KEEP_LISTENING
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
              A mystery walk through New York City.
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
              color: '#ff0033',
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}>PLAYBACK_PAUSED</p>

            <h3 style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
              marginBottom: 8,
              lineHeight: 1.3,
            }}>
              The entrance is real.
            </h3>

            <p style={{
              fontFamily: "'Fira Sans', sans-serif",
              fontSize: 14,
              color: '#94A3B8',
              lineHeight: 1.5,
              marginBottom: 20,
            }}>
              Drop your email to hear the coordinates + get <span style={{ color: '#fff', fontWeight: 600 }}>25% off</span> your first hunt.
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
                {submitting ? 'CONNECTING...' : 'GET_COORDINATES'}
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
              marginTop: 16,
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
    const buttonTimer = setTimeout(() => setShowButton(true), 1500);
    // Auto-advance to PlayerPhase after 2s if user hasn't tapped.
    // On iOS audio still needs a tap (OS restriction), but the next phase
    // surfaces a large play button so it's unmissable.
    const autoAdvance = setTimeout(onReady, 2000);
    return () => {
      clearTimeout(buttonTimer);
      clearTimeout(autoAdvance);
    };
  }, [onReady]);

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
  // Wall-clock anchor: on iOS, audio.currentTime is unreliable (returns stale
  // or zero values). We read it once when play starts, then advance via
  // Date.now() while playing. Re-anchored on every resume.
  const playStartRef = useRef<number | null>(null);
  const anchorAudioTimeRef = useRef<number>(AUDIO_START_TIME);

  // Start playing on mount — skip directly to peak tension point
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      // Seek to AUDIO_START_TIME first, then play
      const startPlayback = () => {
        try {
          audio.currentTime = AUDIO_START_TIME;
        } catch {
          // Some browsers fail to seek before metadata loads
        }
        audio.play().then(() => {
          anchorAudioTimeRef.current = audio.currentTime || AUDIO_START_TIME;
          playStartRef.current = Date.now();
          setPlaying(true);
          setStarted(true);
        }).catch(() => {
          // Autoplay blocked — user needs to tap
        });
      };

      if (audio.readyState >= 1) {
        startPlayback();
      } else {
        audio.addEventListener('loadedmetadata', startPlayback, { once: true });
      }
    };

    tryPlay();
  }, []);

  // iOS fallback: wall-clock timer to trigger modal ~5.2s after playback begins.
  // iOS Safari sometimes fails to seek or throttles timeupdate events, so the
  // currentTime-based trigger can never reach threshold. This guarantees the
  // gate fires on every device.
  useEffect(() => {
    if (!started || modalTriggered) return;
    const t = setTimeout(() => {
      if (!modalTriggered) {
        setModalTriggered(true);
        onModalTrigger();
      }
    }, 5200);
    return () => clearTimeout(t);
  }, [started, modalTriggered, onModalTrigger]);

  // Pause/resume when modal shows/hides
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !started) return;

    if (paused) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => {
        // Re-anchor wall-clock after resume (modal close)
        anchorAudioTimeRef.current = audio.currentTime || anchorAudioTimeRef.current;
        playStartRef.current = Date.now();
        setPlaying(true);
      }).catch(() => {});
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

  // Wall-clock subtitle timing. On iOS, audio.currentTime is unreliable
  // (throttled/stale). We advance the visual clock from Date.now() anchored
  // to the audio position at play/resume time. This guarantees subtitle
  // rhythm matches wall time regardless of what the audio element reports.
  useEffect(() => {
    if (!playing || playStartRef.current === null) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - (playStartRef.current || Date.now())) / 1000;
      setCurrentTime(anchorAudioTimeRef.current + elapsed);
    }, 100);
    return () => clearInterval(id);
  }, [playing]);

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
      // First tap: seek to peak-tension start point so audio matches subtitles.
      // Must happen in the tap handler (gesture context) to satisfy iOS.
      if (!started) {
        try { audio.currentTime = AUDIO_START_TIME; } catch {}
      }
      audio.play().then(() => {
        // Anchor the wall-clock timer at whatever audio position actually landed.
        anchorAudioTimeRef.current = audio.currentTime || AUDIO_START_TIME;
        playStartRef.current = Date.now();
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
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo.png" alt="StoryHunt" style={{ height: 20, opacity: 0.8 }} />
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
              fontSize: 13,
              fontWeight: 600,
              color: paused ? '#F59E0B' : started ? '#ff0033' : '#4B5563',
              letterSpacing: '0.08em',
            }}>{paused ? 'PLAYBACK_PAUSED' : started ? 'PLAYING_VOICEMAIL' : 'VOICEMAIL_READY'}</span>
          </div>
        </div>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#4B5563',
          whiteSpace: 'nowrap',
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

        {/* Subtitle — empty before play, transcribed as audio progresses */}
        <div style={{
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 12px',
        }}>
          {started && (
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
              {currentSub ? currentSub.text : '...'}
            </p>
          )}
        </div>

        {/* Play/pause button — enlarged + aggressively pulsing when audio hasn't started */}
        <button
          onClick={togglePlay}
          style={{
            width: started ? 64 : 112,
            height: started ? 64 : 112,
            borderRadius: '50%',
            border: started ? '2px solid rgba(255,255,255,0.15)' : '3px solid #ff0033',
            background: started ? 'rgba(255,255,255,0.04)' : 'rgba(255,0,51,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: started ? 40 : 24,
            transition: started ? 'all 0.3s' : undefined,
            animation: !started ? 'vmPlayPulse 1.1s ease-in-out infinite' : undefined,
            willChange: 'transform, box-shadow',
          }}
        >
          {playing ? (
            <Pause size={started ? 24 : 44} color="#fff" />
          ) : (
            <Play size={started ? 24 : 44} color={started ? '#fff' : '#fff'} fill={started ? 'transparent' : '#ff0033'} style={{ marginLeft: started ? 2 : 6 }} />
          )}
        </button>

        {!started && (
          <p style={{
            marginTop: 16,
            fontFamily: "'Fira Code', monospace",
            fontSize: 12,
            color: '#ff0033',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            animation: 'vmTapHint 1.4s ease-in-out infinite',
          }}>▼ tap to unlock</p>
        )}
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
      <div className="vm-scanline" />

      {/* Logo */}
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

      {/* Main title — big, styled like Voicemail Recovered */}
      <h1 className="vm-glitch" style={{
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
        A mystery walk<br />through New York City
      </h1>

      {/* How it works — second visual level */}
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

      {/* Built on real */}
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
        Every hunt is built on <span style={{ color: '#94A3B8' }}>real documents</span>,{' '}
        <span style={{ color: '#94A3B8' }}>real locations</span>,{' '}
        <span style={{ color: '#94A3B8' }}>real history</span>.
      </p>

      {/* The hook */}
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
        Here&apos;s one of them.
      </p>

      {/* Glitch overlay */}
      {step >= 4 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#050505',
          zIndex: 50,
          animation: 'vmGlitchOut 0.6s ease-in forwards',
        }} />
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Phase = 'player' | 'complete';

export default function VoicemailPage() {
  const [phase, setPhase] = useState<Phase>('player');
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

        @keyframes vmPlayPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(255,0,51,0.7), 0 0 0 0 rgba(255,0,51,0.45);
          }
          50% {
            transform: scale(1.12);
            box-shadow: 0 0 0 20px rgba(255,0,51,0), 0 0 0 40px rgba(255,0,51,0);
            background: rgba(255,0,51,0.35);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(255,0,51,0), 0 0 0 0 rgba(255,0,51,0);
          }
        }

        @keyframes vmTapHint {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.55; transform: translateY(6px); }
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

        @keyframes vmGlitchOut {
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
