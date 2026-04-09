'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, ChevronRight, Signal, X } from 'lucide-react';

// ─── Intercepted Conversation Data ───────────────────────────────────────────

type Message = {
  sender: 'A' | 'B' | 'system';
  text: string;
  delay: number;
};

const CONVERSATION: Message[] = [
  { sender: 'system', text: 'SIGNAL_INTERCEPTED // 40.7484° N, 73.9857° W // 02:47 AM', delay: 800 },
  { sender: 'A', text: 'are you there?', delay: 1200 },
  { sender: 'B', text: 'yeah. just got to the spot', delay: 1800 },
  { sender: 'A', text: 'what do you see', delay: 1000 },
  { sender: 'B', text: 'the building is massive. art deco lobby. marble everywhere. but there is no one here', delay: 2200 },
  { sender: 'A', text: 'good. go to the elevators on the east side. not the main ones', delay: 1800 },
  { sender: 'B', text: 'ok I see them. the ones behind the news stand?', delay: 1600 },
  { sender: 'A', text: 'yes. press the button for the basement. it will say "restricted" but the door opens', delay: 2000 },
  { sender: 'B', text: '...it worked', delay: 2400 },
  { sender: 'B', text: 'there are tunnels down here. actual tunnels. under midtown', delay: 1800 },
  // ─── MODAL TRIGGERS AFTER THIS MESSAGE (index 10) ───
  { sender: 'A', text: 'they connect 7 buildings. built during prohibition. nobody talks about them', delay: 2200 },
  { sender: 'B', text: 'wait. I can hear something. like a train but muffled', delay: 2000 },
  { sender: 'A', text: 'that is the old mail rail. it ran under the city until 1966. packages, letters, everything moved underground. 27 miles of track', delay: 2800 },
  { sender: 'B', text: 'there are markings on the walls. numbers and arrows. like someone was mapping routes', delay: 2200 },
  { sender: 'A', text: 'those are original. prohibition era. they had a system — each speakeasy had a number. the arrows pointed runners to the right exit', delay: 2800 },
  { sender: 'B', text: 'this is insane. how does nobody know about this', delay: 1600 },
  { sender: 'A', text: 'people know. they just don\'t look. the entrance is right there in the lobby. thousands walk past it every day', delay: 2400 },
  { sender: 'B', text: 'hold on. there is a door at the end of this tunnel. it has a symbol on it. like a', delay: 2200 },
  { sender: 'system', text: 'SIGNAL_LOST // CONNECTION_TERMINATED', delay: 1500 },
];

const MODAL_TRIGGER_INDEX = 10; // Show modal after "they connect 7 buildings..."

// ─── Chat Bubble ─────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: Message }) {
  if (message.sender === 'system') {
    return (
      <div style={{
        textAlign: 'center',
        padding: '12px 0',
        animation: 'intFadeIn 0.3s ease-out',
      }}>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: message.text.includes('LOST') ? '#ff0033' : '#00d2ff',
          letterSpacing: '0.08em',
          opacity: 0.7,
        }}>{message.text}</span>
      </div>
    );
  }

  const isA = message.sender === 'A';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isA ? 'flex-start' : 'flex-end',
      padding: '4px 0',
      animation: 'intFadeIn 0.3s ease-out',
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '12px 16px',
        borderRadius: isA ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        background: isA ? 'rgba(255,255,255,0.06)' : 'rgba(0,210,255,0.1)',
        border: `1px solid ${isA ? 'rgba(255,255,255,0.08)' : 'rgba(0,210,255,0.15)'}`,
      }}>
        <p style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 15,
          color: isA ? '#E2E8F0' : '#E0F7FF',
          lineHeight: 1.5,
          margin: 0,
        }}>{message.text}</p>
      </div>
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator({ sender }: { sender: 'A' | 'B' }) {
  const isA = sender === 'A';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isA ? 'flex-start' : 'flex-end',
      padding: '4px 0',
    }}>
      <div style={{
        padding: '12px 20px',
        borderRadius: isA ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
        background: isA ? 'rgba(255,255,255,0.04)' : 'rgba(0,210,255,0.06)',
        border: `1px solid ${isA ? 'rgba(255,255,255,0.06)' : 'rgba(0,210,255,0.1)'}`,
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      }}>
        <span className="int-dot" style={{ animationDelay: '0ms' }} />
        <span className="int-dot" style={{ animationDelay: '150ms' }} />
        <span className="int-dot" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'intercepted-lead-magnet' }),
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
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      animation: 'intFadeIn 0.3s ease-out',
    }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onSkip}
      />

      {/* Modal */}
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
        {/* Close */}
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

        {/* Content */}
        <p style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#ff0033',
          letterSpacing: '0.1em',
          marginBottom: 16,
        }}>SIGNAL_PAUSED</p>

        <h3 style={{
          fontFamily: "'Fira Sans', sans-serif",
          fontSize: 20,
          fontWeight: 700,
          color: '#fff',
          marginBottom: 8,
          lineHeight: 1.3,
        }}>
          Want to keep listening?
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

        {/* Coupon preview */}
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
      <div className="int-scanline" />

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
        animation: 'intPulse 2s ease-in-out infinite',
      }}>
        <Signal size={28} color="#ff0033" />
      </div>

      {/* Coordinates */}
      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 11,
        color: '#00d2ff',
        letterSpacing: '0.1em',
        marginBottom: 16,
        opacity: 0.7,
      }}>40.7484° N, 73.9857° W // 02:47 AM</p>

      <h1 className="int-glitch" style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 'clamp(18px, 5vw, 26px)',
        fontWeight: 700,
        color: '#ff0033',
        textAlign: 'center',
        marginBottom: 20,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        Conversation_Intercepted
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
        Two people. A tunnel under Midtown.
        <br />Something they weren&apos;t supposed to find.
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
        We intercepted the conversation.
      </p>

      {/* CTA button */}
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
            animation: 'intFadeIn 0.5s ease-out',
          }}
        >
          LISTEN_IN
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

