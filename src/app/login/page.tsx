'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
    const { signIn, user, loading } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // If already logged in, redirect to dashboard
    useEffect(() => {
        if (!loading && user) {
            router.replace('/dashboard');
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) { setError('Completá todos los campos.'); return; }
        setSubmitting(true);
        setError('');
        try {
            await signIn(email, password);
            router.replace('/dashboard');
        } catch (err: any) {
            const code = err?.code ?? '';
            if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setError('Email o contraseña incorrectos.');
            } else if (code === 'auth/too-many-requests') {
                setError('Demasiados intentos fallidos. Esperá unos minutos.');
            } else {
                setError('Error al iniciar sesión. Revisá tu conexión.');
            }
        }
        setSubmitting(false);
    };

    if (loading || user) return null;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', sans-serif",
        }}>
            {/* Background glow */}
            <div style={{
                position: 'fixed', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(124,58,237,0.18) 0%, transparent 70%)',
            }} />

            <div style={{ width: '100%', maxWidth: 420, padding: '0 24px', position: 'relative' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 56, height: 56, borderRadius: 16,
                        background: 'linear-gradient(135deg, var(--brand-primary) 0%, #a855f7 100%)',
                        fontSize: 22, fontWeight: 800, color: '#fff',
                        boxShadow: '0 8px 32px rgba(124,58,237,0.35)',
                        marginBottom: 20,
                    }}>SH</div>
                    <h1 style={{
                        fontSize: 26, fontWeight: 800, color: 'var(--text-primary)',
                        letterSpacing: '-0.5px', margin: '0 0 6px',
                    }}>
                        Story<span style={{ color: 'var(--brand-primary)' }}>Hunt</span>
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                        Panel de administración
                    </p>
                </div>

                {/* Card */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 16,
                    padding: '32px 28px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                }}>
                    <h2 style={{
                        fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
                        margin: '0 0 24px',
                    }}>Iniciar sesión</h2>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Email</label>
                            <input
                                className="form-input"
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                                autoFocus
                                id="login-email"
                            />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Contraseña</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                id="login-password"
                            />
                        </div>

                        {error && (
                            <div style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.25)',
                                borderRadius: 8, padding: '10px 14px',
                                fontSize: 13, color: '#FCA5A5',
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={submitting}
                            id="login-submit"
                            style={{ marginTop: 4, width: '100%', justifyContent: 'center', height: 44 }}
                        >
                            {submitting ? 'Ingresando...' : 'Ingresar'}
                        </button>
                    </form>
                </div>

                <p style={{
                    textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
                    marginTop: 24,
                }}>
                    ¿Olvidaste tu contraseña? Pedile al administrador que te reenvíe la invitación.
                </p>
            </div>
        </div>
    );
}
