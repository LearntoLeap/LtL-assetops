import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Gauge,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Package,
  ScrollText,
  ShieldCheck,
  Tablet,
  TriangleAlert,
  History,
  Monitor,
  Upload,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { NHAN_VAI_TRO } from '@ltl/taisan-shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DauHieuAssetOps } from '@/components/DauHieuAssetOps';
import { NutDoiGiaoDien } from '@/components/NutDoiGiaoDien';
import { cn } from '@/lib/utils';
import { useAuth, VAI_TRO_NHAP_LIEU, VAI_TRO_QUAN_LY } from '@/lib/auth';

interface MucMenu {
  duongDan: string;
  nhan: string;
  icon: typeof Boxes;
  /** Vai trò thấy được mục này; bỏ trống = mọi vai trò. Server vẫn kiểm lại. */
  vaiTro?: readonly string[];
}

/** Việc làm hằng ngày — nằm thẳng trên thanh điều hướng. */
const MENU: readonly MucMenu[] = [
  { duongDan: '/', nhan: 'Tổng quan', icon: Boxes },
  { duongDan: '/thiet-bi', nhan: 'Thiết bị', icon: Package },
  { duongDan: '/yeu-cau', nhan: 'Yêu cầu', icon: ClipboardList },
  { duongDan: '/bbbg', nhan: 'Biên bản', icon: FileSignature },
  { duongDan: '/bao-hong', nhan: 'Báo hỏng', icon: TriangleAlert },
  { duongDan: '/kiem-ke', nhan: 'Kiểm kê', icon: ClipboardCheck, vaiTro: VAI_TRO_NHAP_LIEU },
  { duongDan: '/tablet-kho', nhan: 'Cố định tại kho', icon: Tablet, vaiTro: VAI_TRO_NHAP_LIEU },
];

/**
 * Việc thiết lập, thỉnh thoảng mới dùng — gom vào nút "Thêm".
 *
 * Đủ chức năng cho cả sáu giai đoạn thì thanh ngang không còn chỗ: quản trị có
 * tới mười bốn mục, mục cuối bị đẩy khuất mà không có dấu hiệu gì báo là cuộn
 * được. Tách làm hai nhóm vẫn giữ nguyên đường dẫn và quyền của từng mục.
 */
const MENU_THEM: readonly MucMenu[] = [
  // Dashboard tổng thể: cũng KHÔNG đưa lên thanh chính vì lý do y như "Lấy linh
  // kiện" bên dưới — thanh đã đủ bảy mục. Đường vào chính là nút "Xem tổng thể"
  // ngay đầu trang Tổng quan, chỗ ai cũng đi qua sau khi đăng nhập.
  { duongDan: '/tong-the', nhan: 'Tổng thể', icon: Gauge },
  // Đặt đầu nhóm vì dùng nhiều nhất trong đây. KHÔNG đưa lên thanh chính: thêm
  // mục thứ 8 vào thanh làm mục cuối bị cắt còn trơ biểu tượng không nhãn —
  // đã thấy trong ảnh chụp ở 1280px. Đường vào chính của việc này là ô lớn
  // "Lấy linh kiện" trên màn hình kho và liên kết từ phiếu báo hỏng.
  { duongDan: '/linh-kien', nhan: 'Lấy linh kiện', icon: Wrench, vaiTro: ['ADMIN', 'VAN_HANH', 'KHO'] },
  { duongDan: '/lich-su-sua-chua', nhan: 'Lịch sử sửa chữa', icon: History },
  { duongDan: '/dia-diem', nhan: 'Điểm lưu trữ', icon: MapPin },
  { duongDan: '/danh-muc', nhan: 'Danh mục', icon: LayoutGrid, vaiTro: VAI_TRO_QUAN_LY },
  { duongDan: '/nhap-lieu', nhan: 'Nhập hàng loạt', icon: Upload, vaiTro: VAI_TRO_NHAP_LIEU },
  { duongDan: '/nhat-ky', nhan: 'Nhật ký', icon: ScrollText, vaiTro: VAI_TRO_QUAN_LY },
  { duongDan: '/nguoi-dung', nhan: 'Tài khoản', icon: Users, vaiTro: VAI_TRO_QUAN_LY },
  { duongDan: '/khoa-vi-tri', nhan: 'Khoá vị trí kho', icon: MapPin, vaiTro: ['ADMIN'] },
  { duongDan: '/doi-mat-khau', nhan: 'Đổi mật khẩu', icon: ShieldCheck },
];

