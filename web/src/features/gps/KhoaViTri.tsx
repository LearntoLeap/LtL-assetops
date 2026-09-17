import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Crosshair,
  KeyRound,
  Loader2,
  MapPin,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { NHAN_LOAI_DIEM_LUU_TRU } from '@ltl/taisan-shared';
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
import { conLai, ngayGio } from '@/lib/dinh-dang';
import type { BanGhiMaVuotQuyen, DiaDiem, TrangDuLieu } from '@/lib/kieu';
import { layViTri, LoiViTri } from '@/lib/vi-tri';

const LOAI_KHO: readonly DiaDiem['type'][] = ['KHO_VAN_PHONG', 'KHO_SU_KIEN'];

export function KhoaViTri() {
  const [diaDiem, datDiaDiem] = useState<DiaDiem[]>([]);
  const [maVuotQuyen, datMaVuotQuyen] = useState<BanGhiMaVuotQuyen[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [maMoi, datMaMoi] = useState<string | null>(null);

  const [chonDiem, datChonDiem] = useState('');
  const [vi, datVi] = useState('');
  const [kinh, datKinh] = useState('');
  const [banKinh, datBanKinh] = useState('150');
  const [batKhoa, datBatKhoa] = useState(true);
  const [dangLuu, datDangLuu] = useState(false);

  const [capChoKho, datCapChoKho] = useState('');
  const [lyDoCap, datLyDoCap] = useState('');
  const [hieuLucPhut, datHieuLucPhut] = useState('60');

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const [dsDiem, dsMa] = await Promise.all([
        goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=false'),
        goiApi<TrangDuLieu<BanGhiMaVuotQuyen>>('/api/vuot-quyen-gps?trangThai=tat_ca'),
      ]);
      datDiaDiem(dsDiem.muc);
      datMaVuotQuyen(dsMa.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được dữ liệu.');
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  const danhSachKho = diaDiem.filter((d) => LOAI_KHO.includes(d.type));

  function chonDeSua(d: DiaDiem): void {
    datChonDiem(d.id);
    datVi(d.latitude === null ? '' : String(d.latitude));
    datKinh(d.longitude === null ? '' : String(d.longitude));
    datBanKinh(d.gpsRadiusM === null ? '150' : String(d.gpsRadiusM));
    datBatKhoa(d.gpsRequired);
    datThongBao(null);
    datLoi(null);
  }

  async function layViTriHienTai(): Promise<void> {
    datLoi(null);
    try {
      const v = await layViTri();
      datVi(v.latitude.toFixed(7));
      datKinh(v.longitude.toFixed(7));
      datThongBao(
        `Đã điền toạ độ máy này (độ chính xác ±${v.doChinhXacM ?? '?'}m). Kiểm tra rồi bấm Lưu.`,
      );
    } catch (e) {
      datLoi(e instanceof LoiViTri ? e.message : 'Không lấy được vị trí.');
    }
  }

  async function luuGps(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datThongBao(null);
    datDangLuu(true);
    try {
      const coToaDo = vi.trim() !== '' && kinh.trim() !== '';
      await goiApi(`/api/dia-diem/${chonDiem}/gps`, {
        method: 'PATCH',
        than: {
          latitude: coToaDo ? Number(vi) : null,
          longitude: coToaDo ? Number(kinh) : null,
          gpsRadiusM: banKinh.trim() === '' ? null : Number(banKinh),
          gpsRequired: batKhoa,
        },
      });
      datThongBao(
        batKhoa
          ? 'Đã lưu cấu hình khoá vị trí.'
          : 'Đã TẮT khoá vị trí cho kho này. Tài khoản kho đăng nhập được từ mọi nơi; mỗi lần vẫn ghi nhật ký.',
      );
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Lưu thất bại.');
    } finally {
      datDangLuu(false);
    }
  }

  async function capMa(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datThongBao(null);
    datMaMoi(null);
    try {
      const kq = await goiApi<{ ok: true; ma: string }>('/api/vuot-quyen-gps', {
        method: 'POST',
        than: {
          locationId: capChoKho,
          ...(lyDoCap.trim() ? { reason: lyDoCap.trim() } : {}),
          hieuLucPhut: Number(hieuLucPhut),
        },
      });
      datMaMoi(kq.ma);
      datLyDoCap('');
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Cấp mã thất bại.');
    }
  }

  async function thuHoi(id: string): Promise<void> {
    datLoi(null);
    try {
      await goiApi(`/api/vuot-quyen-gps/${id}`, { method: 'DELETE' });
      datThongBao('Đã thu hồi mã.');
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thu hồi thất bại.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Khoá vị trí tài khoản kho</h1>
          <p className="text-sm text-muted-foreground">
            Máy chủ tính khoảng cách và tự quyết định. Mọi lần đăng nhập đều ghi nhật ký kèm toạ độ.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
          <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
        </Button>
      </div>

      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}
      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="text-primary" aria-hidden />
            Toạ độ &amp; bán kính của kho
          </CardTitle>
          <CardDescription>
            Kho <strong>còn bật khoá</strong> mà chưa có toạ độ thì tài khoản kho của nó{' '}
            <strong>không đăng nhập được</strong> — chặn chủ động để không ai lọt qua khi thiếu
            cấu hình. Kho nằm ngay trụ sở, người ra vào đã kiểm soát bằng cửa, thì tắt khoá cho
            đỡ vướng vì GPS trong nhà hay lệch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kho</TableHead>
                <TableHead>Vĩ độ</TableHead>
                <TableHead>Kinh độ</TableHead>
                <TableHead>Khoá vị trí</TableHead>
                <TableHead>Bán kính</TableHead>
                <TableHead className="text-right">Cấu hình</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {danhSachKho.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <p className="font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {NHAN_LOAI_DIEM_LUU_TRU[d.type]} · {d.code}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.latitude ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{d.longitude ?? '—'}</TableCell>
                  <TableCell>
                    {d.gpsRequired ? (
                      <Badge variant="success">Đang bật</Badge>
                    ) : (
                      <Badge variant="muted">Đã tắt</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!d.gpsRequired ? (
                      <span className="text-xs text-muted-foreground">không áp dụng</span>
                    ) : d.latitude === null ? (
                      <Badge variant="warning">Chưa cấu hình</Badge>
                    ) : (
                      <Badge variant="success">{d.gpsRadiusM ?? 150} m</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => chonDeSua(d)}>
                      Sửa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {chonDiem ? (
            <form
              onSubmit={(su) => void luuGps(su)}
              className="mx-5 grid gap-3 rounded-lg border p-4 sm:mx-0 sm:grid-cols-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="g-vi">Vĩ độ</Label>
                <Input
                  id="g-vi"
                  inputMode="decimal"
                  value={vi}
                  onChange={(su) => datVi(su.target.value)}
                  placeholder="21.0012345"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-kinh">Kinh độ</Label>
                <Input
                  id="g-kinh"
                  inputMode="decimal"
                  value={kinh}
                  onChange={(su) => datKinh(su.target.value)}
                  placeholder="105.8123456"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label
                  htmlFor="g-bat"
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                >
                  <input
                    id="g-bat"
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-[hsl(var(--primary))]"
                    checked={batKhoa}
                    onChange={(su) => datBatKhoa(su.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium">Bật khoá vị trí cho kho này</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      Bỏ dấu tích là tài khoản kho đăng nhập được từ mọi nơi. Máy chủ vẫn ghi
                      nhật ký mỗi lần đăng nhập kèm toạ độ nếu máy có gửi.
                    </span>
                  </span>
                </Label>
              </div>
              <div className={batKhoa ? 'space-y-1.5' : 'space-y-1.5 opacity-50'}>
                <Label htmlFor="g-bk">Bán kính cho phép (m)</Label>
                <Input
                  id="g-bk"
                  type="number"
                  min={20}
                  max={50000}
                  value={banKinh}
                  onChange={(su) => datBanKinh(su.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                <Button type="submit" disabled={dangLuu}>
                  {dangLuu ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                  Lưu
                </Button>
                <Button type="button" variant="outline" onClick={() => void layViTriHienTai()}>
                  <Crosshair aria-hidden />
                  Lấy toạ độ máy này
                </Button>
                <Button type="button" variant="ghost" onClick={() => datChonDiem('')}>
                  Đóng
                </Button>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-3">
                GPS trong nhà thường lệch 50–200m. Bán kính 150m là mặc định hợp lý; để trống
                toạ độ nếu muốn tạm khoá đăng nhập của kho này.
              </p>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="text-primary" aria-hidden />
            Mã vượt quyền dùng một lần
          </CardTitle>
          <CardDescription>
            Dùng khi GPS lệch khiến nhân viên kho không vào được. Mỗi mã chỉ dùng được một lần
            và có thời hạn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(su) => void capMa(su)} className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="m-kho">Kho</Label>
              <Select
                id="m-kho"
                required
                value={capChoKho}
                onChange={(su) => datCapChoKho(su.target.value)}
              >
                <option value="">— Chọn kho —</option>
                {danhSachKho.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-hl">Hiệu lực (phút)</Label>
              <Input
                id="m-hl"
                type="number"
                min={5}
                max={1440}
                required
                value={hieuLucPhut}
                onChange={(su) => datHieuLucPhut(su.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-ly-do">Lý do</Label>
              <Input
                id="m-ly-do"
                value={lyDoCap}
                onChange={(su) => datLyDoCap(su.target.value)}
                placeholder="GPS trong nhà lệch"
              />
            </div>
            <div className="sm:col-span-4">
              <Button type="submit">
                <KeyRound aria-hidden />
                Cấp mã
              </Button>
            </div>
          </form>

          {maMoi ? (
            <Alert variant="warning" tieuDe="Mã chỉ hiện MỘT LẦN">
              <p className="my-1 font-mono text-2xl tracking-widest text-foreground">{maMoi}</p>
              Đọc ngay cho nhân viên kho. Hệ thống chỉ lưu bản băm — tải lại trang là không xem
              lại được, mất thì phải cấp mã mới.
            </Alert>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Kho</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Người cấp</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maVuotQuyen.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Chưa cấp mã nào.
                  </TableCell>
                </TableRow>
              ) : (
                maVuotQuyen.map((m) => {
                  const hetHan = new Date(m.expiresAt).getTime() <= Date.now();
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono">{m.codePrefix}••••</TableCell>
                      <TableCell>{m.location?.name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{m.reason ?? '—'}</TableCell>
                      <TableCell>
                        {m.usedAt ? (
                          <div>
                            <Badge variant="muted">Đã dùng</Badge>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {m.usedBy?.fullName ?? '—'} · {ngayGio(m.usedAt)}
                            </p>
                          </div>
                        ) : hetHan ? (
                          <Badge variant="muted">Hết hạn</Badge>
                        ) : (
                          <Badge variant="success">{conLai(m.expiresAt)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.issuedBy?.fullName ?? '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {!m.usedAt && !hetHan ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive-dam hover:bg-destructive/10"
                            title="Thu hồi mã"
                            aria-label="Thu hồi mã"
                            onClick={() => void thuHoi(m.id)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Alert variant="info" tieuDe="Vì sao kiểm ở máy chủ?">
        <ShieldAlert className="mb-1 inline size-4 align-text-bottom" aria-hidden /> Trình duyệt
        chỉ <em>gửi</em> toạ độ; máy chủ mới tính khoảng cách và quyết định. Sửa mã web hay giả
        toạ độ trong công cụ nhà phát triển đều không vượt được, và mọi lần thử đều nằm trong
        nhật ký thao tác.
      </Alert>
    </div>
  );
}
