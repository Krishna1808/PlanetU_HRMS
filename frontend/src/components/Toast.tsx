import React, { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

// Global Event Dispatched helpers
export const showToast = {
  success: (message: string, title?: string, duration = 3500) => {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { type: 'success', message, title, duration },
      })
    );
  },
  error: (message: string, title?: string, duration = 4500) => {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { type: 'error', message, title, duration },
      })
    );
  },
  warning: (message: string, title?: string, duration = 4000) => {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { type: 'warning', message, title, duration },
      })
    );
  },
  info: (message: string, title?: string, duration = 3500) => {
    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { type: 'info', message, title, duration },
      })
    );
  },
};

/**
 * Promisified Confirmation Modal.
 * Replaces native browser `window.confirm()` with a styled, non-blocking modal.
 *
 * Usage:
 *   const confirmed = await showConfirm({
 *     title: 'Delete Document',
 *     message: 'Are you sure you want to delete this document?',
 *     isDanger: true,
 *     confirmText: 'Delete'
 *   });
 *   if (!confirmed) return;
 */
export const showConfirm = (options: ConfirmDialogOptions): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(
      new CustomEvent('app-confirm-request', {
        detail: { ...options, resolve },
      })
    );
  });
};

interface ActiveConfirm {
  id: string;
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirm | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<ToastMessage, 'id'>>;
      if (!customEvent.detail) return;

      const newToast: ToastMessage = {
        id: 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: customEvent.detail.type || 'info',
        message: customEvent.detail.message,
        title: customEvent.detail.title,
        duration: customEvent.detail.duration ?? 3500,
      };

      setToasts((prev) => {
        // Limit to max 5 stacked toasts
        const next = [...prev, newToast];
        return next.slice(-5);
      });

      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(newToast.id);
        }, newToast.duration);
      }
    };

    const handleConfirmEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ConfirmDialogOptions & { resolve: (val: boolean) => void }>;
      if (!customEvent.detail) return;

      const { resolve, ...options } = customEvent.detail;
      setActiveConfirm({
        id: 'confirm_' + Date.now(),
        options,
        resolve,
      });
    };

    window.addEventListener('app-toast', handleToastEvent);
    window.addEventListener('app-confirm-request', handleConfirmEvent);

    return () => {
      window.removeEventListener('app-toast', handleToastEvent);
      window.removeEventListener('app-confirm-request', handleConfirmEvent);
    };
  }, [removeToast]);

  const handleConfirmDecision = (choice: boolean) => {
    if (activeConfirm) {
      activeConfirm.resolve(choice);
      setActiveConfirm(null);
    }
  };

  // Keyboard accessibility for confirm modal
  useEffect(() => {
    if (!activeConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleConfirmDecision(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeConfirm]);

  return (
    <>
      {children}

      {/* Floating Toast Banners Container */}
      <aside
        aria-label="Notifications"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100vw - 32px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const bgMap = {
            success: '#f0fdf4',
            error: '#fef2f2',
            warning: '#fffbeb',
            info: '#eff6ff',
          };
          const borderMap = {
            success: '#86efac',
            error: '#fca5a5',
            warning: '#fde047',
            info: '#93c5fd',
          };
          const textMap = {
            success: '#166534',
            error: '#991b1b',
            warning: '#854d0e',
            info: '#1e40af',
          };
          const iconColorMap = {
            success: '#16a34a',
            error: '#dc2626',
            warning: '#d97706',
            info: '#2563eb',
          };

          return (
            <div
              key={t.id}
              role="alert"
              style={{
                pointerEvents: 'auto',
                backgroundColor: bgMap[t.type],
                border: `1px solid ${borderMap[t.type]}`,
                borderRadius: '10px',
                padding: '12px 14px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Status Icon */}
              <div style={{ flexShrink: 0, marginTop: '2px', color: iconColorMap[t.type] }}>
                {t.type === 'success' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )}
                {t.type === 'error' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
                {t.type === 'warning' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                {t.type === 'info' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </div>

              {/* Message Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {t.title && (
                  <div style={{ fontWeight: 600, fontSize: '13px', color: textMap[t.type], marginBottom: '2px' }}>
                    {t.title}
                  </div>
                )}
                <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.45, wordBreak: 'break-word' }}>
                  {t.message}
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Close notification"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  lineHeight: 1,
                  marginTop: '1px',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </aside>

      {/* Styled Modal for In-App Confirmations */}
      {activeConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'modalFadeIn 0.2s ease-out',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleConfirmDecision(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ padding: '22px 24px 16px 24px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: activeConfirm.options.isDanger ? '#fee2e2' : '#eff6ff',
                  color: activeConfirm.options.isDanger ? '#dc2626' : '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {activeConfirm.options.isDanger ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  id="confirm-modal-title"
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  {activeConfirm.options.title || 'Please Confirm'}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13.5px',
                    color: '#475569',
                    lineHeight: 1.5,
                  }}
                >
                  {activeConfirm.options.message}
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '14px 24px',
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={() => handleConfirmDecision(false)}
                className="btn btn-secondary"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '7px',
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                }}
              >
                {activeConfirm.options.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handleConfirmDecision(true)}
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '7px',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: activeConfirm.options.isDanger ? '#dc2626' : '#2563eb',
                  color: '#ffffff',
                  boxShadow: activeConfirm.options.isDanger
                    ? '0 2px 8px rgba(220, 38, 38, 0.3)'
                    : '0 2px 8px rgba(37, 99, 235, 0.3)',
                }}
              >
                {activeConfirm.options.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
