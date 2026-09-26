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

/**
 * Trang mặc định theo vai trò.
 *
 * Tài khoản KHO về màn hình kho; các vai trò khác về Tổng quan. Đặt ở route
 * `index` thay vì rải điều kiện ở từng chỗ gọi: đăng nhập xong, bấm logo, hay
 * thoát khỏi một trang con đều rơi về "/", nên một chỗ này bao hết.
 */
function TrangMacDinh() {
  const { nguoiDung } = useAuth();
  if (nguoiDung?.role === 'KHO') return <Navigate to="/kiosk" replace />;
  return <TongQuan />;
}
const TongThe = lazy(() => import('@/features/tong-the/TongThe').then((m) => ({ default: m.TongThe })));
const ThuVienWiki = lazy(() => import('@/features/wiki/ThuVienWiki').then((m) => ({ default: m.ThuVienWiki })));
const BaiWiki = lazy(() => import('@/features/wiki/BaiWiki').then((m) => ({ default: m.BaiWiki })));
const SuaBaiWiki = lazy(() => import('@/features/wiki/SuaBaiWiki').then((m) => ({ default: m.SuaBaiWiki })));
const DoiMatKhau = lazy(() => import('@/features/auth/DoiMatKhau').then((m) => ({ default: m.DoiMatKhau })));
const ThietBiList = lazy(() => import('@/features/thiet-bi/ThietBiList').then((m) => ({ default: m.ThietBiList })));
const ThietBiChiTiet = lazy(() => import('@/features/thiet-bi/ThietBiChiTiet').then((m) => ({ default: m.ThietBiChiTiet })));
const ThungRacThietBi = lazy(() => import('@/features/thiet-bi/ThungRacThietBi').then((m) => ({ default: m.ThungRacThietBi })));
const FormThietBi = lazy(() => import('@/features/thiet-bi/FormThietBi').then((m) => ({ default: m.FormThietBi })));
const DiaDiemList = lazy(() => import('@/features/dia-diem/DiaDiemList').then((m) => ({ default: m.DiaDiemList })));
const ThungRacDiaDiem = lazy(() => import('@/features/dia-diem/ThungRacDiaDiem').then((m) => ({ default: m.ThungRacDiaDiem })));
const DanhMucHome = lazy(() => import('@/features/danh-muc/DanhMucHome').then((m) => ({ default: m.DanhMucHome })));
const NhapLieuHangLoat = lazy(() => import('@/features/nhap-xuat/NhapLieuHangLoat').then((m) => ({ default: m.NhapLieuHangLoat })));
const InNhanQR = lazy(() => import('@/features/qr/InNhanQR').then((m) => ({ default: m.InNhanQR })));
const QuanLyNguoiDung = lazy(() => import('@/features/nguoi-dung/QuanLyNguoiDung').then((m) => ({ default: m.QuanLyNguoiDung })));
const KhoaViTri = lazy(() => import('@/features/gps/KhoaViTri').then((m) => ({ default: m.KhoaViTri })));
const LayLinhKien = lazy(() =>
  import('@/features/linh-kien/LayLinhKien').then((m) => ({ default: m.LayLinhKien })),
);
const LichSuSuaChua = lazy(() =>
  import('@/features/lich-su/LichSuSuaChua').then((m) => ({ default: m.LichSuSuaChua })),
);
const YeuCauList = lazy(() => import('@/features/yeu-cau/YeuCauList').then((m) => ({ default: m.YeuCauList })));
const YeuCauChiTiet = lazy(() => import('@/features/yeu-cau/YeuCauChiTiet').then((m) => ({ default: m.YeuCauChiTiet })));
const FormYeuCau = lazy(() => import('@/features/yeu-cau/FormYeuCau').then((m) => ({ default: m.FormYeuCau })));
const ManHinhKho = lazy(() => import('@/features/kho/ManHinhKho').then((m) => ({ default: m.ManHinhKho })));
const NhatKyHome = lazy(() => import('@/features/nhat-ky/NhatKyHome').then((m) => ({ default: m.NhatKyHome })));
const BienBanList = lazy(() => import('@/features/bbbg/BienBanList').then((m) => ({ default: m.BienBanList })));
const BienBanChiTiet = lazy(() => import('@/features/bbbg/BienBanChiTiet').then((m) => ({ default: m.BienBanChiTiet })));
const FormBienBan = lazy(() => import('@/features/bbbg/FormBienBan').then((m) => ({ default: m.FormBienBan })));
const InBienBan = lazy(() => import('@/features/bbbg/InBienBan').then((m) => ({ default: m.InBienBan })));
const CaiDatChung = lazy(() => import('@/features/cai-dat/CaiDatChung').then((m) => ({ default: m.CaiDatChung })));
const ThungRacYeuCau = lazy(() => import('@/features/yeu-cau/ThungRacYeuCau').then((m) => ({ default: m.ThungRacYeuCau })));
const ThungRacBienBan = lazy(() => import('@/features/bbbg/ThungRacBienBan').then((m) => ({ default: m.ThungRacBienBan })));
const KiemKeList = lazy(() => import('@/features/kiem-ke/KiemKeList').then((m) => ({ default: m.KiemKeList })));
const KiemKeChiTiet = lazy(() => import('@/features/kiem-ke/KiemKeChiTiet').then((m) => ({ default: m.KiemKeChiTiet })));
const BaoHongList = lazy(() => import('@/features/bao-hong/BaoHongList').then((m) => ({ default: m.BaoHongList })));
const BaoHongChiTiet = lazy(() => import('@/features/bao-hong/BaoHongChiTiet').then((m) => ({ default: m.BaoHongChiTiet })));
const FormBaoHong = lazy(() => import('@/features/bao-hong/FormBaoHong').then((m) => ({ default: m.FormBaoHong })));
const ManHinhKiosk = lazy(() => import('@/features/kiosk/ManHinhKiosk').then((m) => ({ default: m.ManHinhKiosk })));
const TabletTaiKho = lazy(() => import('@/features/kiosk/TabletTaiKho').then((m) => ({ default: m.TabletTaiKho })));

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

        {/* Màn hình kho dùng hết màn hình, không có thanh menu chen ngang. */}
        <Route
          path="/kiosk"
          element={
            <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
              <ManHinhKiosk />
            </CanDangNhap>
          }
        />

        {/* Bản in A4 nằm ngoài bố cục ứng dụng để không in kèm header và menu. */}
        <Route
          path="/bbbg/:id/in"
          element={
            <CanDangNhap>
              <InBienBan />
            </CanDangNhap>
          }
        />

        <Route
          element={
            <CanDangNhap>
              <BoCucApp />
            </CanDangNhap>
          }
        >
          {/*
            Trang mặc định: tài khoản KHO về MÀN HÌNH KHO, không phải Tổng
            quan. Máy ở kho đặt cố định và người dùng nó cả ngày chỉ cần màn
            hình đó; bắt họ qua Tổng quan rồi tự tìm đường sang là thừa. Mọi
            đường dẫn "/" — đăng nhập xong, bấm logo, thoát khỏi trang con —
            đều rơi vào đây nên chỉ cần một chỗ này là đủ.
          */}
          <Route index element={<TrangMacDinh />} />
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
          {/*
            Thùng rác: chỉ ADMIN. Phải khai TRƯỚC "thiet-bi/:id" — React Router
            ưu tiên đường dẫn cụ thể hơn, nhưng để gần nhau cho dễ đọc.
          */}
          <Route
            path="thiet-bi/thung-rac"
            element={
              <CanDangNhap vaiTro={['ADMIN']}>
                <ThungRacThietBi />
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
          {/* Khai TRƯỚC "yeu-cau/:id" — để sau thì "thung-rac" bị khớp thành một
              mã yêu cầu và trang luôn báo không tìm thấy. */}
          <Route
            path="yeu-cau/thung-rac"
            element={
              <CanDangNhap vaiTro={['ADMIN']}>
                <ThungRacYeuCau />
              </CanDangNhap>
            }
          />
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

          {/* Biên bản bàn giao — bên nhận phải xác nhận thì vị trí mới đổi */}
          <Route path="bbbg" element={<BienBanList />} />
          <Route
            path="bbbg/moi"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <FormBienBan />
              </CanDangNhap>
            }
          />
          <Route
            path="bbbg/thung-rac"
            element={
              <CanDangNhap vaiTro={['ADMIN']}>
                <ThungRacBienBan />
              </CanDangNhap>
            }
          />
          <Route path="bbbg/:id" element={<BienBanChiTiet />} />

          {/* Cài đặt chung — xem được hết, sửa thì server chỉ cho ADMIN */}
          <Route path="cai-dat" element={<CaiDatChung />} />

          {/* Thiết bị cố định tại kho — màn hình riêng cho tablet đặt ở kho */}
          <Route
            path="tablet-kho"
            element={
              <CanDangNhap vaiTro={VAI_TRO_NHAP_LIEU}>
                <TabletTaiKho />
              </CanDangNhap>
            }
          />

          {/* Kiểm kê — mở đợt và chốt là việc của nhóm quản lý, server kiểm lại */}
          <Route path="kiem-ke" element={<KiemKeList />} />
          <Route path="kiem-ke/:id" element={<KiemKeChiTiet />} />

          {/* Báo hỏng — mọi vai trò báo được thiết bị trong phạm vi của mình */}
          <Route path="bao-hong" element={<BaoHongList />} />
          <Route path="bao-hong/moi" element={<FormBaoHong />} />
          <Route path="bao-hong/:id" element={<BaoHongChiTiet />} />

          {/*
            Lấy linh kiện: người ĐỨNG Ở KHO mới lấy được, nên giới hạn ba vai
            trò. Máy chủ kiểm lại bằng middleware — ẩn ở đây chỉ là phụ.
            Trang vẫn cho mọi vai trò XEM lịch sử qua /api/linh-kien, nhưng
            người không có quyền lấy thì không cần vào form này.
          */}
          <Route
            path="linh-kien"
            element={
              <CanDangNhap vaiTro={['ADMIN', 'VAN_HANH', 'KHO']}>
                <LayLinhKien />
              </CanDangNhap>
            }
          />

          {/*
            Lịch sử sửa chữa: KHÔNG giới hạn vai trò, vì điểm trường cũng cần
            xem lịch sử của trường mình. Máy chủ lọc theo phạm vi.
          */}
          <Route path="lich-su-sua-chua" element={<LichSuSuaChua />} />

          {/*
            Tổng thể: cũng không giới hạn vai trò — máy chủ lọc theo phạm vi nên
            điểm trường mở trang này chỉ thấy số của trường mình.
          */}
          <Route path="tong-the" element={<TongThe />} />

          {/*
            Thư viện wiki: ĐỌC không giới hạn vai trò — wiki là tri thức hướng
            dẫn, và trong đó không có thông tin giá nào để cần che. VIẾT thì
            giới hạn ba vai trò; máy chủ kiểm lại bằng middleware.
          */}
          <Route path="wiki" element={<ThuVienWiki />} />
          <Route
            path="wiki/moi"
            element={
              <CanDangNhap vaiTro={['ADMIN', 'VAN_HANH', 'KHO']}>
                <SuaBaiWiki />
              </CanDangNhap>
            }
          />
          <Route
            path="wiki/:slug/sua"
            element={
              <CanDangNhap vaiTro={['ADMIN', 'VAN_HANH', 'KHO']}>
                <SuaBaiWiki />
              </CanDangNhap>
            }
          />
          <Route path="wiki/:slug" element={<BaiWiki />} />

          {/* Thùng rác điểm lưu trữ: chỉ ADMIN. Khai TRƯỚC "dia-diem" cho dễ đọc. */}
          <Route
            path="dia-diem/thung-rac"
            element={
              <CanDangNhap vaiTro={['ADMIN']}>
                <ThungRacDiaDiem />
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
