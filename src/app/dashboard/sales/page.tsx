'use client';
import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, ShoppingCart, Download, Ticket } from 'lucide-react';
import { getSales } from '@/lib/firestore';
import type { Sale } from '@/lib/types';

export default function SalesPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSales().then(data => { setSales(data); setLoading(false); });
    }, []);

    const totalRevenue = sales.reduce((sum, s) => sum + (s.amount ?? 0), 0);
    const totalDiscount = sales.reduce((sum, s) => sum + (s.discount_applied ?? 0), 0);
    const withCoupon = sales.filter(s => s.coupon_code).length;

    // Ventas agrupadas por origen de campaña (utm_source) → fallback al canal (source)
    const byOrigin = sales.reduce((acc, s) => {
        const key = s.utm_source || s.source || '(directo)';
        if (!acc[key]) acc[key] = { count: 0, revenue: 0 };
        acc[key].count += 1;
        acc[key].revenue += s.amount ?? 0;
        return acc;
    }, {} as Record<string, { count: number; revenue: number }>);
    const origins = Object.entries(byOrigin).sort((a, b) => b[1].revenue - a[1].revenue);

    // CSV-safe cell: quote when the value contains a comma, quote or newline
    const esc = (v: string | number | null | undefined) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const exportCSV = () => {
        const rows = [['Experiencia', 'Email', 'Monto', 'Moneda', 'Cupon', 'Descuento', 'Origen', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Referrer', 'Fecha']];
        sales.forEach(s => {
            rows.push([
                s.experience_name, s.email,
                (s.amount / 100).toFixed(2), s.currency,
                s.coupon_code || '-', ((s.discount_applied ?? 0) / 100).toFixed(2),
                s.source || '-', s.utm_source || '-', s.utm_medium || '-', s.utm_campaign || '-', s.referrer || '-',
                new Date(s.created_at).toISOString(),
            ]);
        });
        const csv = rows.map(r => r.map(esc).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventas-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ventas</h1>
                    <p className="page-subtitle">Historial de ventas y metricas de ingresos</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={sales.length === 0}>
                    <Download size={14} /> Exportar CSV
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-card-icon green"><DollarSign size={18} /></div>
                    <div className="stat-card-value">${(totalRevenue / 100).toFixed(2)}</div>
                    <div className="stat-card-label">Ingresos totales</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon purple"><ShoppingCart size={18} /></div>
                    <div className="stat-card-value">{sales.length}</div>
                    <div className="stat-card-label">Ventas totales</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon amber"><Ticket size={18} /></div>
                    <div className="stat-card-value">{withCoupon}</div>
                    <div className="stat-card-label">Con cupon</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon cyan"><TrendingUp size={18} /></div>
                    <div className="stat-card-value">${(totalDiscount / 100).toFixed(2)}</div>
                    <div className="stat-card-label">Total descuentos</div>
                </div>
            </div>

            {/* Ventas por origen (UTM / canal) */}
            {!loading && origins.length > 0 && (
                <div className="table-wrapper" style={{ marginBottom: 24 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Origen (UTM source / canal)</th>
                                <th>Ventas</th>
                                <th>Ingresos</th>
                            </tr>
                        </thead>
                        <tbody>
                            {origins.map(([origin, agg]) => (
                                <tr key={origin}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        <code style={{ fontSize: 12, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-brand)' }}>{origin}</code>
                                    </td>
                                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{agg.count}</td>
                                    <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${(agg.revenue / 100).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : sales.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><ShoppingCart size={26} /></div>
                    <div className="empty-state-title">Sin ventas</div>
                    <p className="empty-state-text">Las ventas apareceran aqui cuando tus usuarios compren experiencias.</p>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Experiencia</th>
                                <th>Email</th>
                                <th>Monto</th>
                                <th>Cupon</th>
                                <th>Descuento</th>
                                <th>Origen</th>
                                <th>Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map(sale => (
                                <tr key={sale.id}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{sale.experience_name}</td>
                                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{sale.email}</td>
                                    <td>
                                        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                            ${(sale.amount / 100).toFixed(2)}
                                        </span>
                                    </td>
                                    <td>
                                        {sale.coupon_code
                                            ? <code style={{ fontSize: 12, background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4, color: 'var(--text-brand)' }}>{sale.coupon_code}</code>
                                            : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                    </td>
                                    <td style={{ fontVariantNumeric: 'tabular-nums', color: sale.discount_applied ? 'var(--success)' : 'var(--text-muted)' }}>
                                        {sale.discount_applied ? `-$${(sale.discount_applied / 100).toFixed(2)}` : '-'}
                                    </td>
                                    <td style={{ fontSize: 12 }}>
                                        {sale.utm_source || sale.source
                                            ? <span title={sale.utm_campaign || ''} style={{ color: 'var(--text-secondary)' }}>
                                                {sale.utm_source || sale.source}
                                                {sale.utm_campaign ? <span style={{ color: 'var(--text-muted)' }}> · {sale.utm_campaign}</span> : null}
                                              </span>
                                            : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {new Date(sale.created_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
