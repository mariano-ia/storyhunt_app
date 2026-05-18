'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function UnsubscribeInner() {
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || '';
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

    useEffect(() => {
        if (!email) {
            setStatus('error');
            return;
        }
        fetch('/api/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        })
            .then(r => r.ok ? setStatus('ok') : setStatus('error'))
            .catch(() => setStatus('error'));
    }, [email]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#050505',
            color: '#fff',
            fontFamily: "'Fira Code', 'Courier New', monospace",
            padding: 24,
        }}>
            <div style={{ textAlign: 'center', maxWidth: 460 }}>
                <div style={{ fontSize: 11, color: '#00d2ff', letterSpacing: '0.15em', marginBottom: 12 }}>
                    UNSUBSCRIBE
                </div>
                {status === 'loading' && (
                    <>
                        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Processing...</h1>
                        <p style={{ color: '#94A3B8', lineHeight: 1.6 }}>One second.</p>
                    </>
                )}
                {status === 'ok' && (
                    <>
                        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>You're unsubscribed.</h1>
                        <p style={{ color: '#94A3B8', lineHeight: 1.6 }}>
                            {email ? <>We won't email <strong style={{ color: '#fff' }}>{email}</strong> with anything else.</> : "We won't email you again."}
                        </p>
                        <p style={{ color: '#666', lineHeight: 1.6, fontSize: 13, marginTop: 24 }}>
                            Changed your mind? Reply to any past email or write to{' '}
                            <a href="mailto:hello@storyhunt.city" style={{ color: '#00d2ff' }}>hello@storyhunt.city</a>.
                        </p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Something went wrong.</h1>
                        <p style={{ color: '#94A3B8', lineHeight: 1.6 }}>
                            Email{' '}
                            <a href="mailto:hello@storyhunt.city?subject=unsubscribe" style={{ color: '#00d2ff' }}>
                                hello@storyhunt.city
                            </a>{' '}
                            and we'll remove you manually.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}

export default function UnsubscribePage() {
    return (
        <Suspense fallback={null}>
            <UnsubscribeInner />
        </Suspense>
    );
}
