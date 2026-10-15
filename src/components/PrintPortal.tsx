import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PrintPortalProps {
  children: React.ReactNode;
}

export const PrintPortal: React.FC<PrintPortalProps> = ({ children }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById('print-root');
    let criado = false;
    if (!el) {
      el = document.createElement('div');
      el.id = 'print-root';
      document.body.appendChild(el);
      criado = true;
    }

    document.body.classList.add('print-portal-ativo');
    setContainer(el);

    return () => {
      document.body.classList.remove('print-portal-ativo');
      if (criado && el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  if (!container) return null;

  return createPortal(children, container);
};
