import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { apDungCheDo, docCheDo } from '@/lib/giao-dien';
import '@/index.css';

apDungCheDo(docCheDo());

const goc = document.getElementById('goc');
if (!goc) throw new Error('Không tìm thấy phần tử #goc trong index.html.');

createRoot(goc).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
