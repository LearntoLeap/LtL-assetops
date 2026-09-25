import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, MapPin, Pencil, Plus, RefreshCw, Trash2, Undo2, X } from 'lucide-react';
import { DS_LOAI_DIEM_LUU_TRU, NHAN_LOAI_DIEM_LUU_TRU, type LoaiDiemLuuTru } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { taiTep } from '@/lib/tep';
import type { DiaDiem, TrangDuLieu } from '@/lib/kieu';

interface Bieu {
  code: string;
  name: string;
  type: LoaiDiemLuuTru;
  address: string;
  contactName: string;
  contactPhone: string;
  note: string;
}

const BIEU_RONG: Bieu = {
  code: '',
  name: '',
  type: 'DIEM_TRUONG',
  address: '',
  contactName: '',
  contactPhone: '',
  note: '',
};

export function DiaDiemList() {
  const { nguoiDung } = useAuth();
  const duocSua = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  const laAdmin = nguoiDung?.role === 'ADMIN';

  const [muc, datMuc] = useState<DiaDiem[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [hienForm, datHienForm] = useState(false);
  const [dangSuaId, datDangSuaId] = useState<string | null>(null);
  const [bieu, datBieu] = useState<Bieu>(BIEU_RONG);
  const [dangGui, datDangGui] = useState(false);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const kq = await goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=false');
      datMuc(kq.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách điểm.');
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  function moTao(): void {
    datBieu(BIEU_RONG);
    datDangSuaId(null);
    datHienForm(true);
    datLoi(null);
  }

  function moSua(d: DiaDiem): void {
    datBieu({
      code: d.code,
      name: d.name,
      type: d.type,
      address: d.address ?? '',
      contactName: d.contactName ?? '',
      contactPhone: d.contactPhone ?? '',
      note: d.note ?? '',
    });
    datDangSuaId(d.id);
    datHienForm(true);
    datLoi(null);
  }

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datDangGui(true);
    try {
      const than = {
        name: bieu.name,
        type: bieu.type,
        address: bieu.address,
        contactName: bieu.contactName,
        contactPhone: bieu.contactPhone,
        note: bieu.note,
      };
      if (dangSuaId) {
        await goiApi(`/api/dia-diem/${dangSuaId}`, { method: 'PATCH', than });
        datThongBao('Đã lưu thay đổi.');
      } else {
        await goiApi('/api/dia-diem', { method: 'POST', than: { code: bieu.code, ...than } });
        datThongBao('Đã thêm điểm lưu trữ.');
      }
      datHienForm(false);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Lưu thất bại.');
    } finally {
      datDangGui(false);
    }
  }

  async function xoa(d: DiaDiem): Promise<void> {
    // Lời xác nhận phải nói đúng việc sắp xảy ra: đây là chuyển vào thùng rác,
    // KHÔNG phải xoá hẳn. Ghi "Xoá hẳn" như trước là nói sai.
    if (
      !window.confirm(
        `Chuyển điểm ${d.name} vào thùng rác?\n\n` +
          'Điểm sẽ biến khỏi mọi danh sách và mọi ô chọn nơi đến. Thiết bị đang ở ' +
          'đây cùng toàn bộ lịch sử xuất–nhập kho vẫn nguyên, và khôi phục lại ' +
          'được ở Điểm lưu trữ → Thùng rác.',
      )
    ) {
      return;
    }
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; thongDiep: string }>(`/api/dia-diem/${d.id}`, {
        method: 'DELETE',
      });
      // Dùng nguyên thông điệp của server: nó kể luôn lúc xoá điểm còn giữ những
      // gì ("21 thiết bị đang ở đây, 51 lượt xuất–nhập kho đã ghi").
      datThongBao(kq.thongDiep);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá thất bại.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Điểm lưu trữ</h1>
          <p className="text-sm text-muted-foreground">
            Kho, điểm trường, đối tác mượn và kho sự kiện.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void taiTep('/api/nhap-xuat/xuat/dia-diem', 'dia-diem.xlsx').catch((e: unknown) =>
                datLoi(e instanceof LoiApi ? e.message : 'Xuất Excel thất bại.'),
              )
            }
          >
            <Download aria-hidden />
            Xuất Excel
          </Button>
          {laAdmin ? (
            <Button variant="outline" asChild>
              <Link to="/dia-diem/thung-rac">
                <Undo2 aria-hidden />
                Thùng rác
              </Link>
            </Button>
          ) : null}
          {duocSua ? (
            <Button onClick={moTao}>
              <Plus aria-hidden />
              Thêm điểm
            </Button>
          ) : null}
        </div>
      </div>

      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}
      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {hienForm ? (
        <Card className="animate-hien-len">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{dangSuaId ? `Sửa: ${bieu.name}` : 'Thêm điểm lưu trữ'}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => datHienForm(false)}
              aria-label="Đóng"
            >
              <X aria-hidden />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={(su) => void gui(su)} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-ma">Mã điểm *</Label>
                <Input
                  id="d-ma"
                  required
                  disabled={dangSuaId !== null}
                  className="font-mono"
                  value={bieu.code}
                  onChange={(su) => datBieu((b) => ({ ...b, code: su.target.value }))}
                  placeholder="TRUONG-MINHKHAI"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-ten">Tên điểm *</Label>
                <Input
                  id="d-ten"
                  required
                  minLength={2}
                  value={bieu.name}
                  onChange={(su) => datBieu((b) => ({ ...b, name: su.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-loai">Loại điểm *</Label>
                <Select
                  id="d-loai"
                  required
                  value={bieu.type}
                  onChange={(su) =>
                    datBieu((b) => ({ ...b, type: su.target.value as LoaiDiemLuuTru }))
                  }
                >
                  {DS_LOAI_DIEM_LUU_TRU.map((l) => (
                    <option key={l.ma} value={l.ma}>
                      {l.nhan}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-dc">Địa chỉ</Label>
                <Input
                  id="d-dc"
                  value={bieu.address}
                  onChange={(su) => datBieu((b) => ({ ...b, address: su.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-nguoi">Người phụ trách</Label>
                <Input
                  id="d-nguoi"
                  value={bieu.contactName}
                  onChange={(su) => datBieu((b) => ({ ...b, contactName: su.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-sdt">Số điện thoại</Label>
                <Input
                  id="d-sdt"
                  value={bieu.contactPhone}
                  onChange={(su) => datBieu((b) => ({ ...b, contactPhone: su.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="d-ghi">Ghi chú</Label>
                <Input
                  id="d-ghi"
                  value={bieu.note}
                  onChange={(su) => datBieu((b) => ({ ...b, note: su.target.value }))}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={dangGui}>
                  {dangSuaId ? 'Lưu thay đổi' : 'Thêm điểm'}
                </Button>
                <Button type="button" variant="outline" onClick={() => datHienForm(false)}>
                  Huỷ
                </Button>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Toạ độ GPS và bán kính của kho cấu hình ở trang{' '}
                <strong>Khoá vị trí kho</strong> (chỉ quản trị viên).
              </p>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Danh sách ({muc.length})</CardTitle>
            <CardDescription>Gồm cả điểm đã ngừng dùng.</CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
            <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
          </Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã / Tên</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead>Người phụ trách</TableHead>
                <TableHead>GPS</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {muc.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <p className="font-mono text-sm">{d.code}</p>
                    <p className="text-xs text-muted-foreground">{d.name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{NHAN_LOAI_DIEM_LUU_TRU[d.type]}</Badge>
                    {!d.isActive ? (
                      <Badge variant="warning" className="ml-1">
                        Ngừng dùng
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.address ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.contactName ?? '—'}
                    {d.contactPhone ? (
                      <span className="block text-xs">{d.contactPhone}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {d.latitude === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge variant="success" className="gap-1">
                        <MapPin className="size-3" aria-hidden />
                        {d.gpsRadiusM ?? 150}m
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {duocSua ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moSua(d)}
                          aria-label={`Sửa ${d.name}`}
                          title="Sửa"
                        >
                          <Pencil aria-hidden />
                        </Button>
                      ) : null}
                      {laAdmin ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive-dam hover:bg-destructive/10"
                          onClick={() => void xoa(d)}
                          aria-label={`Xoá ${d.name}`}
                          title="Xoá"
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
        </CardContent>
      </Card>
    </div>
  );
}
