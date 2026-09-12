import { useCallback, useEffect, useState } from 'react';
import {
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { DS_VAI_TRO, NHAN_VAI_TRO, type VaiTro } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ngayGio } from '@/lib/dinh-dang';
import type { DiaDiem, HoSoQuanTri, TrangDuLieu } from '@/lib/kieu';
import { FormNguoiDung } from './FormNguoiDung';

type MauBadge = NonNullable<BadgeProps['variant']>;

const MAU_VAI_TRO: Record<VaiTro, MauBadge> = {
  ADMIN: 'destructive',
  VAN_HANH: 'default',
  KHO: 'accent',
  NHAN_SU: 'muted',
  TRUONG: 'success',
};

export function QuanLyNguoiDung() {
  const { nguoiDung: toi } = useAuth();
  const laAdmin = toi?.role === 'ADMIN';

  const [danhSach, datDanhSach] = useState<HoSoQuanTri[]>([]);
  const [diaDiem, datDiaDiem] = useState<DiaDiem[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);

  const [tuKhoa, datTuKhoa] = useState('');
  const [locVaiTro, datLocVaiTro] = useState('');
  const [hienForm, datHienForm] = useState(false);
  const [dangSua, datDangSua] = useState<HoSoQuanTri | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const thamSo = new URLSearchParams({ moiTrang: '200' });
      if (tuKhoa.trim()) thamSo.set('tuKhoa', tuKhoa.trim());
      if (locVaiTro) thamSo.set('role', locVaiTro);
      const kq = await goiApi<TrangDuLieu<HoSoQuanTri>>(`/api/nguoi-dung?${thamSo.toString()}`);
      datDanhSach(kq.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách tài khoản.');
    } finally {
      datDangTai(false);
    }
  }, [tuKhoa, locVaiTro]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useEffect(() => {
    async function taiDiaDiem(): Promise<void> {
      try {
        const kq = await goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true');
        datDiaDiem(kq.muc);
      } catch {
        // Không tải được danh mục điểm thì form vẫn mở được, chỉ thiếu lựa chọn.
      }
    }
    void taiDiaDiem();
  }, []);

  async function hanhDong(viec: () => Promise<string>): Promise<void> {
    datLoi(null);
    datThongBao(null);
    try {
      datThongBao(await viec());
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thao tác thất bại.');
    }
  }

  const doiKhoa = (u: HoSoQuanTri) =>
    hanhDong(async () => {
      await goiApi(`/api/nguoi-dung/${u.id}/khoa`, {
        method: 'POST',
        than: { isLocked: !u.isLocked },
      });
      return u.isLocked ? `Đã mở khoá ${u.fullName}.` : `Đã khoá ${u.fullName}.`;
    });

  const datLaiMatKhau = (u: HoSoQuanTri) => {
    const moi = window.prompt(
      `Mật khẩu mới cho ${u.fullName} (tối thiểu 8 ký tự, có cả chữ và số).\n` +
        'Người dùng sẽ buộc phải đổi lại ở lần đăng nhập tới.',
    );
    if (!moi) return;
    return hanhDong(async () => {
      await goiApi(`/api/nguoi-dung/${u.id}/dat-lai-mat-khau`, {
        method: 'POST',
        than: { matKhauMoi: moi },
      });
      return `Đã đặt lại mật khẩu cho ${u.fullName}. Mọi phiên đăng nhập của họ đã bị thu hồi.`;
    });
  };

  const xoa = (u: HoSoQuanTri) => {
    if (!window.confirm(`Xoá hẳn tài khoản ${u.fullName} (${u.email})?`)) return;
    return hanhDong(async () => {
      await goiApi(`/api/nguoi-dung/${u.id}`, { method: 'DELETE' });
      return `Đã xoá tài khoản ${u.fullName}.`;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Quản lý tài khoản</h1>
          <p className="text-sm text-muted-foreground">
            Tài khoản chỉ được tạo tại đây. Hệ thống không có đăng ký công khai.
          </p>
        </div>
        {laAdmin ? (
          <Button
            onClick={() => {
              datDangSua(null);
              datHienForm(true);
            }}
          >
            <UserPlus aria-hidden />
            Tạo tài khoản
          </Button>
        ) : (
          <Badge variant="muted">Vai trò Vận hành không tạo/xoá được tài khoản</Badge>
        )}
      </div>

      {hienForm ? (
        <FormNguoiDung
          dangSua={dangSua}
          diaDiem={diaDiem}
          duocTao={laAdmin}
          onXong={() => {
            datHienForm(false);
            datDangSua(null);
            datThongBao(dangSua ? 'Đã lưu thay đổi.' : 'Đã tạo tài khoản mới.');
            void tai();
          }}
          onHuy={() => {
            datHienForm(false);
            datDangSua(null);
          }}
        />
      ) : null}

      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}
      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({danhSach.length})</CardTitle>
          <CardDescription>Sắp theo vai trò rồi theo tên.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="relative min-w-52 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="pl-9"
                placeholder="Tìm theo email hoặc họ tên…"
                value={tuKhoa}
                onChange={(su) => datTuKhoa(su.target.value)}
                aria-label="Tìm tài khoản"
              />
            </div>
            <Select
              className="w-auto min-w-44"
              value={locVaiTro}
              onChange={(su) => datLocVaiTro(su.target.value)}
              aria-label="Lọc theo vai trò"
            >
              <option value="">Tất cả vai trò</option>
              {DS_VAI_TRO.map((v) => (
                <option key={v.ma} value={v.ma}>
                  {v.nhan}
                </option>
              ))}
            </Select>
            <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
              <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && danhSach.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : danhSach.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">
              Không có tài khoản nào khớp điều kiện.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên / Email</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Điểm phụ trách</TableHead>
                  <TableHead>Đăng nhập gần nhất</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {danhSach.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium">{u.fullName}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={MAU_VAI_TRO[u.role]}>{NHAN_VAI_TRO[u.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.department ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.location?.name ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {ngayGio(u.lastLoginAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.isLocked ? (
                          <Badge variant="destructive">Đã khoá</Badge>
                        ) : (
                          <Badge variant="success">Hoạt động</Badge>
                        )}
                        {u.mustChangePassword ? (
                          <Badge variant="warning">Phải đổi mật khẩu</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Sửa thông tin"
                          aria-label={`Sửa ${u.fullName}`}
                          onClick={() => {
                            datDangSua(u);
                            datHienForm(true);
                          }}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Đặt lại mật khẩu"
                          aria-label={`Đặt lại mật khẩu ${u.fullName}`}
                          onClick={() => void datLaiMatKhau(u)}
                        >
                          <KeyRound aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={u.isLocked ? 'Mở khoá' : 'Khoá tài khoản'}
                          aria-label={`${u.isLocked ? 'Mở khoá' : 'Khoá'} ${u.fullName}`}
                          onClick={() => void doiKhoa(u)}
                        >
                          {u.isLocked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
                        </Button>
                        {laAdmin ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Xoá tài khoản"
                            aria-label={`Xoá ${u.fullName}`}
                            className="text-destructive-dam hover:bg-destructive/10"
                            onClick={() => void xoa(u)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert variant="info" tieuDe="Xoá hay khoá?">
        Tài khoản đã phát sinh dữ liệu lịch sử (đã xuất/nhập kho, tạo yêu cầu, chụp ảnh…) sẽ
        <strong> không xoá được</strong> — lịch sử phải giữ được người thực hiện. Trường hợp đó
        hãy dùng <strong>Khoá tài khoản</strong>: mọi phiên đang mở bị thu hồi ngay.
      </Alert>
    </div>
  );
}
