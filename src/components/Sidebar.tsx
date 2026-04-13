'use client';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Zap, Users, MessageSquare, Settings, ChevronRight, LogOut, UserCog, Sparkles, Ticket, ShoppingCart, Megaphone } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Experiencias', icon: Zap, href: '/dashboard/experiences' },
    { label: 'AI Stories', icon: Sparkles, href: '/dashboard/ai-stories' },
    { label: 'Cupones', icon: Ticket, href: '/dashboard/coupons' },
    { label: 'Ventas', icon: ShoppingCart, href: '/dashboard/sales' },
    { label: 'Campaigns', icon: Megaphone, href: '/dashboard/campaigns' },
    { label: 'Sesiones', icon: Users, href: '/dashboard/sessions' },
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
                <span className="sidebar-section-label">Menú</span>
                {navItems.map(({ label, icon: Icon, href }) => (
                    <button
                        key={href}
                        className={`sidebar-link ${isActive(href) ? 'active' : ''}`}
                        onClick={() => router.push(href)}
                        data-tip={label}
                    >
                        <Icon size={18} className="sidebar-icon" />
                        <span>{label}</span>
                    </button>
                ))}

                <span className="sidebar-section-label">Admin</span>
                {adminItems.map(({ label, icon: Icon, href }) => (
                    <button
                        key={href}
                        className={`sidebar-link ${isActive(href) ? 'active' : ''}`}
                        onClick={() => router.push(href)}
                        data-tip={label}
                    >
                        <Icon size={18} className="sidebar-icon" />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>

            <div className="sidebar-footer">
                {user && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px', borderRadius: 8,
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--brand-primary) 0%, #a855f7 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff',
                        }}>
                            {user.email?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span className="sidebar-footer-text" style={{
                            fontSize: 12, color: 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {user.email}
                        </span>
                        <button
                            className="btn btn-ghost btn-icon btn-sm sidebar-footer-text"
                            onClick={handleLogout}
                            data-tip="Cerrar sesión"
                            style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}
                        >
                            <LogOut size={15} />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