export function BoCucApp() {
  const { nguoiDung, dangXuat } = useAuth();
  const dieuHuong = useNavigate();
  const [moMenu, datMoMenu] = useState(false);
  const [moThem, datMoThem] = useState(false);
  const oThem = useRef<HTMLDivElement>(null);

  /*
   * Đóng bảng "Thêm" khi bấm ra ngoài hoặc bấm Esc.
   *
   * Việc này từng do một nút phủ `fixed inset-0` lo. Nhưng <header> có
   * `backdrop-blur`, và backdrop-filter biến header thành khối chứa cho con
   * `position: fixed` — nên `inset-0` chỉ phủ đúng dải header cao 64px thay vì
   * cả màn hình. Hậu quả: bấm vào giữa trang thì bảng không đóng, còn lớp phủ
   * lại nằm đè lên chính nút "Thêm" và các mục điều hướng bên cạnh.
   */
  useEffect(() => {
    if (!moThem) return;
    const bamNgoai = (e: PointerEvent): void => {
      if (!oThem.current?.contains(e.target as Node)) datMoThem(false);
    };
    const bamEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') datMoThem(false);
    };
    document.addEventListener('pointerdown', bamNgoai);
    document.addEventListener('keydown', bamEsc);
    return () => {
      document.removeEventListener('pointerdown', bamNgoai);
      document.removeEventListener('keydown', bamEsc);
    };
  }, [moThem]);

  // Tài khoản kho: mọi đường "về" đều dẫn về MÀN HÌNH KHO, không phải Tổng
  // quan. Máy ở kho đặt cố định, người dùng nó cả ngày chỉ cần màn hình đó.
  const laKho = nguoiDung?.role === 'KHO';
  const duongVe = laKho ? '/kiosk' : '/';

  const hopVaiTro = (m: MucMenu): boolean =>
    !m.vaiTro || Boolean(nguoiDung && m.vaiTro.includes(nguoiDung.role));
  const mucHienThi = MENU.filter(hopVaiTro);
  const mucThem = MENU_THEM.filter(hopVaiTro);

  async function thoat(): Promise<void> {
    await dangXuat();
    dieuHuong('/dang-nhap', { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-16 items-center gap-3">
          <Link to={duongVe} className="flex items-center gap-3">
            <DauHieuAssetOps canh={40} className="shrink-0 rounded-[9px]" />
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold leading-tight">
                Asset<span className="text-primary">Ops</span>
              </span>
              <span className="block text-xs text-muted-foreground">Learn to Leap</span>
            </span>
          </Link>

          {/*
            overflow-x-auto phải nằm ở div CON, không được đặt ở <nav>. Đặt ở
            <nav> thì <nav> thành vùng cắt (CSS: một trục auto là trục kia thôi
            visible), nên bảng "Thêm" — định vị absolute, nằm BÊN DƯỚI thanh —
            bị cắt sạch: nút vẫn đổi trạng thái mà không ai thấy gì hiện ra.
            Đã kiểm bằng trình duyệt thật ở 1024→1920px: elementFromPoint tại
            giữa mục "Tài khoản" trả về thẻ thống kê của trang phía sau, tức
            bảng không được vẽ ra nên cú bấm rơi thẳng xuống nội dung bên dưới.
            Để nút "Thêm" ngoài vùng cuộn cũng giữ được nó trong khung ở 1024px.
          */}
          <nav
            className="ml-2 hidden min-w-0 flex-1 items-center gap-1 lg:flex"
            aria-label="Điều hướng chính"
          >
            {/*
              mask-image làm mép phải mờ dần. Khi thanh chật, mục cuối bị cắt
              giữa chữ trông như lỗi hiển thị — đã thấy "Cố định tại k" trong
              ảnh chụp ở 1280px. Mờ dần thì cú cắt đó đọc thành "còn nữa, cuộn
              tiếp". Không fade oan khi thanh rộng: chỗ mờ rơi vào vùng trống.
            */}
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [mask-image:linear-gradient(to_right,black_0,black_calc(100%-1.75rem),transparent_100%)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mucHienThi.map((m) => (
                <NavLink
                  key={m.duongDan}
                  to={m.duongDan}
                  end={m.duongDan === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )
                  }
                >
                  <m.icon className="size-4" aria-hidden />
                  {m.nhan}
                </NavLink>
              ))}
            </div>

            {mucThem.length > 0 ? (
              <div ref={oThem} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => datMoThem((t) => !t)}
                  aria-expanded={moThem}
                  aria-haspopup="true"
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    moThem
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                  Thêm
                </button>
                {moThem ? (
                  <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border bg-popover p-1 shadow-lg">
                    {mucThem.map((m) => (
                      <NavLink
                        key={m.duongDan}
                        to={m.duongDan}
                        onClick={() => datMoThem(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                          )
                        }
                      >
                        <m.icon className="size-4" aria-hidden />
                        {m.nhan}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {nguoiDung ? (
              // Chặn bề rộng: tên điểm trường dài (vd "Kho văn phòng Learn to
              // Leap") từng đẩy nút "Thêm" ở cuối thanh điều hướng ra khỏi màn.
              <div className="hidden max-w-[13rem] text-right sm:block">
                <p className="truncate text-sm font-medium leading-tight" title={nguoiDung.fullName}>
                  {nguoiDung.fullName}
                </p>
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={`${NHAN_VAI_TRO[nguoiDung.role]}${nguoiDung.tenDiaDiem ? ` · ${nguoiDung.tenDiaDiem}` : ''}`}
                >
                  {NHAN_VAI_TRO[nguoiDung.role]}
                  {nguoiDung.tenDiaDiem ? ` · ${nguoiDung.tenDiaDiem}` : ''}
                </p>
              </div>
            ) : null}
            {laKho ? (
              <Button variant="accent" size="icon" asChild title="Về màn hình kho">
                <Link to="/kiosk" aria-label="Về màn hình kho">
                  <Monitor aria-hidden />
                </Link>
              </Button>
            ) : null}
            <NutDoiGiaoDien />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void thoat()}
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <LogOut aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => datMoMenu((m) => !m)}
              aria-label={moMenu ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={moMenu}
            >
              {moMenu ? <X aria-hidden /> : <Menu aria-hidden />}
            </Button>
          </div>
        </div>

        <nav
          className={cn('container pb-3 lg:hidden', moMenu ? 'block' : 'hidden')}
          aria-label="Điều hướng (màn hình nhỏ)"
        >
          <div className="flex flex-col gap-1">
            {laKho ? (
              <Link
                to="/kiosk"
                onClick={() => datMoMenu(false)}
                className="flex min-h-cham items-center gap-2 rounded-md bg-primary/10 px-3 text-sm font-semibold text-primary"
              >
                <Monitor className="size-4" aria-hidden />
                Về màn hình kho
              </Link>
            ) : null}
            {[...mucHienThi, ...mucThem].map((m) => (
              <NavLink
                key={m.duongDan}
                to={m.duongDan}
                end={m.duongDan === '/'}
                onClick={() => datMoMenu(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-cham items-center gap-2 rounded-md px-3 text-sm font-medium',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )
                }
              >
                <m.icon className="size-4" aria-hidden />
                {m.nhan}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {nguoiDung?.mustChangePassword ? (
        <div className="border-b border-warning/40 bg-warning/10">
          <p className="container py-2 text-sm">
            <Badge variant="warning" className="mr-2">
              Cần xử lý
            </Badge>
            Bạn phải đổi mật khẩu trước khi dùng các chức năng khác.{' '}
            <Link to="/doi-mat-khau" className="font-medium text-primary underline">
              Đổi ngay
            </Link>
          </p>
        </div>
      ) : null}

      <main className="container py-6">
        <Outlet />
      </main>

      <footer className="border-t py-5">
        <p className="container text-xs text-muted-foreground">
          Learn to Leap — Hệ thống quản lý tài sản nội bộ. Mọi kiểm tra quyền được thực hiện ở
          máy chủ.
        </p>
      </footer>
    </div>
  );
}
