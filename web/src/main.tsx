import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { CungCapAuth } from '@/lib/auth';
import { apDungCheDo, docCheDo } from '@/lib/giao-dien';
import '@/index.css';

apDungCheDo(docCheDo());

const goc = document.getElementById('goc');
if (!goc) throw new Error('Không tìm thấy phần tử #goc trong index.html.');

createRoot(goc).render(
  <StrictMode>
    <BrowserRouter>
      <CungCapAuth>
        <App />
      </CungCapAuth>
    </BrowserRouter>
  </StrictMode>,
);
