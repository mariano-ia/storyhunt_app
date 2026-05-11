'use client';

import { useEffect, useState } from 'react';
import {
  trackViewContent,
  trackInitiateCheckout,
  trackAddPaymentInfo,
  flushPendingEvents,
} from '@/lib/analytics';

type Experience = {
  id: string;
  name: string;
  name_en?: string;
  slug: string;
  status: string;
  web_tagline?: string;
  web_tagline_en?: string;
  web_image?: string;
  price: number;
  location?: string;
  duration?: string;
  starting_point?: string;
};

const PROMO_CODE = 'STORYHUNT';

export default function FoundersPage() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [lang, setLang] = useState<'es' | 'en'>('en');
  const [error, setError] = useState('');

  useEffect(() => {
    const browserLang = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
    setLang(browserLang.startsWith('es') ? 'es' : 'en');
  }, []);

  useEffect(() => {
    fetch('/api/public/experiences')
      .then(r => r.json())
      .then(data => {
        const all: Experience[] = Array.isArray(data) ? data : (data.experiences || []);
        const published = all.filter(e => e.status === 'published');
        setExperiences(published);
        if (published.length > 0) {
          trackViewContent(published.map(e => e.id), { source: 'founders_landing', campaign: 'founders_100_doors' });
        }
      })
      .catch(() => setError('Could not load doors. Reload the page.'))
      .finally(() => setLoading(false));
  }, []);

  const handleClaim = async (exp: Experience) => {
    setCheckoutLoading(exp.id);
    setError('');
    trackInitiateCheckout(exp.id, 0, lang, {
      content_name: exp.name,
      coupon: PROMO_CODE,
      source: 'founders_landing',
      campaign: 'founders_100_doors',
    });
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience_id: exp.id,
          lang,
          coupon_code: PROMO_CODE,
        }),
      });
      const data = await res.json();
      if (data.url) {
        trackAddPaymentInfo(exp.id, 0, {
          content_name: exp.name,
          coupon: PROMO_CODE,
          source: 'founders_landing',
          campaign: 'founders_100_doors',
        }, { flush: true });
        await flushPendingEvents();
        window.location.href = data.url;
      } else {
        setError(data.error || 'Doors closed. Try another.');
        setCheckoutLoading(null);
      }
    } catch {
      setError('Connection error. Try again.');
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="founders-page">
      <section className="hero-section">
        <div className="hero-inner">
          <div className="logo-row">
            <img src="/logo.png" alt="StoryHunt" />
          </div>

          <div className="sh-hero-card">
            <h1 className="hero-h1">
              NYC opens <span className="accent">100 doors</span>.
              <br />
              Play <span className="accent">FREE</span> this week.
            </h1>
            <p className="hero-sub">
              The city is tired of tourists. This week we hand 100 keys to people who notice.
            </p>
          </div>
        </div>
      </section>

      <main className="founders-content">
        <section className="doors">
          {loading && <div className="loading">LOADING_DOORS...</div>}
          {!loading && experiences.length === 0 && (
            <div className="loading">NO_DOORS_AVAILABLE</div>
          )}
          {!loading && experiences.map(exp => {
            const name = lang === 'en' ? (exp.name_en || exp.name) : exp.name;
            const tagline = lang === 'en' ? (exp.web_tagline_en || exp.web_tagline) : exp.web_tagline;
            const isLoading = checkoutLoading === exp.id;
            return (
              <button
                key={exp.id}
                className="door"
                onClick={() => handleClaim(exp)}
                disabled={isLoading}
                aria-label={`Open ${name}`}
              >
                {exp.web_image && (
                  <div
                    className="door-image"
                    style={{ backgroundImage: `url(${exp.web_image})` }}
                  />
                )}
                <div className="door-overlay" />
                <div className="door-badge">FREE_FOR_FOUNDERS</div>
                <div className="door-content">
                  <div className="door-meta">
                    {exp.location && (
                      <span className="door-location">{exp.location.toUpperCase()}</span>
                    )}
                    {exp.price > 0 && (
                      <span className="door-original-price">${exp.price.toFixed(2)}</span>
                    )}
                  </div>
                  <h3 className="door-name">{(name || '').toUpperCase()}</h3>
                  {tagline && <p className="door-tagline">{tagline}</p>}
                  <div className="door-cta">
                    {isLoading ? 'OPENING...' : 'STEP_THROUGH →'}
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {error && <div className="error">{error}</div>}

        <footer className="footer">
          <p>Six days. Then the doors close.</p>
        </footer>
      </main>

      <style jsx>{`
        .founders-page {
          min-height: 100vh;
          background: #050505;
          color: #fff;
          font-family: 'Fira Code', 'Courier New', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .hero-section {
          position: relative;
          padding: 24px 16px 32px;
        }
        .hero-inner {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 720px;
          margin: 0 auto;
        }
        .logo-row {
          display: flex;
          justify-content: center;
        }
        .logo-row img {
          height: 22px;
          opacity: 0.85;
        }
        @keyframes sh-hero-gradient {
          0%, 100% { background-position: 0% 50%, 100% 50%; }
          50% { background-position: 100% 50%, 0% 50%; }
        }
        @keyframes sh-hero-border {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .sh-hero-card {
          position: relative;
          padding: 28px 22px 24px;
          border-radius: 22px;
          background:
            radial-gradient(ellipse 70% 50% at 15% 10%, rgba(255,0,51,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 85% 90%, rgba(0,210,255,0.09) 0%, transparent 60%),
            linear-gradient(135deg, #0c0c0e 0%, #0a0a0c 100%);
          background-size: 220% 220%, 220% 220%, 100% 100%;
          animation: sh-hero-gradient 22s ease-in-out infinite;
          box-shadow: 0 0 80px rgba(255,0,51,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
          overflow: hidden;
          isolation: isolate;
          max-width: 520px;
          margin: 0 auto;
          width: 100%;
        }
        .sh-hero-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 22px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,0,51,0.45) 0%, rgba(0,210,255,0.25) 50%, rgba(255,0,51,0.45) 100%);
          background-size: 200% 100%;
          animation: sh-hero-border 18s ease-in-out infinite;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          pointer-events: none;
          z-index: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .sh-hero-card, .sh-hero-card::before { animation: none !important; }
        }
        .hero-h1 {
          position: relative;
          z-index: 1;
          font-family: 'Fira Code', monospace;
          font-size: clamp(20px, 5.5vw, 30px);
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          line-height: 1.2;
          margin: 0 0 16px;
          text-align: center;
        }
        .accent {
          color: #ff0033;
        }
        .hero-sub {
          position: relative;
          z-index: 1;
          font-family: 'Fira Sans', sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #aaa;
          margin: 0;
          text-align: center;
        }
        .founders-content {
          position: relative;
          z-index: 1;
          max-width: 720px;
          margin: 0 auto;
          padding: 0 20px 60px;
        }
        .doors {
          margin-top: 32px;
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 700px) {
          .doors {
            grid-template-columns: 1fr 1fr;
          }
        }
        .door {
          all: unset;
          cursor: pointer;
          position: relative;
          aspect-ratio: 4 / 3;
          border: 1px solid #222;
          border-radius: 10px;
          overflow: hidden;
          background: #0a0a0a;
          transition: border-color 0.2s, transform 0.2s;
          color: #fff;
          font-family: inherit;
          display: block;
        }
        .door:hover {
          border-color: #ff0033;
          transform: translateY(-2px);
        }
        .door:disabled {
          opacity: 0.6;
          cursor: wait;
          transform: none;
        }
        .door-image {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0.55;
        }
        .door-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.25) 0%, transparent 35%, rgba(0, 0, 0, 0.92) 100%);
        }
        .door-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 2;
          padding: 6px 10px;
          background: #00ff41;
          color: #000;
          font-family: 'Fira Code', 'Courier New', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          border-radius: 4px;
          box-shadow: 0 0 20px rgba(0, 255, 65, 0.45);
          animation: badgePulse 2.6s ease-in-out infinite;
        }
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 65, 0.45); }
          50% { box-shadow: 0 0 28px rgba(0, 255, 65, 0.7); }
        }
        @media (prefers-reduced-motion: reduce) {
          .door-badge { animation: none !important; }
        }
        .door-content {
          position: relative;
          z-index: 1;
          height: 100%;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .door-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          letter-spacing: 0.12em;
          margin-bottom: 10px;
        }
        .door-location {
          color: #bbb;
        }
        .door-original-price {
          color: #666;
          text-decoration: line-through;
        }
        .door-name {
          font-family: 'Fira Sans', sans-serif;
          font-size: 19px;
          font-weight: 700;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
          line-height: 1.15;
        }
        .door-tagline {
          font-family: 'Fira Sans', sans-serif;
          font-size: 13px;
          color: #aaa;
          margin: 0 0 14px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .door-cta {
          font-size: 12px;
          color: #ff0033;
          letter-spacing: 0.12em;
          font-weight: 700;
        }
        .loading {
          color: #555;
          text-align: center;
          padding: 40px;
          font-size: 12px;
          letter-spacing: 0.18em;
        }
        .error {
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(255, 0, 51, 0.1);
          border: 1px solid rgba(255, 0, 51, 0.3);
          border-radius: 6px;
          color: #ff8a9c;
          font-size: 13px;
          text-align: center;
        }
        .footer {
          margin-top: 50px;
          padding-top: 30px;
          border-top: 1px solid #1a1a1a;
          text-align: center;
        }
        .footer p {
          color: #666;
          font-size: 12px;
          letter-spacing: 0.12em;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