// ─── Conversation Phase ──────────────────────────────────────────────────────

function ConversationPhase({
  onComplete,
  onModalTrigger,
  paused,
}: {
  onComplete: () => void;
  onModalTrigger: () => void;
  paused: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(true);
  const [modalTriggered, setModalTriggered] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const indexRef = useRef(0);

  const showNext = useCallback((index: number) => {
    indexRef.current = index;

    if (index >= CONVERSATION.length) {
      setShowTyping(false);
      timeoutRef.current = setTimeout(onComplete, 2000);
      return;
    }

    // Trigger modal at the right moment
    if (index === MODAL_TRIGGER_INDEX && !modalTriggered) {
      setModalTriggered(true);
      setShowTyping(false);
      onModalTrigger();
      return;
    }

    const msg = CONVERSATION[index];
    setShowTyping(true);

    timeoutRef.current = setTimeout(() => {
      setVisibleCount(index + 1);
      setShowTyping(false);

      timeoutRef.current = setTimeout(() => {
        showNext(index + 1);
      }, 300);
    }, msg.delay);
  }, [onComplete, onModalTrigger, modalTriggered]);

  // Start the conversation
  useEffect(() => {
    showNext(0);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume after modal is dismissed
  useEffect(() => {
    if (!paused && modalTriggered && indexRef.current === MODAL_TRIGGER_INDEX) {
      showNext(MODAL_TRIGGER_INDEX);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [visibleCount, showTyping]);

  const nextSender = visibleCount < CONVERSATION.length ? CONVERSATION[visibleCount].sender : null;

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
    }}>
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
            background: paused ? '#F59E0B' : '#ff0033',
            animation: paused ? undefined : 'intBlink 1.5s ease-in-out infinite',
          }} />
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 12,
            color: paused ? '#F59E0B' : '#ff0033',
            letterSpacing: '0.08em',
          }}>{paused ? 'SIGNAL_PAUSED' : 'LIVE_INTERCEPT'}</span>
        </div>
        <span style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 11,
          color: '#4B5563',
        }}>02:47 AM NYC</span>
      </div>

      {/* Chat area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px 40px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {CONVERSATION.slice(0, visibleCount).map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {showTyping && !paused && nextSender && nextSender !== 'system' && (
          <TypingIndicator sender={nextSender} />
        )}
      </div>
    </div>
  );
}

// ─── CTA Phase ───────────────────────────────────────────────────────────────

function CTAPhase({ hasEmail }: { hasEmail: boolean }) {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
      textAlign: 'center',
      animation: 'intFadeIn 0.6s ease-out',
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
        <Signal size={32} color="#ff0033" />
      </div>

      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 12,
        color: '#ff0033',
        letterSpacing: '0.1em',
        marginBottom: 24,
      }}>TRANSMISSION_ENDED</p>

      <h2 style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(24px, 6vw, 34px)',
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1.2,
        marginBottom: 12,
        maxWidth: 380,
      }}>
        The signal was lost.
      </h2>
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(16px, 4vw, 19px)',
        color: '#94A3B8',
        lineHeight: 1.5,
        maxWidth: 360,
        marginBottom: 12,
      }}>
        But the tunnels are still there. The doors are still unlocked. The city is full of conversations you were never meant to hear.
      </p>
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 'clamp(16px, 4vw, 19px)',
        color: '#fff',
        lineHeight: 1.5,
        maxWidth: 360,
        marginBottom: 32,
      }}>
        StoryHunt puts you inside the story.
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
          animation: 'intFadeIn 0.4s ease-out',
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

      <p style={{
        fontFamily: "'Fira Code', monospace",
        fontSize: 12,
        color: '#4B5563',
        marginTop: 16,
      }}>storyhunt.city</p>

      {/* Product info */}
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

type Phase = 'splash' | 'conversation' | 'complete';

export default function InterceptedPage() {
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
        <SplashPhase onReady={() => setPhase('conversation')} />
      )}
      {phase === 'conversation' && (
        <ConversationPhase
          onComplete={() => setPhase('complete')}
          onModalTrigger={handleModalTrigger}
          paused={showModal}
        />
      )}
      {phase === 'complete' && (
        <CTAPhase hasEmail={hasEmail} />
      )}

      {/* Email Modal — overlays conversation */}
      {showModal && (
        <EmailModal
          onSubmit={handleEmailSubmit}
          onSkip={handleModalSkip}
        />
      )}

      <style>{`
        .int-scanline {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          z-index: 1;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
          );
        }

        .int-glitch {
          animation: intGlitch 3s infinite;
        }

        .int-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #64748B;
          animation: intDotPulse 1s ease-in-out infinite;
        }

        @keyframes intGlitch {
          0%, 92%, 100% { transform: translate(0); opacity: 1; }
          93% { transform: translate(-2px, 1px); opacity: 0.8; }
          94% { transform: translate(2px, -1px); opacity: 0.9; }
          95% { transform: translate(-1px, 0); opacity: 1; }
        }

        @keyframes intPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,0,51,0.3); }
          50% { box-shadow: 0 0 0 12px rgba(255,0,51,0); }
        }

        @keyframes intFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes intBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        @keyframes intDotPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        ::-webkit-scrollbar { display: none; }
        html { scrollbar-width: none; }
      `}</style>
    </div>
  );
}
