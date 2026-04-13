'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, MapPin, Smartphone, Compass } from 'lucide-react';

// ─── Experience Card ────────────────────────────────────────────────────────

type Experience = {
  id: string;
  name: string;
  name_en?: string;
  description_en?: string;
  description?: string;
  slug: string;
  price: number;
  status: string;
};

function ExperienceCard({ exp }: { exp: Experience }) {
  const title = exp.name_en || exp.name;
  const desc = exp.description_en || exp.description || '';

  return (
    <a
      href={`https://storyhunt.city/${exp.slug}`}
      style={{
        display: 'block',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '24px',
        textDecoration: 'none',
        color: '#fff',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,0,51,0.4)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <h3 style={{
          fontFamily: "'Fira Code', monospace",
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}>{title}</h3>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 11,
            color: '#4B5563',
            textDecoration: 'line-through',
            marginRight: 6,
          }}>$14.99</span>
          <span style={{
            fontFamily: "'Fira Code', monospace",
            fontSize: 18,
            fontWeight: 700,
            color: '#ff0033',
          }}>${exp.price}</span>
        </div>
      </div>
      <p style={{
        fontFamily: "'Fira Sans', sans-serif",
        fontSize: 14,
        color: '#94A3B8',
        lineHeight: 1.6,
        marginBottom: 16,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as any,
        overflow: 'hidden',
      }}>{desc}</p>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: "'Fira Code', monospace",
        fontSize: 13,
        color: '#ff0033',
        fontWeight: 600,
      }}>
        START_HUNT <ChevronRight size={14} />
      </div>
    </a>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StartPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/public/experiences')
      .then(r => r.json())
      .then(data => {
        const published = (Array.isArray(data) ? data : data.experiences || [])
          .filter((e: Experience) => e.status === 'published');
        setExperiences(published);
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
        maxWidth: 500,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {experiences.map(exp => (
              <ExperienceCard key={exp.id} exp={exp} />
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

      <style>{`
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
