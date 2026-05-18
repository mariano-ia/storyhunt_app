'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { AccessToken } from '@/lib/types';
import { trackPurchase } from '@/lib/analytics';

// ─── Token-based Player Entry ────────────────────────────────────────────────
// Two flows:
//   1. POST-PURCHASE (URL has ?success=1, token is `cs_xxx`):
//      Show a "thank you / your access is ready" screen with explicit
//      "Start hunt now" button. Lazy activation is intentionally NOT triggered
//      until the user clicks Start.
//   2. EMAIL-LINK (URL has SH-XXXXX token, no success param):
//      Validate, lazy-activate the 30-day clock, redirect to /play/[id].

const COPY = {
    es: {
        verifying: 'Verificando acceso...',
        verifyingSub: 'Esto puede tomar unos segundos',
        verified: 'Acceso verificado',
        loading: 'Cargando experiencia...',
        invalid: 'Link invalido',
        expired: 'Link expirado',
        used: 'Link ya utilizado',
        paymentIncomplete: 'El pago no se completo. Intenta nuevamente.',
        defaultInvalid: 'Este link no es valido o ya no existe.',
        expiredMsg: 'Este link ha expirado. Tenes 30 dias desde la primera vez que lo abriste.',
        usedMsg: 'Este link ya fue utilizado el maximo de veces permitidas.',
        missingExperience: 'La experiencia asociada a este link ya no existe.',
        genericError: 'Ocurrio un error al validar tu acceso. Intenta recargar la pagina.',
        back: 'Volver a StoryHunt',
        // Post-purchase
        ppEyebrow: 'ACCESO_LISTO // PAGO_RECIBIDO',
        ppHeading: 'Tu hunt está lista.',
        ppSub: 'Podés empezar ahora o guardar el link para cuando llegues al punto de inicio.',
        ppMeetPoint: 'PUNTO_DE_INICIO',
        ppMeetPointHint: 'Andá hasta acá antes de tocar Start',
        ppEmailLine: (email: string) => <>Te enviamos el link de acceso a <strong style={{ color: '#fff' }}>{email}</strong>.</>,
        ppEmailMissing: 'Guardá esta página o usá tu link cuando lo recibas.',
        ppClockHint: 'Tu reloj de 30 días arranca recién cuando toques Start. No antes.',
        ppCta: 'Empezar hunt ahora',
        ppCtaWait: 'Activando...',
        ppLater: 'O cerrá esta pestaña — el link queda activo hasta dentro de 1 año.',
    },
    en: {
        verifying: 'Verifying access...',
        verifyingSub: 'This may take a few seconds',
        verified: 'Access verified',
        loading: 'Loading experience...',
        invalid: 'Invalid link',
        expired: 'Link expired',
        used: 'Link already used',
        paymentIncomplete: 'Payment did not complete. Please try again.',
        defaultInvalid: 'This link is not valid or no longer exists.',
        expiredMsg: 'This link has expired. You have 30 days from the first time you opened it.',
        usedMsg: 'This link has already been used the maximum number of times.',
        missingExperience: 'The experience linked to this access is no longer available.',
        genericError: 'Something went wrong while validating your access. Try reloading the page.',
        back: 'Back to StoryHunt',
        // Post-purchase
        ppEyebrow: 'ACCESS_GRANTED // PAYMENT_RECEIVED',
        ppHeading: 'Your hunt is ready.',
        ppSub: 'You can start now or save the link for when you arrive at the meeting point.',
        ppMeetPoint: 'MEET_POINT',
        ppMeetPointHint: 'Be there before you tap Start',
        ppEmailLine: (email: string) => <>We sent the access link to <strong style={{ color: '#fff' }}>{email}</strong>.</>,
        ppEmailMissing: 'Save this page or use the link from your email when it arrives.',
        ppClockHint: 'Your 30-day clock starts only when you tap Start. Not before.',
        ppCta: 'Start hunt now',
        ppCtaWait: 'Activating...',
        ppLater: 'Or close this tab — the link stays active for up to 1 year.',
    },
} as const;

type Status = 'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'post_purchase';

