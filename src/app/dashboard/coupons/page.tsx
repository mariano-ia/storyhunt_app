'use client';
import { useEffect, useState } from 'react';
import { Ticket, Plus, Trash2, Copy, Check, Percent, DollarSign, X } from 'lucide-react';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon, getExperiences } from '@/lib/firestore';
import { authFetch } from '@/lib/api';
import ConfirmModal from '@/components/ConfirmModal';
import type { DiscountCoupon, DiscountCouponFormData, Experience } from '@/lib/types';

function NewCouponModal({ experiences, onSave, onClose }: {
    experiences: Experience[];
    onSave: (data: DiscountCouponFormData) => Promise<void>;
    onClose: () => void;
}) {
    const [form, setForm] = useState<DiscountCouponFormData>({
        code: '',
        discount_type: 'percent',
        discount_value: 10,
        max_redemptions: 100,
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'active',
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.code.trim()) return;
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
                boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Nuevo cupon</h3>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: 12 }}>Codigo</label>
                        <input className="form-input" placeholder="Ej: PROMO20" value={form.code}
                            onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 12 }}>Tipo</label>
                            <select className="form-input" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value as any })}>
                                <option value="percent">Porcentaje (%)</option>
                                <option value="fixed">Monto fijo ($)</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 12 }}>
                                {form.discount_type === 'percent' ? 'Descuento (%)' : 'Descuento ($)'}
                            </label>
                            <input className="form-input" type="number" min={1} value={form.discount_value}
                                onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 12 }}>Usos maximos</label>
                            <input className="form-input" type="number" min={1} value={form.max_redemptions}
                                onChange={e => setForm({ ...form, max_redemptions: Number(e.target.value) })} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 12 }}>Valido hasta</label>
                            <input className="form-input" type="date" value={form.valid_until.slice(0, 10)}
                                onChange={e => setForm({ ...form, valid_until: new Date(e.target.value).toISOString() })} />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                    <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!form.code.trim() || saving}>
                        {saving ? 'Creando...' : 'Crear cupon'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<DiscountCoupon[]>([]);
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [toDelete, setToDelete] = useState<DiscountCoupon | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        const [c, e] = await Promise.all([getCoupons(), getExperiences()]);
        setCoupons(c);
        setExperiences(e);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (data: DiscountCouponFormData) => {
        // Create coupon in Stripe first, then save to Firestore
        try {
            const res = await authFetch('/api/coupons/sync', {
                method: 'POST',
                body: JSON.stringify(data),
            });
            const result = await res.json();

            await createCoupon({
                ...data,
                stripe_coupon_id: result.stripe_coupon_id,
                stripe_promo_id: result.stripe_promo_id,
            });
        } catch {
            // If Stripe sync fails, still create locally
            await createCoupon(data);
        }
        setShowNew(false);
        load();
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        await deleteCoupon(toDelete.id);
        setToDelete(null);
        setDeleting(false);
        load();
    };

    const handleToggleStatus = async (coupon: DiscountCoupon) => {
        const newStatus = coupon.status === 'active' ? 'disabled' : 'active';
        await updateCoupon(coupon.id, { status: newStatus });
        setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, status: newStatus } : c));
    };

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const activeCount = coupons.filter(c => c.status === 'active').length;
    const totalRedeemed = coupons.reduce((sum, c) => sum + c.times_redeemed, 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cupones</h1>
                    <p className="page-subtitle">Codigos de descuento para tus experiencias</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                    <Plus size={16} /> Nuevo cupon
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-card-icon purple"><Ticket size={18} /></div>
                    <div className="stat-card-value">{coupons.length}</div>
                    <div className="stat-card-label">Total cupones</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon green"><Check size={18} /></div>
                    <div className="stat-card-value">{activeCount}</div>
                    <div className="stat-card-label">Activos</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-icon cyan"><Percent size={18} /></div>
                    <div className="stat-card-value">{totalRedeemed}</div>
                    <div className="stat-card-label">Canjeados</div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : coupons.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon"><Ticket size={26} /></div>
                    <div className="empty-state-title">Sin cupones</div>
                    <p className="empty-state-text">Crea tu primer cupon de descuento.</p>
                    <button className="btn btn-primary" onClick={() => setShowNew(true)}>
                        <Plus size={16} /> Crear cupon
                    </button>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Codigo</th>
                                <th>Descuento</th>
                                <th>Usos</th>
                                <th>Valido hasta</th>
                                <th>Estado</th>
                                <th style={{ textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map(coupon => (
                                <tr key={coupon.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <code style={{ fontSize: 13, fontWeight: 700, background: 'var(--bg-elevated)', padding: '3px 10px', borderRadius: 6, color: 'var(--text-brand)' }}>
                                                {coupon.code}
                                            </code>
                                            <button className="btn btn-ghost btn-icon btn-sm" data-tip="Copiar"
                                                onClick={() => copyCode(coupon.code)}
                                                style={{ color: copiedCode === coupon.code ? 'var(--success)' : 'var(--text-muted)' }}>
                                                {copiedCode === coupon.code ? <Check size={13} /> : <Copy size={13} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                            {coupon.discount_type === 'percent'
                                                ? <><Percent size={13} /> {coupon.discount_value}%</>
                                                : <><DollarSign size={13} /> {coupon.discount_value}</>}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                                            {coupon.times_redeemed} / {coupon.max_redemptions}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {new Date(coupon.valid_until).toLocaleDateString('es-AR')}
                                    </td>
                                    <td>
                                        <span className={`badge badge-${coupon.status === 'active' ? 'active' : coupon.status === 'disabled' ? 'inactive' : 'abandoned'}`}>
                                            {coupon.status === 'active' ? 'Activo' : coupon.status === 'disabled' ? 'Desactivado' : 'Expirado'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                            <button className="btn btn-ghost btn-sm" data-tip={coupon.status === 'active' ? 'Desactivar' : 'Activar'}
                                                onClick={() => handleToggleStatus(coupon)}
                                                style={{ fontSize: 12 }}>
                                                {coupon.status === 'active' ? 'Desactivar' : 'Activar'}
                                            </button>
                                            <button className="btn btn-ghost btn-icon btn-sm" data-tip="Eliminar"
                                                onClick={() => setToDelete(coupon)} style={{ color: 'var(--danger)' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showNew && <NewCouponModal experiences={experiences} onSave={handleCreate} onClose={() => setShowNew(false)} />}
            {toDelete && (
                <ConfirmModal
                    title="Eliminar cupon"
                    message={`Eliminar el cupon "${toDelete.code}"? Esta accion no se puede deshacer.`}
                    onConfirm={handleDelete}
                    onCancel={() => setToDelete(null)}
                    loading={deleting}
                />
            )}
        </div>
    );
}
