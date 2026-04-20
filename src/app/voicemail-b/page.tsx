'use client';

import { useState } from 'react';
import { Lock, Copy, Check } from 'lucide-react';
import { trackLead } from '@/components/MetaPixel';

// ─── Variant B — text-only, no gate ──────────────────────────────────────────
// Hypothesis: give the secret upfront (no barrier), use DECODED25 as carrot
// for optional email capture. A/B counterpart to /voicemail (audio + gate).

// NYC 6-train bullet (white "6" in #00933C green circle) — inline with text.
function Bullet6() {
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.25em',
            height: '1.25em',
            borderRadius: '50%',
            background: '#00933C',
            color: '#fff',
            fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontWeight: 700,
            fontSize: '0.82em',
            verticalAlign: 'middle',
            margin: '0 0.12em',
            lineHeight: 1,
            transform: 'translateY(-0.05em)',
        }}>6</span>
    );
}

export default function VoicemailBPage() {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
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
                body: JSON.stringify({ email, source: 'voicemail-lead-magnet-b' }),
            });
            if (!res.ok) throw new Error('Failed');
            trackLead();
            setSubmitted(true);
        } catch {
            setError('Something went wrong. Try again.');
            setSubmitting(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText('DECODED25');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            minHeight: '100dvh',
            background: '#050505',
            color: '#fff',
            fontFamily: "'Fira Sans', sans-serif",
            padding: '24px 20px 48px',
            maxWidth: 560,
            margin: '0 auto',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 20,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 28,
            }}>
                <img src="/logo.png" alt="StoryHunt" style={{ height: 22, opacity: 0.85 }} />
                <span style={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: 11,
                    color: '#ff0033',
                    letterSpacing: '0.1em',
                }}>DECLASSIFIED_SECRET_01</span>
            </div>

            {/* Title */}
            <p style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: 11,
                color: '#00d2ff',
                letterSpacing: '0.15em',
                marginBottom: 12,
                opacity: 0.85,
            }}>04:12 AM // UNKNOWN_NUMBER</p>

            <h1 style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: 'clamp(22px, 6vw, 30px)',
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: 12,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
            }}>
                NYC&apos;s most beautiful <span style={{ color: '#ff0033' }}>abandoned</span> subway station
            </h1>

            <p style={{
                fontFamily: "'Fira Sans', sans-serif",
                fontSize: 14,
                color: '#94A3B8',
                marginBottom: 32,
                letterSpacing: '0.02em',
            }}>
                Built 1904. Closed since 1945. Never sealed.
            </p>

            {/* Body text */}
            <div style={{
                fontSize: 'clamp(17px, 4.5vw, 19px)',
                lineHeight: 1.65,
                color: '#e5e7eb',
                marginBottom: 32,
            }}>
                <p style={{ marginBottom: 18 }}>
                    Get on the <Bullet6 /> train. Ride to <strong style={{ color: '#fff' }}>Brooklyn Bridge</strong> — last stop.
                </p>
                <p style={{ marginBottom: 18 }}>
                    Don&apos;t get off. <strong style={{ color: '#fff' }}>Stay in the car.</strong>
                </p>
                <p style={{ marginBottom: 18 }}>
                    The train loops back through the old City Hall station.
                    Sit on the <strong style={{ color: '#fff' }}>right side</strong>.
                </p>
                <p style={{ marginBottom: 18 }}>
                    Green tiles. Stained glass skylights. Brass chandeliers — underground.
                    All still there.
                </p>
                <p style={{
                    fontFamily: "'Fira Code', monospace",
                    fontSize: 'clamp(15px, 4vw, 17px)',
                    color: '#ff0033',
                    marginTop: 28,
                    letterSpacing: '0.02em',
                }}>
                    &gt; You&apos;re welcome.
                </p>
            </div>

            {/* Divider */}
            <div style={{
                height: 1,
                background: 'rgba(255,255,255,0.08)',
                margin: '0 -20px 28px',
            }} />

            {/* Email CTA */}
            {!submitted ? (
                <form onSubmit={handleSubmit}>
                    <p style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 11,
                        color: '#00d2ff',
                        letterSpacing: '0.15em',
                        marginBottom: 10,
                    }}>WANT_A_FULL_HUNT_LIKE_THIS?</p>

                    <h2 style={{
                        fontFamily: "'Fira Sans', sans-serif",
                        fontSize: 'clamp(20px, 5vw, 24px)',
                        fontWeight: 700,
                        lineHeight: 1.25,
                        marginBottom: 16,
                        color: '#fff',
                    }}>
                        Get <span style={{ color: '#ff0033' }}>25% off</span> your first hunt.
                    </h2>

                    <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '16px 18px',
                            background: '#0A0A0A',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 10,
                            color: '#fff',
                            fontFamily: "'Fira Sans', sans-serif",
                            fontSize: 16,
                            outline: 'none',
                            marginBottom: 10,
                            boxSizing: 'border-box',
                        }}
                    />

                    <button
                        type="submit"
                        disabled={!email || submitting}
                        style={{
                            width: '100%',
                            padding: '16px 24px',
                            background: !email || submitting ? '#661122' : '#ff0033',
                            border: 'none',
                            borderRadius: 10,
                            color: '#fff',
                            fontFamily: "'Fira Code', monospace",
                            fontSize: 14,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            cursor: !email || submitting ? 'wait' : 'pointer',
                            minHeight: 52,
                        }}
                    >
                        {submitting ? 'SENDING...' : 'Send me the code'}
                    </button>

                    {error && (
                        <p style={{
                            fontFamily: "'Fira Code', monospace",
                            fontSize: 12,
                            color: '#ff0033',
                            marginTop: 10,
                        }}>{error}</p>
                    )}

                    <p style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 11,
                        color: '#4B5563',
                        marginTop: 14,
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                    }}>
                        <Lock size={10} />
                        no spam, 1 email a week max
                    </p>
                </form>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <p style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 11,
                        color: '#10B981',
                        letterSpacing: '0.15em',
                        marginBottom: 14,
                    }}>ACCESS_GRANTED</p>

                    <h3 style={{
                        fontFamily: "'Fira Sans', sans-serif",
                        fontSize: 22,
                        fontWeight: 700,
                        color: '#fff',
                        marginBottom: 8,
                    }}>
                        Here&apos;s your code.
                    </h3>

                    <p style={{
                        fontSize: 14,
                        color: '#94A3B8',
                        marginBottom: 20,
                        lineHeight: 1.5,
                    }}>
                        Copy it now or check your inbox — same code works at checkout.
                    </p>

                    <button
                        onClick={handleCopy}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '14px 28px',
                            background: 'rgba(255,0,51,0.15)',
                            border: '1px solid rgba(255,0,51,0.35)',
                            borderRadius: 10,
                            cursor: 'pointer',
                            marginBottom: 18,
                        }}
                    >
                        <span style={{
                            fontFamily: "'Fira Code', monospace",
                            fontSize: 22,
                            fontWeight: 800,
                            color: '#ff0033',
                            letterSpacing: '0.15em',
                        }}>DECODED25</span>
                        {copied ? <Check size={20} color="#10B981" /> : <Copy size={20} color="#ff0033" />}
                    </button>

                    <a
                        href="/start"
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '14px 24px',
                            background: '#ff0033',
                            borderRadius: 10,
                            color: '#fff',
                            fontFamily: "'Fira Code', monospace",
                            fontSize: 14,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            textDecoration: 'none',
                            textAlign: 'center',
                            minHeight: 52,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        Browse hunts →
                    </a>
                </div>
            )}
        </div>
    );
}
