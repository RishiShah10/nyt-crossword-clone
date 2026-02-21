import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
  variant?: 'info' | 'warning';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  variant = 'info',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && onConfirm) onConfirm();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  const isConfirm = !!onConfirm;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{
          ...styles.header,
          borderBottomColor: variant === 'warning' ? '#ff9800' : '#2196f3',
        }}>
          {title}
        </div>
        <div style={styles.body}>{message}</div>
        <div style={styles.footer}>
          {isConfirm ? (
            <>
              <button style={styles.cancelBtn} onClick={onClose}>
                {cancelLabel}
              </button>
              <button
                style={{
                  ...styles.confirmBtn,
                  background: variant === 'warning' ? '#d32f2f' : '#2196f3',
                }}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </>
          ) : (
            <button style={styles.confirmBtn} onClick={onClose}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    animation: 'fadeIn 0.15s ease-out',
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
    minWidth: '300px',
    maxWidth: '400px',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    fontSize: '1rem',
    fontWeight: 700,
    borderBottom: '3px solid #2196f3',
    fontFamily: "'Libre Baskerville', Georgia, serif",
  },
  body: {
    padding: '20px',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: '#333',
  },
  footer: {
    padding: '12px 20px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    borderTop: '1px solid #eee',
  },
  cancelBtn: {
    padding: '8px 18px',
    fontSize: '0.85rem',
    fontWeight: 500,
    border: '1px solid #ccc',
    borderRadius: '6px',
    background: '#fff',
    color: '#333',
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '8px 18px',
    fontSize: '0.85rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '6px',
    background: '#2196f3',
    color: '#fff',
    cursor: 'pointer',
  },
};

export default Modal;
