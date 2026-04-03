'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAccessToken, getExperience } from '@/lib/firestore';
import type { AccessToken } from '@/lib/types';

// ─── Token-based Player Entry ────────────────────────────────────────────────
// Validates access via server-side verification, then redirects to the player.

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
            // Call server-side verify endpoint (handles both SH- tokens and cs_ session IDs)
            const res = await fetch('/api/access/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            if (!res.ok) {
                const data = await res.json();
                if (res.status === 402) {
                    setStatus('invalid');
                    setMessage('El pago no se completo. Intenta nuevamente.');
                } else {
                    setStatus('invalid');
                    setMessage(data.error || 'Este link no es valido o ya no existe.');
                }
                return;
            }

            const { access_token: accessToken } = await res.json() as { access_token: AccessToken };

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
            router.replace(`/play/${accessToken.experience_id}?lang=${accessToken.lang}&token=${token}`);

        } catch (err) {
            console.error('[token-play] Error:', err);
            setStatus('invalid');
            setMessage('Ocurrio un error al validar tu acceso. Intenta recargar la pagina.');
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
                    <a href="https://storyhunt.city" style={{
                        display: 'inline-block', marginTop: 24, padding: '10px 24px',
                        background: '#7C3AED', color: '#fff', borderRadius: 8,
                        textDecoration: 'none', fontSize: 14, fontWeight: 600,
                    }}>
                        Volver a StoryHunt
                    </a>
                </div>
            )}
        </div>
    );
}
