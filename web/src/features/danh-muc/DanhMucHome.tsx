import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Layers, Package, PenLine, Pencil, Plus, QrCode, RefreshCw, Target, Trash2, Truck, X } from 'lucide-react';
import { DS_KIEU_QUAN_LY, NHAN_KIEU_QUAN_LY, type KieuQuanLy } from '@ltl/taisan-shared';
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
import type { DanhMuc, TrangDuLieu } from '@/lib/kieu';

type Nhom = 'dong-giai-phap' | 'loai-tai-san' | 'muc-dich' | 'nguon-goc';

function KhoiDanhMuc({
  nhom,
  tieuDe,
  moTa,
  icon,
  coKieuQuanLy,
  maTuDong = false,
}: {
  nhom: Nhom;
  tieuDe: string;
  moTa: string;
  icon: React.ReactNode;
  coKieuQuanLy: boolean;
  /**
   * Để server sinh mã từ tên, không hỏi người dùng.
   *
   * Nguồn gốc và mục đích được thêm chủ yếu từ trong form thiết bị, lúc đang
   * gấp — bắt nghĩ thêm một cái mã viết hoa không dấu là thừa. Loại tài sản và
   * dòng giải pháp thì khác: mã của chúng đi vào file Excel nhập liệu nên người
   * dùng cần tự đặt cho khớp với file họ đang có.
   */
  maTuDong?: boolean;
}) {
  const { nguoiDung } = useAuth();
  const duocSua = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  const laAdmin = nguoiDung?.role === 'ADMIN';

  const [muc, datMuc] = useState<DanhMuc[]>([]);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [hienForm, datHienForm] = useState(false);
  const [code, datCode] = useState('');
  const [name, datName] = useState('');
  const [kieu, datKieu] = useState<KieuQuanLy>('DON_VI');

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<TrangDuLieu<DanhMuc>>(`/api/danh-muc/${nhom}`);
      datMuc(kq.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh mục.');
    } finally {
      datDangTai(false);
    }
  }, [nhom]);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function them(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    try {
      await goiApi(`/api/danh-muc/${nhom}`, {
        method: 'POST',
        than: {
          ...(maTuDong ? {} : { code }),
          name,
          ...(coKieuQuanLy ? { defaultTrackingType: kieu } : {}),
        },
      });
      datCode('');
      datName('');
      datHienForm(false);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thêm thất bại.');
    }
  }

  async function doiHoatDong(d: DanhMuc): Promise<void> {
    datLoi(null);
    try {
      await goiApi(`/api/danh-muc/${nhom}/${d.id}`, {
        method: 'PATCH',
        than: { isActive: !d.isActive },
      });
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Cập nhật thất bại.');
    }
  }

  /**
   * Bật/tắt yêu cầu quét mã cho một loại tài sản.
   *
   * Bật với loại có dán nhãn mã trên từng cái (robot): xuất–nhập phải quét đúng
   * mã. Tắt thì thay bằng khai TÊN + SỐ LƯỢNG kèm ảnh — thùng 200 quyển vở
   * không có nhãn nào để quét. Ảnh thì luôn bắt buộc, không phụ thuộc cờ này.
   */
  async function doiQuetMa(d: DanhMuc): Promise<void> {
    datLoi(null);
    try {
      await goiApi(`/api/danh-muc/${nhom}/${d.id}`, {
        method: 'PATCH',
        than: { yeuCauQuetMa: !d.yeuCauQuetMa },
      });
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Cập nhật thất bại.');
    }
  }

  /**
   * Đổi tên hiển thị. MÃ thì không đổi — mã đã đi vào file Excel nhập liệu và
   * vài chỗ tra cứu cố định, đổi là hỏng những chỗ đó.
   */
  async function doiTen(d: DanhMuc): Promise<void> {
    const ten = window.prompt(`Đổi tên "${d.name}" thành:`, d.name);
    if (ten === null) return;
    if (ten.trim() === '' || ten.trim() === d.name) return;
    datLoi(null);
    try {
      await goiApi(`/api/danh-muc/${nhom}/${d.id}`, {
        method: 'PATCH',
        than: { name: ten.trim() },
      });
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Đổi tên thất bại.');
    }
  }

  async function xoa(d: DanhMuc): Promise<void> {
    if (!window.confirm(`Xoá hẳn "${d.name}"?`)) return;
    datLoi(null);
    try {
      await goiApi(`/api/danh-muc/${nhom}/${d.id}`, { method: 'DELETE' });
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá thất bại.');
    }
  }

  return (
    /*
     * `min-w-0` KHÔNG phải trang trí.
     *
     * Ô của lưới mặc định `min-width: auto`, tức là không co nhỏ hơn nội dung
     * tối thiểu bên trong. Bảng ở dưới có 6 cột, min-content của nó ~860px, nên
     * cả thẻ phình ra 860px trên màn 390px và kéo cả trang tràn ngang — dù bảng
     * đã nằm trong khung cuộn ngang riêng. Có `min-w-0` thì thẻ co đúng bề ngang
     * màn hình và khung cuộn của bảng mới có tác dụng. Đã đo: 876px → 390px.
     */
    <Card className="min-w-0">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {tieuDe} ({muc.length})
          </CardTitle>
          <CardDescription>{moTa}</CardDescription>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
            <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
          </Button>
          {duocSua ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => datHienForm((m) => !m)}
              aria-label={hienForm ? 'Đóng form' : `Thêm ${tieuDe.toLowerCase()}`}
            >
              {hienForm ? <X aria-hidden /> : <Plus aria-hidden />}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loi ? <Alert variant="destructive">{loi}</Alert> : null}

        {hienForm ? (
          <form onSubmit={(su) => void them(su)} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
            {maTuDong ? null : (
              <div className="space-y-1.5">
                <Label htmlFor={`${nhom}-ma`}>Mã *</Label>
                <Input
                  id={`${nhom}-ma`}
                  required
                  className="font-mono"
                  value={code}
                  onChange={(su) => datCode(su.target.value)}
                  placeholder="VIET_HOA_KHONG_DAU"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`${nhom}-ten`}>Tên *</Label>
              <Input
                id={`${nhom}-ten`}
                required
                value={name}
                onChange={(su) => datName(su.target.value)}
              />
            </div>
            {coKieuQuanLy ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${nhom}-kieu`}>Kiểu quản lý mặc định</Label>
                <Select
                  id={`${nhom}-kieu`}
                  value={kieu}
                  onChange={(su) => datKieu(su.target.value as KieuQuanLy)}
                >
                  {DS_KIEU_QUAN_LY.map((k) => (
                    <option key={k.ma} value={k.ma}>
                      {k.nhan}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" size="sm">
                Thêm
              </Button>
            </div>
          </form>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Tên</TableHead>
              {coKieuQuanLy ? <TableHead>Kiểu mặc định</TableHead> : null}
              {coKieuQuanLy ? <TableHead>Xuất–nhập kho</TableHead> : null}
              <TableHead className="text-right">Thiết bị</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {muc.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.code}</TableCell>
                <TableCell>
                  {d.name}
                  {!d.isActive ? (
                    <Badge variant="warning" className="ml-2">
                      Ngừng dùng
                    </Badge>
                  ) : null}
                </TableCell>
                {coKieuQuanLy ? (
                  <TableCell className="text-muted-foreground">
                    {d.defaultTrackingType ? NHAN_KIEU_QUAN_LY[d.defaultTrackingType] : '—'}
                  </TableCell>
                ) : null}
                {coKieuQuanLy ? (
                  <TableCell>
                    {duocSua ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void doiQuetMa(d)}
                        title={
                          d.yeuCauQuetMa
                            ? 'Đang bắt quét mã — bấm để đổi sang khai tên + số lượng'
                            : 'Đang khai tên + số lượng — bấm để bắt quét mã'
                        }
                      >
                        {d.yeuCauQuetMa ? (
                          <>
                            <QrCode aria-hidden />
                            Quét mã
                          </>
                        ) : (
                          <>
                            <PenLine aria-hidden />
                            Tên + số lượng
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {d.yeuCauQuetMa ? 'Quét mã' : 'Tên + số lượng'}
                      </span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {d._count?.assets ?? 0}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {duocSua ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => void doiTen(d)}
                        aria-label={`Đổi tên ${d.name}`}
                        title="Đổi tên"
                      >
                        <Pencil aria-hidden />
                      </Button>
                    ) : null}
                    {duocSua ? (
                      <Button variant="outline" size="sm" onClick={() => void doiHoatDong(d)}>
                        {d.isActive ? 'Ngừng dùng' : 'Dùng lại'}
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
  );
}

export function DanhMucHome() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Danh mục</h1>
        <p className="text-sm text-muted-foreground">
          Danh mục còn thiết bị thì không xoá được — hãy đặt Ngừng dùng để ẩn khỏi ô chọn.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <KhoiDanhMuc
          nhom="loai-tai-san"
          tieuDe="Loại tài sản"
          moTa="Robot, Máy tính/Laptop, Tablet, Kính VR, Sa bàn, Ấn phẩm in…"
          icon={<Package className="text-primary-dam" aria-hidden />}
          coKieuQuanLy
        />
        <KhoiDanhMuc
          nhom="dong-giai-phap"
          tieuDe="Dòng giải pháp"
          moTa="uKit, UGOT, Stick'Em, Alpha Mini, Yanshee, Weeemake…"
          icon={<Layers className="text-primary-dam" aria-hidden />}
          coKieuQuanLy={false}
        />
        <KhoiDanhMuc
          nhom="nguon-goc"
          tieuDe="Nguồn gốc"
          moTa="Thiết bị từ đâu mà có. Thêm được thẳng trong form thiết bị."
          icon={<Truck className="text-primary-dam" aria-hidden />}
          coKieuQuanLy={false}
          maTuDong
        />
        <KhoiDanhMuc
          nhom="muc-dich"
          tieuDe="Mục đích sử dụng"
          moTa="Thiết bị dùng vào việc gì. Thêm được thẳng trong form thiết bị."
          icon={<Target className="text-primary-dam" aria-hidden />}
          coKieuQuanLy={false}
          maTuDong
        />
      </div>
    </div>
  );
}
