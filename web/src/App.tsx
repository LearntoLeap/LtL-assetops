import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { VaiTro } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { BoCucApp } from '@/layouts/BoCucApp';
import { DangNhap } from '@/features/auth/DangNhap';
import { useAuth, VAI_TRO_NHAP_LIEU, VAI_TRO_QUAN_LY } from '@/lib/auth';

/**
 * Tách gói theo màn hình: mở trang đăng nhập chỉ tải phần đăng nhập, không kéo
 * theo thư viện QR, ảnh và realtime. Máy kiosk tại kho và tablet vào nhanh hơn
 * hẳn, nhất là khi mạng kho yếu.
 */
const TongQuan = lazy(() => import('@/features/tong-quan/TongQuan').then((m) => ({ default: m.TongQuan })));
const DoiMatKhau = lazy(() => import('@/features/auth/DoiMatKhau').then((m) => ({ default: m.DoiMatKhau })));
const ThietBiList = lazy(() => import('@/features/thiet-bi/ThietBiList').then((m) => ({ default: m.ThietBiList })));
const ThietBiChiTiet = lazy(() => import('@/features/thiet-bi/ThietBiChiTiet').then((m) => ({ default: m.ThietBiChiTiet })));
const FormThietBi = lazy(() => import('@/features/thiet-bi/FormThietBi').then((m) => ({ default: m.FormThietBi })));
const DiaDiemList = lazy(() => import('@/features/dia-diem/DiaDiemList').then((m) => ({ default: m.DiaDiemList })));
const DanhMucHome = lazy(() => import('@/features/danh-muc/DanhMucHome').then((m) => ({ default: m.DanhMucHome })));
const NhapLieuHangLoat = lazy(() => import('@/features/nhap-xuat/NhapLieuHangLoat').then((m) => ({ default: m.NhapLieuHangLoat })));
const InNhanQR = lazy(() => import('@/features/qr/InNhanQR').then((m) => ({ default: m.InNhanQR })));
const QuanLyNguoiDung = lazy(() => import('@/features/nguoi-dung/QuanLyNguoiDung').then((m) => ({ default: m.QuanLyNguoiDung })));
const KhoaViTri = lazy(() => import('@/features/gps/KhoaViTri').then((m) => ({ default: m.KhoaViTri })));
const YeuCauList = lazy(() => import('@/features/yeu-cau/YeuCauList').then((m) => ({ default: m.YeuCauList })));
const YeuCauChiTiet = lazy(() => import('@/features/yeu-cau/YeuCauChiTiet').then((m) => ({ default: m.YeuCauChiTiet })));
const FormYeuCau = lazy(() => import('@/features/yeu-cau/FormYeuCau').then((m) => ({ default: m.FormYeuCau })));
const ManHinhKho = lazy(() => import('@/features/kho/ManHinhKho').then((m) => ({ default: m.ManHinhKho })));
const NhatKyHome = lazy(() => import('@/features/nhat-ky/NhatKyHome').then((m) => ({ default: m.NhatKyHome })));

function DangTai({ chu = 'Đang tải…' }: { chu?: string }) {
  return (
    <div className="grid min-h-60 place-items-center">
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="animate-spin" aria-hidden />
        {chu}
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

  if (dangTai) return <DangTai chu="Đang khôi phục phiên đăng nhập…" />;
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
  if (dangTai) return <DangTai chu="Đang khôi phục phiên đăng nhập…" />;
  if (nguoiDung) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<DangTai />}>
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

          {/* Thiết bị — mọi vai trò xem được, phạm vi do server lọc */}
          <Route path="thiet-bi" element={<ThietBiList />} />
          <Route
            path="thiet-bi/moi"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <FormThietBi />
              </CanDangNhap>
            }
          />
          <Route
            path="thiet-bi/in-nhan"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <InNhanQR />
              </CanDangNhap>
            }
          />
          <Route path="thiet-bi/:id" element={<ThietBiChiTiet />} />
          <Route
            path="thiet-bi/:id/sua"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <FormThietBi />
              </CanDangNhap>
            }
          />

          {/* Yêu cầu — mọi vai trò tạo được; duyệt và xuất/nhập kho có chốt riêng */}
          <Route path="yeu-cau" element={<YeuCauList />} />
          <Route path="yeu-cau/moi" element={<FormYeuCau />} />
          <Route path="yeu-cau/:id" element={<YeuCauChiTiet />} />
          <Route
            path="kho/xuat/:id"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <ManHinhKho che_do="xuat" />
              </CanDangNhap>
            }
          />
          <Route
            path="kho/nhap/:id"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <ManHinhKho che_do="nhap" />
              </CanDangNhap>
            }
          />

          <Route path="dia-diem" element={<DiaDiemList />} />
          <Route
            path="danh-muc"
            element={
              <CanDangNhap vaiTro={VAI_TRO_QUAN_LY}>
                <DanhMucHome />
              </CanDangNhap>
            }
          />
          <Route
            path="nhap-lieu"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <NhapLieuHangLoat />
              </CanDangNhap>
            }
          />
          <Route
            path="nhat-ky"
            element={
              <CanDangNhap vaiTro={VAI_TRO_QUAN_LY}>
                <NhatKyHome />
              </CanDangNhap>
            }
          />
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
    </Suspense>
  );
}
