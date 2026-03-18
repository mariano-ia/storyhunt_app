'use client';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Zap, Users, MessageSquare, Settings, ChevronRight, LogOut, UserCog } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Experiencias', icon: Zap, href: '/dashboard/experiences' },
    { label: 'Sesiones', icon: Users, href: '/dashboard/sessions' },
    { label: 'Interacciones', icon: MessageSquare, href: '/dashboard/interactions' },
    { label: 'Configuración', icon: Settings, href: '/dashboard/settings' },
];

const adminItems = [
    { label: 'Usuarios', icon: UserCog, href: '/dashboard/users' },
    { label: 'Contactos', icon: Users, href: '/dashboard/contacts' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logOut } = useAuth();

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    const handleLogout = async () => {
        await logOut();
        router.replace('/login');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">SH</div>
                <div className="sidebar-logo-text">
                    Story<span>Hunt</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <span className="sidebar-section-label">Menú Principal</span>
                {navItems.map(({ label, icon: Icon, href }) => (
                    <button
                        key={href}
                        className={`sidebar-link ${isActive(href) ? 'active' : ''}`}
                        onClick={() => router.push(href)}
                    >
                        <Icon size={18} />
                        <span style={{ flex: 1 }}>{label}</span>
                        {isActive(href) && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                    </button>

                ))}

                <span className="sidebar-section-label" style={{ marginTop: 8 }}>Administración</span>
                {adminItems.map(({ label, icon: Icon, href }) => (
                    <button
                        key={href}
                        className={`sidebar-link ${isActive(href) ? 'active' : ''}`}
                        onClick={() => router.push(href)}
                    >
                        <Icon size={18} />
                        <span style={{ flex: 1 }}>{label}</span>
                        {isActive(href) && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                    </button>

                ))}
            </nav>

            <div className="sidebar-footer" style={{ flexDirection: 'column', gap: 12 }}>
                {/* Logged-in user */}
                {user && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--brand-primary) 0%, #a855f7 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: '#fff',
                        }}>
                            {user.email?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span style={{
                            fontSize: 12, color: 'var(--text-secondary)',
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {user.email}
                        </span>
                    </div>
                )}

                {/* System status + Logout */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: 'var(--success)', boxShadow: '0 0 6px var(--success)'
                        }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sistema operativo</span>
                    </div>
                    <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={handleLogout}
                        title="Cerrar sesión"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>
        </aside>
    );
}
