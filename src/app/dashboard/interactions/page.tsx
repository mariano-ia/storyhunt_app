'use client';
import { MessageSquare } from 'lucide-react';

export default function InteractionsPage() {
    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Interacciones</h1>
                    <p className="page-subtitle">Historial detallado de mensajes entre usuarios y el sistema</p>
                </div>
            </div>
            <div className="empty-state" style={{ marginTop: 40 }}>
                <div className="empty-state-icon"><MessageSquare size={26} /></div>
                <div className="empty-state-title">Disponible en Fase 2</div>
                <p className="empty-state-text">El historial de interacciones estará disponible cuando se integre el webhook de Twilio y el LLM en la Fase 2 del proyecto.</p>
            </div>
        </div>
    );
}
