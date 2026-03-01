'use client';
import { usePathname } from 'next/navigation';
import { Bell, Search } from 'lucide-react';

const breadcrumbs: Record<string, { parent?: string; label: string }> = {
    '/dashboard': { label: 'Dashboard' },
    '/dashboard/experiences': { parent: 'Dashboard', label: 'Experiencias' },
    '/dashboard/experiences/new': { parent: 'Experiencias', label: 'Nueva Experiencia' },
    '/dashboard/sessions': { parent: 'Dashboard', label: 'Sesiones' },
    '/dashboard/interactions': { parent: 'Dashboard', label: 'Interacciones' },
    '/dashboard/settings': { parent: 'Dashboard', label: 'Configuración' },
};

export default function Topbar() {
    const pathname = usePathname();

    // Find best matching breadcrumb
    const crumb = Object.entries(breadcrumbs)
        .filter(([path]) => pathname.startsWith(path))
        .sort((a, b) => b[0].length - a[0].length)[0]?.[1];

    // For edit/metrics pages, derive label from URL
    const isEditPage = pathname.match(/\/dashboard\/experiences\/([^/]+)$/);
    const isMetricsPage = pathname.includes('/metrics');
    const isStepsPage = pathname.includes('/steps');

    let displayParent = crumb?.parent;
    let displayLabel = crumb?.label ?? pathname.split('/').pop() ?? 'Página';

    if (isMetricsPage) { displayParent = 'Experiencias'; displayLabel = 'Métricas'; }
    if (isStepsPage) { displayParent = 'Experiencias'; displayLabel = 'Pasos'; }
    if (isEditPage && !pathname.includes('new')) { displayParent = 'Experiencias'; displayLabel = 'Editar Experiencia'; }

    return (
        <header className="topbar">
            <div className="topbar-left">
                <div className="topbar-breadcrumb">
                    {displayParent && (
                        <>
                            <span>{displayParent}</span>
                            <span className="topbar-breadcrumb-sep">/</span>
                        </>
                    )}
                    <span className="topbar-breadcrumb-current">{displayLabel}</span>
                </div>
            </div>
            <div className="topbar-actions">
                <button className="btn btn-ghost btn-icon" title="Buscar" id="topbar-search-btn">
                    <Search size={18} />
                </button>
                <button className="btn btn-ghost btn-icon" title="Notificaciones" id="topbar-notifications-btn">
                    <Bell size={18} />
                </button>
                <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer'
                }}>A</div>
            </div>
        </header>
    );
}
