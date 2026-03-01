'use client';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

export default function ConfirmModal({
    title, message, confirmLabel = 'Eliminar', onConfirm, onCancel, loading
}: ConfirmModalProps) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-icon">
                    <AlertTriangle size={24} />
                </div>
                <h3 className="modal-title">{title}</h3>
                <p className="modal-text">{message}</p>
                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
                        Cancelar
                    </button>
                    <button className="btn btn-danger" onClick={onConfirm} disabled={loading} id="confirm-delete-btn">
                        {loading ? 'Eliminando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
