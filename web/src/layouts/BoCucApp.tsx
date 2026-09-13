import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Boxes,
  ClipboardList,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Package,
  ScrollText,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { NHAN_VAI_TRO } from '@ltl/taisan-shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const MENU: readonly MucMenu[] = [
  { duongDan: '/', nhan: 'Tổng quan', icon: Boxes },
  { duongDan: '/thiet-bi', nhan: 'Thiết bị', icon: Package },
  { duongDan: '/yeu-cau', nhan: 'Yêu cầu', icon: ClipboardList },
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

  const mucHienThi = MENU.filter(
    (m) => !m.vaiTro || (nguoiDung && m.vaiTro.includes(nguoiDung.role)),
  );

  async function thoat(): Promise<void> {
    await dangXuat();
    dieuHuong('/dang-nhap', { replace: true });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-16 items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="nen-xanh-chuyen grid size-10 place-items-center rounded-lg text-primary-foreground">
              <Boxes aria-hidden />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold leading-tight">Quản lý Tài sản</span>
              <span className="block text-xs text-muted-foreground">Learn to Leap</span>
            </span>
          </Link>

          <nav
            className="ml-2 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Điều hướng chính"
          >
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
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {nguoiDung ? (
              <div className="hidden text-right sm:block">
                <p className="whitespace-nowrap text-sm font-medium leading-tight">
                  {nguoiDung.fullName}
                </p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">
                  {NHAN_VAI_TRO[nguoiDung.role]}
                  {nguoiDung.tenDiaDiem ? ` · ${nguoiDung.tenDiaDiem}` : ''}
                </p>
              </div>
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
            {mucHienThi.map((m) => (
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
