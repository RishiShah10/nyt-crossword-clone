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
          borderBottomColor: variant === 'warning' ? '#000' : '#000',
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
              <button style={styles.confirmBtn} onClick={onConfirm}>
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
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: '#ffffff',
    borderRadius: '4px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
    minWidth: '320px',
    maxWidth: '400px',
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
  },
  header: {
    padding: '18px 24px 14px',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#000000',
    borderBottom: '2px solid #000000',
    fontFamily: "'Libre Baskerville', Georgia, serif",
    letterSpacing: '-0.3px',
  },
  body: {
    padding: '20px 24px',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    color: '#333333',
    fontFamily: "'Open Sans', sans-serif",
  },
  footer: {
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    borderTop: '1px solid #e0e0e0',
    background: '#f8f8f8',
  },
  cancelBtn: {
    padding: '8px 20px',
    fontSize: '0.8rem',
    fontWeight: 500,
    border: '1px solid #cccccc',
    borderRadius: '4px',
    background: '#ffffff',
    color: '#000000',
    cursor: 'pointer',
    fontFamily: "'Open Sans', sans-serif",
    letterSpacing: '0',
  },
  confirmBtn: {
    padding: '8px 20px',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: '1px solid #000000',
    borderRadius: '4px',
    background: '#000000',
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: "'Open Sans', sans-serif",
    letterSpacing: '0',
  },
};

export default Modal;
