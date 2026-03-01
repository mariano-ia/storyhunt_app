'use client';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Configuración</h1>
                    <p className="page-subtitle">Ajustes globales de la plataforma</p>
                </div>
            </div>
            <div className="card" style={{ maxWidth: 560 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary-light)' }}>
                        <Settings size={20} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700 }}>Proyecto Firebase</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>storyhunt-platform-961ec</div>
                    </div>
                </div>
                <div className="divider" />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    <p>Base de datos: <strong style={{ color: 'var(--text-primary)' }}>Firestore (nam5 — us-central)</strong></p>
                    <p>Modo actual: <strong style={{ color: 'var(--text-primary)' }}>Prueba (sin autenticación)</strong></p>
                    <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Las integraciones de Twilio y Gemini se configuran por experiencia en la pestaña "Configuración Técnica".</p>
                </div>
            </div>
        </div>
    );
}
