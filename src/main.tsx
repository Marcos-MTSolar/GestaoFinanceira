import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Registro do Service Worker para PWA (Progressive Web App)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Erro ao registrar Service Worker PWA:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