export default function TokenPlayPage() {
    const { token } = useParams() as { token: string };
    const router = useRouter();
    const searchParams = useSearchParams();
    // Default to English (tourist traffic). Token-stored lang overrides shortly after.
    const initialLang: 'es' | 'en' = searchParams.get('lang') === 'es' ? 'es' : 'en';
    const isPostPurchase = searchParams.get('success') === '1';

    const [lang, setLang] = useState<'es' | 'en'>(initialLang);
    const [status, setStatus] = useState<Status>('loading');
    const [message, setMessage] = useState('');
    const [accessToken, setAccessToken] = useState<AccessToken | null>(null);
    const [startingPoint, setStartingPoint] = useState<string>('');
    const [experienceName, setExperienceName] = useState<string>('');
    const [activating, setActivating] = useState(false);

    const t = COPY[lang];

    useEffect(() => {
        validateToken();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validateToken = async () => {
        try {
            const res = await fetch('/api/access/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            if (!res.ok) {
                const data = await res.json();
                setStatus('invalid');
                setMessage(res.status === 402 ? COPY[initialLang].paymentIncomplete : (data.error || COPY[initialLang].defaultInvalid));
                return;
            }

            const { access_token: at } = await res.json() as { access_token: AccessToken };
            setAccessToken(at);

            const tokenLang: 'es' | 'en' = at.lang === 'en' ? 'en' : 'es';
            if (tokenLang !== lang) setLang(tokenLang);
            const tt = COPY[tokenLang];

            if (new Date(at.expires_at) < new Date()) {
                setStatus('expired');
                setMessage(tt.expiredMsg);
                return;
            }

            if (at.times_used >= at.max_uses) {
                setStatus('used');
                setMessage(tt.usedMsg);
                return;
            }

            // Auto-resume detection for returning users
            let fromStep: number | null = null;
            try {
                const findRes = await fetch('/api/sessions/find', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ experience_id: at.experience_id, email: at.email }),
                });
                if (findRes.ok) {
                    const { session } = await findRes.json();
                    if (session && session.current_step > 0) {
                        fromStep = session.current_step;
                    }
                }
            } catch {
                // Non-critical
            }

            // Fire client-side Purchase event ONLY on post-purchase entry.
            // Server webhook fires the same event with the same event_id for dedup.
            if (isPostPurchase && token.startsWith('cs_')) {
                trackPurchase(
                    at.experience_id,
                    0,
                    token,
                    { email: at.email, lang: at.lang },
                );
            }

            // POST-PURCHASE flow: show "Your hunt is ready" screen, don't auto-redirect.
            // Activation is deferred until user clicks "Start hunt now".
            // (Note: cs_xxx path in /api/access/verify never activates by design;
            //  only the SH-xxx path activates, and only the explicit Start button calls it.)
            if (isPostPurchase) {
                try {
                    const expRes = await fetch('/api/public/experiences');
                    const expData = await expRes.json();
                    const exps = Array.isArray(expData) ? expData : expData.experiences || [];
                    const exp = exps.find((e: { id: string }) => e.id === at.experience_id);
                    if (exp) {
                        setExperienceName(exp.name || '');
                        setStartingPoint(exp.starting_point || '');
                    }
                } catch { /* non-critical */ }
                setStatus('post_purchase');
                return;
            }

            // EMAIL-LINK flow: token is SH-xxx, lazy activation already happened
            // server-side via verify(). Redirect into the experience.
            setStatus('valid');
            const playUrl = `/play/${at.experience_id}?lang=${at.lang}&token=${token}`;
            router.replace(fromStep !== null ? `${playUrl}&from=${fromStep}` : playUrl);

        } catch (err) {
            console.error('[token-play] Error:', err);
            setStatus('invalid');
            setMessage(COPY[initialLang].genericError);
        }
    };

    const handleStartNow = async () => {
        if (!accessToken || activating) return;
        setActivating(true);
        try {
            // Hit verify with the SH-token explicitly (no skip_activation) — this
            // triggers lazy activation server-side: activated_at set, expires_at
            // becomes now + 30d.
            await fetch('/api/access/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: accessToken.token }),
            });
        } catch (err) {
            console.error('[token-play] Activation error:', err);
            // Continue anyway — /play/[id] will work with the token even if
            // activation API call hiccupped; the next visit will activate.
        }
        router.push(`/play/${accessToken.experience_id}?lang=${accessToken.lang}&token=${accessToken.token}`);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000',
            fontFamily: "'Fira Code', monospace",
            padding: '20px',
        }}>
            {status === 'loading' && (
                <div style={{ textAlign: 'center', color: '#00ff41' }}>
                    <div style={{ fontSize: 18, marginBottom: 12 }}>{t.verifying}</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>{t.verifyingSub}</div>
                </div>
            )}

            {status === 'valid' && (
                <div style={{ textAlign: 'center', color: '#00ff41' }}>
                    <div style={{ fontSize: 18, marginBottom: 12 }}>{t.verified}</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>{t.loading}</div>
                </div>
            )}

            {/* POST-PURCHASE confirmation screen */}
            {status === 'post_purchase' && accessToken && (
                <div style={{
                    width: '100%',
                    maxWidth: 440,
                    padding: '32px 24px',
                    background: '#0a0a0a',
                    border: '1px solid rgba(0,255,102,0.2)',
                    borderRadius: 16,
                }}>
                    <div style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 11,
                        color: '#00ff66',
                        letterSpacing: '0.15em',
                        marginBottom: 14,
                    }}>{t.ppEyebrow}</div>

                    <h1 style={{
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 24,
                        color: '#fff',
                        margin: '0 0 10px',
                        lineHeight: 1.2,
                    }}>{t.ppHeading}</h1>

                    {experienceName && (
                        <p style={{
                            fontFamily: "'Fira Sans', sans-serif",
                            fontSize: 14,
                            color: '#94A3B8',
                            margin: '0 0 14px',
                        }}>{experienceName}</p>
                    )}

                    <p style={{
                        fontFamily: "'Fira Sans', sans-serif",
                        fontSize: 14,
                        color: '#94A3B8',
                        lineHeight: 1.6,
                        margin: '0 0 18px',
                    }}>{t.ppSub}</p>

                    {startingPoint && (
                        <div style={{
                            padding: '12px 14px',
                            background: 'rgba(255,0,51,0.06)',
                            border: '1px solid rgba(255,0,51,0.2)',
                            borderRadius: 8,
                            marginBottom: 16,
                        }}>
                            <div style={{
                                fontFamily: "'Fira Code', monospace",
                                fontSize: 10,
                                color: '#ff0033',
                                letterSpacing: '0.12em',
                                marginBottom: 4,
                            }}>{t.ppMeetPoint}</div>
                            <div style={{
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: 15,
                                color: '#fff',
                                fontWeight: 600,
                                marginBottom: 2,
                            }}>{startingPoint}</div>
                            <div style={{
                                fontFamily: "'Fira Sans', sans-serif",
                                fontSize: 12,
                                color: '#64748B',
                            }}>{t.ppMeetPointHint}</div>
                        </div>
                    )}

                    <p style={{
                        fontFamily: "'Fira Sans', sans-serif",
                        fontSize: 13,
                        color: '#94A3B8',
                        lineHeight: 1.6,
                        margin: '0 0 14px',
                    }}>
                        {accessToken.email
                            ? t.ppEmailLine(accessToken.email)
                            : t.ppEmailMissing}
                    </p>

                    <p style={{
                        padding: '10px 12px',
                        background: 'rgba(0,210,255,0.05)',
                        border: '1px solid rgba(0,210,255,0.15)',
                        borderRadius: 8,
                        fontFamily: "'Fira Sans', sans-serif",
                        fontSize: 13,
                        color: '#94A3B8',
                        lineHeight: 1.5,
                        margin: '0 0 18px',
                    }}>{t.ppClockHint}</p>

                    <button
                        onClick={handleStartNow}
                        disabled={activating}
                        style={{
                            width: '100%',
                            padding: '14px 20px',
                            background: activating ? '#661122' : '#ff0033',
                            border: 'none',
                            borderRadius: 10,
                            color: '#fff',
                            fontFamily: "'Fira Code', monospace",
                            fontSize: 14,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            cursor: activating ? 'wait' : 'pointer',
                            minHeight: 50,
                            marginBottom: 10,
                        }}
                    >▶ {activating ? t.ppCtaWait : t.ppCta}</button>

                    <p style={{
                        textAlign: 'center',
                        fontFamily: "'Fira Code', monospace",
                        fontSize: 11,
                        color: '#4B5563',
                        margin: 0,
                        lineHeight: 1.5,
                    }}>{t.ppLater}</p>
                </div>
            )}

            {(status === 'invalid' || status === 'expired' || status === 'used') && (
                <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
                    <div style={{
                        fontSize: 48, marginBottom: 20, opacity: 0.3,
                        color: status === 'expired' ? '#F59E0B' : '#EF4444',
                    }}>
                        {status === 'expired' ? '!' : 'X'}
                    </div>
                    <div style={{ fontSize: 16, color: '#fff', marginBottom: 12, fontWeight: 600 }}>
                        {status === 'invalid' && t.invalid}
                        {status === 'expired' && t.expired}
                        {status === 'used' && t.used}
                    </div>
                    <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
                        {message}
                    </div>
                    <a href="https://storyhunt.city" style={{
                        display: 'inline-block', marginTop: 24, padding: '10px 24px',
                        background: '#7C3AED', color: '#fff', borderRadius: 8,
                        textDecoration: 'none', fontSize: 14, fontWeight: 600,
                    }}>
                        {t.back}
                    </a>
                </div>
            )}
        </div>
    );
}
