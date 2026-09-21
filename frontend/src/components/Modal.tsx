import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * Modal portal — renders children into #modal-root or document.body directly,
 * completely outside any scrolling/overflow/transform ancestor.
 * This guarantees `position: fixed` backdrops are always viewport-relative
 * regardless of page scroll position or container layout.
 */
export function Modal({ children, onClose }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Prevent background scroll while modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  const target = document.getElementById('modal-root') || document.body;
  return createPortal(children, target);
}
