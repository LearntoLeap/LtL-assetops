import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { CungCapAuth } from '@/lib/auth';
import { CungCapXacNhan } from '@/components/ui/hop-xac-nhan';
import { apDungCheDo, docCheDo } from '@/lib/giao-dien';
import '@/index.css';

apDungCheDo(docCheDo());

const goc = document.getElementById('goc');
if (!goc) throw new Error('Không tìm thấy phần tử #goc trong index.html.');

createRoot(goc).render(
  <StrictMode>
    <BrowserRouter>
      <CungCapAuth>
        <CungCapXacNhan>
          <App />
        </CungCapXacNhan>
      </CungCapAuth>
    </BrowserRouter>
  </StrictMode>,
);
