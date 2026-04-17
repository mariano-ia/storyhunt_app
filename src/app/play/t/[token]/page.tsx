'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type { AccessToken } from '@/lib/types';

// ─── Token-based Player Entry ────────────────────────────────────────────────
// Validates access via server-side verification, then redirects to the player.

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
        expiredMsg: 'Este link ha expirado. Los links de acceso son validos por 48 horas.',
        usedMsg: 'Este link ya fue utilizado el maximo de veces permitidas.',
        missingExperience: 'La experiencia asociada a este link ya no existe.',
        genericError: 'Ocurrio un error al validar tu acceso. Intenta recargar la pagina.',
        back: 'Volver a StoryHunt',
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
        expiredMsg: 'This link has expired. Access links are valid for 48 hours.',
        usedMsg: 'This link has already been used the maximum number of times.',
        missingExperience: 'The experience linked to this access is no longer available.',
        genericError: 'Something went wrong while validating your access. Try reloading the page.',
        back: 'Back to StoryHunt',
    },
} as const;

export default function TokenPlayPage() {
    const { token } = useParams() as { token: string };
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialLang: 'es' | 'en' = searchParams.get('lang') === 'en' ? 'en' : 'es';
    const [lang, setLang] = useState<'es' | 'en'>(initialLang);
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'used'>('loading');
    const [message, setMessage] = useState('');

    const t = COPY[lang];

    useEffect(() => {
        validateToken();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validateToken = async () => {
        try {
            // Call server-side verify endpoint (handles both SH- tokens and cs_ session IDs)
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

            const { access_token: accessToken } = await res.json() as { access_token: AccessToken };

            // Sync UI language to the token's language (source of truth)
            const tokenLang: 'es' | 'en' = accessToken.lang === 'en' ? 'en' : 'es';
            if (tokenLang !== lang) setLang(tokenLang);
            const tt = COPY[tokenLang];

            // Check expiration
            if (new Date(accessToken.expires_at) < new Date()) {
                setStatus('expired');
                setMessage(tt.expiredMsg);
                return;
            }

            // Check usage
            if (accessToken.times_used >= accessToken.max_uses) {
                setStatus('used');
                setMessage(tt.usedMsg);
                return;
            }

            // Check for an existing in_progress session (auto-resume)
            let fromStep: number | null = null;
            try {
                const findRes = await fetch('/api/sessions/find', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ experience_id: accessToken.experience_id, email: accessToken.email }),
                });
                if (findRes.ok) {
                    const { session } = await findRes.json();
                    if (session && session.current_step > 0) {
                        fromStep = session.current_step;
                    }
                }
            } catch {
                // Non-critical — proceed without resume
            }

            // Increment usage on the server (Admin SDK) — skips increment if resuming
            await fetch('/api/access/use', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: accessToken.id, experience_id: accessToken.experience_id }),
            });

            setStatus('valid');
            const playUrl = `/play/${accessToken.experience_id}?lang=${accessToken.lang}&token=${token}`;
            router.replace(fromStep !== null ? `${playUrl}&from=${fromStep}` : playUrl);

        } catch (err) {
            console.error('[token-play] Error:', err);
            setStatus('invalid');
            setMessage(COPY[initialLang].genericError);
        }
    };

    return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', fontFamily: "'Fira Code', monospace",
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
