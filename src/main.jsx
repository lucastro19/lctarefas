import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Aplica o tema salvo antes do React montar para evitar flash
try {
  const saved = JSON.parse(localStorage.getItem('lctarefas-settings') || '{}');
  const theme = saved.state?.theme ?? 'light';
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.add('dark');
  }
} catch (_) {}

// Registra service worker para Web Push e PWA offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
