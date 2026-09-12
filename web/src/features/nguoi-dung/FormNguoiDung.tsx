import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { DS_VAI_TRO, NHAN_LOAI_DIEM_LUU_TRU, type VaiTro } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { goiApi, LoiApi } from '@/lib/api';
import type { DiaDiem, HoSoQuanTri } from '@/lib/kieu';

/** Vai trò buộc phải gán điểm lưu trữ — server kiểm lại lần nữa. */
const LOAI_DIEM_THEO_VAI_TRO: Partial<Record<VaiTro, readonly DiaDiem['type'][]>> = {
  KHO: ['KHO_VAN_PHONG', 'KHO_SU_KIEN'],
  TRUONG: ['DIEM_TRUONG'],
};

export interface FormNguoiDungProps {
  /** Có giá trị = đang sửa; không có = đang tạo mới. */
  dangSua: HoSoQuanTri | null;
  diaDiem: readonly DiaDiem[];
  /** ADMIN mới được tạo tài khoản mới. */
  duocTao: boolean;
  onXong: () => void;
  onHuy: () => void;
}

export function FormNguoiDung({ dangSua, diaDiem, duocTao, onXong, onHuy }: FormNguoiDungProps) {
  const [email, datEmail] = useState('');
  const [matKhau, datMatKhau] = useState('');
  const [fullName, datFullName] = useState('');
  const [role, datRole] = useState<VaiTro>('NHAN_SU');
  const [phone, datPhone] = useState('');
  const [department, datDepartment] = useState('');
  const [locationId, datLocationId] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);

  useEffect(() => {
    datLoi(null);
    if (dangSua) {
      datEmail(dangSua.email);
      datFullName(dangSua.fullName);
      datRole(dangSua.role);
      datPhone(dangSua.phone ?? '');
      datDepartment(dangSua.department ?? '');
      datLocationId(dangSua.locationId ?? '');
    } else {
      datEmail('');
      datMatKhau('');
      datFullName('');
      datRole('NHAN_SU');
      datPhone('');
      datDepartment('');
      datLocationId('');
    }
  }, [dangSua]);

  const loaiCanChon = LOAI_DIEM_THEO_VAI_TRO[role];
  const diemChonDuoc = useMemo(
    () => (loaiCanChon ? diaDiem.filter((d) => loaiCanChon.includes(d.type)) : diaDiem),
    [diaDiem, loaiCanChon],
  );

  // Đổi vai trò làm điểm đang chọn không còn hợp lệ thì bỏ chọn.
  useEffect(() => {
    if (locationId && !diemChonDuoc.some((d) => d.id === locationId)) datLocationId('');
  }, [diemChonDuoc, locationId]);

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datDangGui(true);
    try {
      if (dangSua) {
        await goiApi(`/api/nguoi-dung/${dangSua.id}`, {
          method: 'PATCH',
          than: { fullName, role, phone, department, locationId },
        });
      } else {
        await goiApi('/api/nguoi-dung', {
          method: 'POST',
          than: {
            email,
            matKhau,
            fullName,
            role,
            ...(phone.trim() ? { phone } : {}),
            ...(department.trim() ? { department } : {}),
            ...(locationId ? { locationId } : {}),
          },
        });
      }
      onXong();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Có lỗi không xác định.');
    } finally {
      datDangGui(false);
    }
  }

  if (!dangSua && !duocTao) {
    return (
      <Alert variant="warning" tieuDe="Không đủ quyền">
        Chỉ vai trò Quản trị hệ thống được tạo tài khoản mới.
      </Alert>
    );
  }

  return (
    <Card className="animate-hien-len">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{dangSua ? `Sửa: ${dangSua.fullName}` : 'Tạo tài khoản mới'}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onHuy} aria-label="Đóng">
          <X aria-hidden />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={(su) => void gui(su)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="f-email">Email</Label>
            <Input
              id="f-email"
              type="email"
              required
              value={email}
              disabled={dangSua !== null}
              onChange={(su) => datEmail(su.target.value)}
              placeholder="ten@learntoleap.vn"
            />
            {dangSua ? (
              <p className="text-xs text-muted-foreground">Email không đổi được sau khi tạo.</p>
            ) : null}
          </div>

          {dangSua ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="f-mk">Mật khẩu khởi tạo</Label>
              <Input
                id="f-mk"
                type="text"
                required
                minLength={8}
                value={matKhau}
                onChange={(su) => datMatKhau(su.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Tối thiểu 8 ký tự, có cả chữ và số. Người dùng phải đổi ở lần đăng nhập đầu.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="f-ten">Họ và tên</Label>
            <Input
              id="f-ten"
              required
              minLength={2}
              value={fullName}
              onChange={(su) => datFullName(su.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-vai-tro">Vai trò</Label>
            <Select
              id="f-vai-tro"
              value={role}
              onChange={(su) => datRole(su.target.value as VaiTro)}
            >
              {DS_VAI_TRO.map((v) => (
                <option key={v.ma} value={v.ma}>
                  {v.nhan}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-sdt">Số điện thoại</Label>
            <Input id="f-sdt" value={phone} onChange={(su) => datPhone(su.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-phong">Phòng ban / đơn vị</Label>
            <Input
              id="f-phong"
              value={department}
              onChange={(su) => datDepartment(su.target.value)}
              placeholder="Chuyên môn, Event, Kinh doanh…"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="f-diem">
              {role === 'KHO'
                ? 'Kho phụ trách (bắt buộc)'
                : role === 'TRUONG'
                  ? 'Điểm trường phụ trách (bắt buộc)'
                  : 'Điểm lưu trữ gắn với tài khoản (không bắt buộc)'}
            </Label>
            <Select
              id="f-diem"
              required={loaiCanChon !== undefined}
              value={locationId}
              onChange={(su) => datLocationId(su.target.value)}
            >
              <option value="">— Không gán —</option>
              {diemChonDuoc.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({NHAN_LOAI_DIEM_LUU_TRU[d.type]})
                </option>
              ))}
            </Select>
            {role === 'KHO' ? (
              <p className="text-xs text-muted-foreground">
                Tài khoản kho chỉ đăng nhập được khi ở trong bán kính GPS của kho này.
              </p>
            ) : null}
            {role === 'TRUONG' ? (
              <p className="text-xs text-muted-foreground">
                Tài khoản trường chỉ xem được thiết bị của đúng điểm trường này.
              </p>
            ) : null}
          </div>

          {loi ? (
            <div className="sm:col-span-2">
              <Alert variant="destructive">{loi}</Alert>
            </div>
          ) : null}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={dangGui}>
              {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              {dangSua ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
            <Button type="button" variant="outline" onClick={onHuy}>
              Huỷ
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
