'use client';
import { useEffect, useState } from 'react';
import { Users, UserPlus, Mail, Clock, CheckCircle, RefreshCw, Trash2 } from 'lucide-react';
import { authFetch } from '@/lib/api';

interface AdminUser {
    id: string;
    email: string;
    invited_at: string;
    status: 'invited' | 'active';
}

export default function UsersPage() {
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/users/invite');
            const data = await res.json();
            setAdmins(data.admins ?? []);
        } catch {
            setError('Error al cargar los usuarios.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setInviting(true);
        setError('');
        setSuccess('');

        const res = await authFetch('/api/users/invite', {
            method: 'POST',
            body: JSON.stringify({ email: inviteEmail }),
        });
        const data = await res.json();

        if (!res.ok) {
            setError(data.error ?? 'Error al invitar.');
        } else {
            setSuccess(`Invitación enviada a ${inviteEmail}. Recibirá un email para establecer su contraseña.`);
            setInviteEmail('');
            load();
        }
        setInviting(false);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Usuarios</h1>
                    <p className="page-subtitle">Gestioná los administradores que tienen acceso al panel</p>
                </div>
            </div>

            {/* Invite form */}
            <div className="card" style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'rgba(124,58,237,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <UserPlus size={18} style={{ color: 'var(--brand-primary)' }} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Invitar nuevo administrador
                        </h3>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                            Le llegará un email con un link para establecer su contraseña
                        </p>
                    </div>
                </div>

                <form onSubmit={handleInvite} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                        <label className="form-label">Email del nuevo administrador</label>
                        <input
                            className="form-input"
                            type="email"
                            placeholder="admin@empresa.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            id="invite-email-input"
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={inviting || !inviteEmail}
                        id="invite-btn"
                        style={{ flexShrink: 0 }}
                    >
                        <UserPlus size={15} />
                        {inviting ? 'Enviando...' : 'Invitar'}
                    </button>
                </form>

                {error && (
                    <div style={{
                        marginTop: 14,
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        borderRadius: 8, padding: '10px 14px',
                        fontSize: 13, color: '#FCA5A5',
                    }}>
                        {error}
                    </div>
                )}
                {success && (
                    <div style={{
                        marginTop: 14,
                        background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.25)',
                        borderRadius: 8, padding: '10px 14px',
                        fontSize: 13, color: '#86efac',
                        display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <CheckCircle size={14} style={{ flexShrink: 0 }} />
                        {success}
                    </div>
                )}
            </div>

            {/* Admins list */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'rgba(124,58,237,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Users size={18} style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                            Administradores
                        </h3>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={load} title="Recargar">
                        <RefreshCw size={14} />
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 16px', borderRadius: 10,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                            }}>
                                <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                                <div style={{ flex: 1 }}>
                                    <div className="skeleton" style={{ height: 14, borderRadius: 4, width: 200, marginBottom: 6 }} />
                                    <div className="skeleton" style={{ height: 12, borderRadius: 4, width: 120 }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : admins.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '40px 20px',
                        color: 'var(--text-muted)', fontSize: 14,
                    }}>
                        <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p>No hay administradores invitados aún.</p>
                        <p style={{ fontSize: 12, marginTop: 4 }}>Usá el formulario de arriba para invitar al primero.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {admins.map(admin => (
                            <div key={admin.id} style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 16px', borderRadius: 10,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                                transition: 'border-color 0.15s',
                            }}>
                                {/* Avatar */}
                                <div style={{
                                    width: 38, height: 38, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--brand-primary) 0%, #a855f7 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                                }}>
                                    {admin.email[0].toUpperCase()}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 14, fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <Mail size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        {admin.email}
                                    </div>
                                    <div style={{
                                        fontSize: 12, color: 'var(--text-muted)',
                                        marginTop: 2, display: 'flex', alignItems: 'center', gap: 6,
                                    }}>
                                        <Clock size={11} />
                                        Invitado el {new Date(admin.invited_at).toLocaleDateString('es-AR', {
                                            day: '2-digit', month: 'short', year: 'numeric',
                                        })}
                                    </div>
                                </div>

                                {/* Badge */}
                                <span style={{
                                    fontSize: 11, fontWeight: 600, paddingInline: 10, paddingBlock: 4,
                                    borderRadius: 100, flexShrink: 0,
                                    background: 'rgba(124,58,237,0.15)',
                                    color: 'var(--brand-primary-light)',
                                    border: '1px solid rgba(124,58,237,0.2)',
                                }}>
                                    Superadmin
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
