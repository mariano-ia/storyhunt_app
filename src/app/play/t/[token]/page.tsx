'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAccessToken, useAccessToken, getExperience } from '@/lib/firestore';
import type { AccessToken } from '@/lib/types';

// ─── Token-based Player Entry ────────────────────────────────────────────────
// Validates the access token, increments usage, then redirects to the actual player.

export default function TokenPlayPage() {
    const { token } = useParams() as { token: string };
    const router = useRouter();
    const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'used'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        validateToken();
    }, []);

    const validateToken = async () => {
        try {
            // Token might be a Stripe session ID (from checkout redirect) or an SH- token
            let accessToken: AccessToken | null = null;

            if (token.startsWith('cs_')) {
                // Stripe Checkout Session ID — look up by stripe_session_id
                // The webhook might not have fired yet, so we wait a bit and retry
                for (let attempt = 0; attempt < 5; attempt++) {
                    const { getDocs, collection, query, where } = await import('firebase/firestore');
                    const { db } = await import('@/lib/firebase');
                    const q = query(collection(db, 'access_tokens'), where('stripe_session_id', '==', token));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        accessToken = { id: snap.docs[0].id, ...snap.docs[0].data() } as AccessToken;
                        break;
                    }
                    // Wait 2 seconds before retrying (webhook might be processing)
                    if (attempt < 4) await new Promise(r => setTimeout(r, 2000));
                }
            } else {
                accessToken = await getAccessToken(token);
            }

            if (!accessToken) {
                setStatus('invalid');
                setMessage('Este link no es valido o ya no existe.');
                return;
            }

            // Check expiration
            if (new Date(accessToken.expires_at) < new Date()) {
                setStatus('expired');
                setMessage('Este link ha expirado. Los links de acceso son validos por 48 horas.');
                return;
            }

            // Check usage
            if (accessToken.times_used >= accessToken.max_uses) {
                setStatus('used');
                setMessage('Este link ya fue utilizado el maximo de veces permitidas.');
                return;
            }

            // Valid! Increment usage and redirect to player
            await useAccessToken(accessToken.id);

            // Verify experience exists
            const experience = await getExperience(accessToken.experience_id);
            if (!experience) {
                setStatus('invalid');
                setMessage('La experiencia asociada a este link ya no existe.');
                return;
            }

            setStatus('valid');
            // Redirect to the actual player with lang param
            router.replace(`/play/${accessToken.experience_id}?lang=${accessToken.lang}`);

        } catch (err) {
            console.error('[token-play] Error:', err);
            setStatus('invalid');
            setMessage('Ocurrio un error al validar tu acceso.');
        }
    };

    return (
        <div style={{
            height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#000', fontFamily: "'Fira Code', monospace",
        }}>
            {status === 'loading' && (
                <div style={{ textAlign: 'center', color: '#00ff41' }}>
                    <div style={{ fontSize: 18, marginBottom: 12 }}>Verificando acceso...</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>Esto puede tomar unos segundos</div>
                </div>
            )}

            {status === 'valid' && (
                <div style={{ textAlign: 'center', color: '#00ff41' }}>
                    <div style={{ fontSize: 18, marginBottom: 12 }}>Acceso verificado</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>Cargando experiencia...</div>
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
                        {status === 'invalid' && 'Link invalido'}
                        {status === 'expired' && 'Link expirado'}
                        {status === 'used' && 'Link ya utilizado'}
                    </div>
                    <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6 }}>
                        {message}
                    </div>
                    <a
                        href="https://storyhunt.city"
                        style={{
                            display: 'inline-block', marginTop: 24, padding: '10px 24px',
                            background: '#7C3AED', color: '#fff', borderRadius: 8,
                            textDecoration: 'none', fontSize: 14, fontWeight: 600,
                        }}
                    >
                        Volver a StoryHunt
                    </a>
                </div>
            )}
        </div>
    );
}
