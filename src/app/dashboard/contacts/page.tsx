'use client';

import { useEffect, useState } from 'react';
import { getContacts, updateContactStatus } from '@/lib/firestore';
import type { Contact } from '@/lib/types';
import { Mail, Clock, CheckCircle2, UserPlus, Search, ArrowUpDown, Download } from 'lucide-react';

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setLoading(true);
        try {
            const data = await getContacts();
            setContacts(data);
        } catch (error) {
            console.error('Error loading contacts', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (contact: Contact) => {
        const newStatus = contact.status === 'new' ? 'contacted' : 'new';
        try {
            // Optimistic update
            setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: newStatus } : c));
            await updateContactStatus(contact.id, newStatus);
        } catch (error) {
            console.error('Error updating status', error);
            // Revert on error
            setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: contact.status } : c));
        }
    };

    const filteredContacts = contacts
        .filter(c => c.email.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

    const newContactsCount = contacts.filter(c => c.status === 'new').length;

    return (
        <div className="dashboard-content-inner">
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <UserPlus size={28} />
                        Contactos Web
                    </h1>
                    <p className="page-subtitle">Visualiza y gestiona las solicitudes de acceso recibidas a través de la web principal.</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="stat-badge mono">
                        <span>NUEVOS: </span>
                        <span style={{ color: 'var(--brand-primary)', marginLeft: 8 }}>{newContactsCount}</span>
                    </div>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                            const rows = [['Email', 'Fecha', 'Estado']];
                            filteredContacts.forEach(c => {
                                rows.push([c.email, new Date(c.created_at).toISOString(), c.status]);
                            });
                            const csv = rows.map(r => r.join(',')).join('\n');
                            const blob = new Blob([csv], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`;
                            a.click();
                            URL.revokeObjectURL(url);
                        }}
                        disabled={filteredContacts.length === 0}
                    >
                        <Download size={14} /> Exportar CSV
                    </button>
                </div>
            </header>

            <div className="filters-bar" style={{ display: 'flex', gap: 16, marginBottom: 30 }}>
                <div className="search-wrapper" style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Buscar por email..."
                        className="input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: 44, width: '100%' }}
                    />
                </div>
                <button
                    className="btn btn-outline"
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    style={{ whiteSpace: 'nowrap' }}
                >
                    <ArrowUpDown size={16} style={{ marginRight: 8 }} />
                    Fecha ({sortOrder === 'desc' ? 'Más recientes' : 'Más antiguos'})
                </button>
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando contactos...</div>
            ) : filteredContacts.length === 0 ? (
                <div className="empty-state">
                    <Mail size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                    <h3 className="mono">NO_HAY_CONTACTOS</h3>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {searchTerm ? 'No se encontraron resultados para la búsqueda.' : 'Aún no hay usuarios que hayan solicitado acceso.'}
                    </p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 12 }}>
                                <th style={{ padding: '16px 20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Email</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Fecha de solicitud</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Estado</th>
                                <th style={{ padding: '16px 20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContacts.map(contact => (
                                <tr key={contact.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color 0.2s', backgroundColor: contact.status === 'new' ? 'rgba(78, 201, 176, 0.05)' : 'transparent' }}>
                                    <td style={{ padding: '20px' }}>
                                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                                            {contact.email}
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                                            <Clock size={14} />
                                            {new Date(contact.created_at).toLocaleString('es-ES', {
                                                day: '2-digit', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </td>
                                    <td style={{ padding: '20px' }}>
                                        {contact.status === 'new' ? (
                                            <span className="badge badge-primary" style={{ padding: '4px 10px', fontSize: 12 }}>NUEVO</span>
                                        ) : (
                                            <span className="badge" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '4px 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
                                                Contactado
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '20px', textAlign: 'right' }}>
                                        <button
                                            className={`btn btn-sm ${contact.status === 'new' ? 'btn-outline' : 'btn-ghost'}`}
                                            onClick={() => toggleStatus(contact)}
                                        >
                                            {contact.status === 'new' ? (
                                                <>
                                                    <CheckCircle2 size={16} style={{ marginRight: 6 }} />
                                                    Marcar como contactado
                                                </>
                                            ) : (
                                                'Deshacer'
                                            )}
                                        </button>
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
