import Konva from 'konva';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';

// Pointer Capture を有効化し、Stage 外に出ても pointermove を拾えるようにする。
// Konva default は false。詳細は docs/adr/ADR-0006-pointer-events-unification.md。
Konva.capturePointerEventsEnabled = true;

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
