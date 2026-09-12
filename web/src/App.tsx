import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { VaiTro } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { BoCucApp } from '@/layouts/BoCucApp';
import { DangNhap } from '@/features/auth/DangNhap';
import { DoiMatKhau } from '@/features/auth/DoiMatKhau';
import { QuanLyNguoiDung } from '@/features/nguoi-dung/QuanLyNguoiDung';
import { KhoaViTri } from '@/features/gps/KhoaViTri';
import { TongQuan } from '@/features/tong-quan/TongQuan';
import { useAuth, VAI_TRO_QUAN_LY } from '@/lib/auth';

function DangTaiToanTrang() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" aria-hidden />
        Đang khôi phục phiên đăng nhập…
      </p>
    </div>
  );
}

/**
 * Chặn ở phía web chỉ để điều hướng cho gọn. Chốt thật nằm ở server: gọi thẳng
 * API mà không đủ quyền vẫn nhận 401/403.
 */
function CanDangNhap({ vaiTro, children }: { vaiTro?: readonly VaiTro[]; children: ReactNode }) {
  const { nguoiDung, dangTai } = useAuth();
  const viTri = useLocation();

  if (dangTai) return <DangTaiToanTrang />;
  if (!nguoiDung) return <Navigate to="/dang-nhap" replace state={{ tu: viTri.pathname }} />;
  if (vaiTro && !vaiTro.includes(nguoiDung.role)) {
    return (
      <Alert variant="destructive" tieuDe="Không đủ quyền">
        Vai trò của bạn không được vào trang này.
      </Alert>
    );
  }
  return <>{children}</>;
}

function ChuaDangNhap({ children }: { children: ReactNode }) {
  const { nguoiDung, dangTai } = useAuth();
  if (dangTai) return <DangTaiToanTrang />;
  if (nguoiDung) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/dang-nhap"
        element={
          <ChuaDangNhap>
            <DangNhap />
          </ChuaDangNhap>
        }
      />

      <Route
        element={
          <CanDangNhap>
            <BoCucApp />
          </CanDangNhap>
        }
      >
        <Route index element={<TongQuan />} />
        <Route path="doi-mat-khau" element={<DoiMatKhau />} />
        <Route
          path="nguoi-dung"
          element={
            <CanDangNhap vaiTro={VAI_TRO_QUAN_LY}>
              <QuanLyNguoiDung />
            </CanDangNhap>
          }
        />
        <Route
          path="khoa-vi-tri"
          element={
            <CanDangNhap vaiTro={['ADMIN']}>
              <KhoaViTri />
            </CanDangNhap>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <div className="container py-10">
            <Alert variant="warning" tieuDe="Không có trang này">
              Đường dẫn bạn mở không tồn tại.
            </Alert>
          </div>
        }
      />
    </Routes>
  );
}
