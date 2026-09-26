import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Search, Wifi, WifiOff, Trash2, FileSignature} from 'lucide-react';
import {
  DS_LOAI_YEU_CAU,
  DS_TRANG_THAI_YEU_CAU,
  NHAN_LOAI_YEU_CAU,
  NHAN_TRANG_THAI_YEU_CAU,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import type { TrangDuLieu, YeuCau } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';
import { MAU_TRANG_THAI } from './tien-ich';

const MOI_TRANG = 25;

export function YeuCauList() {
  const { nguoiDung } = useAuth();
  // Mở từ dashboard hoặc màn hình kho thì lọc sẵn theo ?status= và ?type=.
  const [thamSo] = useSearchParams();
  const [muc, datMuc] = useState<YeuCau[]>([]);
  const [tong, datTong] = useState(0);
  const [trang, datTrang] = useState(1);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  /** Các dòng đã tick — dùng Set để bật/tắt nhanh và giữ thứ tự không quan trọng. */
  const [daChon, datDaChon] = useState<ReadonlySet<string>>(new Set());
  const [dangXoaLo, datDangXoaLo] = useState(false);
  const [ghiChuXoa, datGhiChuXoa] = useState<string | null>(null);
  const [tuKhoa, datTuKhoa] = useState('');
  const [locLoai, datLocLoai] = useState(thamSo.get('type') ?? '');
  const [locTrangThai, datLocTrangThai] = useState(thamSo.get('status') ?? '');
  const [cuaToi, datCuaToi] = useState(false);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const q = new URLSearchParams({ trang: String(trang), moiTrang: String(MOI_TRANG) });
      if (tuKhoa.trim()) q.set('tuKhoa', tuKhoa.trim());
      if (locLoai) q.set('type', locLoai);
      if (locTrangThai) q.set('status', locTrangThai);
      if (cuaToi) q.set('cuaToi', 'true');
      const kq = await goiApi<TrangDuLieu<YeuCau>>(`/api/yeu-cau?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách yêu cầu.');
    } finally {
      datDangTai(false);
    }
  }, [trang, tuKhoa, locLoai, locTrangThai, cuaToi]);

  const laAdmin = nguoiDung?.role === 'ADMIN';

  function bat(id: string): void {
    datDaChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
  }

  /**
   * Xoá hàng loạt yêu cầu đã tick — chuyển vào thùng rác, khôi phục lại được.
   *
   * Báo cả phần BỎ QUA kèm lý do: lô 20 dòng mà 2 dòng vướng thì phải biết đúng
   * 2 dòng nào, không thể chỉ báo "thất bại" rồi để người dùng tự dò.
   */
  async function xoaLoDaChon(): Promise<void> {
    const ids = [...daChon];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Chuyển ${ids.length} yêu cầu đã chọn vào thùng rác?\n\n` +
          'Chúng biến khỏi mọi danh sách và mọi con số, nhưng TỒN KHO, NHẬT KÝ DI CHUYỂN và ẢNH giữ nguyên — xoá phiếu không làm hàng quay về kho. Khôi phục được ở Yêu cầu → Thùng rác.',
      )
    ) {
      return;
    }
    datLoi(null);
    datGhiChuXoa(null);
    datDangXoaLo(true);
    try {
      const kq = await goiApi<{
        ok: true;
        soThanhCong: number;
        boQua: Array<{ ma: string | null; lyDo: string }>;
        thongDiep: string;
      }>('/api/yeu-cau/xoa-nhieu', { method: 'POST', than: { ids } });
      datDaChon(new Set());
      await tai();
      datGhiChuXoa(kq.thongDiep);
      if (kq.boQua.length > 0) {
        datLoi(
          `Bỏ qua ${kq.boQua.length}: ` +
            kq.boQua.map((x) => `${x.ma ?? '?'} (${x.lyDo})`).join('; '),
        );
      }
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá hàng loạt thất bại.');
    } finally {
      datDangXoaLo(false);
    }
  }

  useEffect(() => {
    void tai();
  }, [tai]);

  // Có yêu cầu mới hoặc đổi trạng thái thì tải lại — dữ liệu vẫn do server lọc.
  const { dangNoi } = useRealtime([SU_KIEN.YEU_CAU_MOI, SU_KIEN.YEU_CAU_DOI], () => {
    void tai();
  });

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));
  const doiLoc = (dat: (v: string) => void) => (v: string) => {
    dat(v);
    datTrang(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Yêu cầu</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Mọi thiết bị rời kho đều phải qua một yêu cầu đã duyệt.
            <span
              className={dangNoi ? 'text-success-dam' : 'text-muted-foreground'}
              title={dangNoi ? 'Đang đồng bộ realtime' : 'Mất kết nối realtime'}
            >
              {dangNoi ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
            </span>
          </p>
        </div>
        <Button asChild>
          <Link to="/yeu-cau/moi">
            <Plus aria-hidden />
            Tạo yêu cầu
          </Link>
        </Button>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {ghiChuXoa ? <Alert variant="success">{ghiChuXoa}</Alert> : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Danh sách ({tong})</CardTitle>
            {/* Xoá là quyền của ADMIN — máy chủ kiểm lại, ẩn nút chỉ cho gọn mắt. */}
            {laAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                {daChon.size > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive-dam"
                    disabled={dangXoaLo}
                    onClick={() => void xoaLoDaChon()}
                  >
                    <Trash2 aria-hidden />
                    {dangXoaLo ? 'Đang xoá…' : `Xoá ${daChon.size} yêu cầu`}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" asChild>
                  <Link to="/yeu-cau/thung-rac">
                    <Trash2 aria-hidden />
                    Thùng rác
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
          <CardDescription>
            Trang {trang}/{soTrang}
          </CardDescription>
          <div className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="pl-9"
                placeholder="Tìm theo số yêu cầu, lý do hoặc mã thiết bị…"
                value={tuKhoa}
                onChange={(su) => doiLoc(datTuKhoa)(su.target.value)}
                aria-label="Tìm yêu cầu"
              />
            </div>
            <Select
              value={locLoai}
              onChange={(su) => doiLoc(datLocLoai)(su.target.value)}
              aria-label="Lọc theo loại yêu cầu"
            >
              <option value="">Mọi loại</option>
              {DS_LOAI_YEU_CAU.map((l) => (
                <option key={l.ma} value={l.ma}>
                  {l.nhan}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Select
                value={locTrangThai}
                onChange={(su) => doiLoc(datLocTrangThai)(su.target.value)}
                aria-label="Lọc theo trạng thái"
              >
                <option value="">Mọi trạng thái</option>
                {DS_TRANG_THAI_YEU_CAU.map((t) => (
                  <option key={t.ma} value={t.ma}>
                    {t.nhan}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
                <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
              </Button>
            </div>
            <label className="flex min-h-cham cursor-pointer items-center gap-2 text-sm lg:col-span-4">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--chinh))]"
                checked={cuaToi}
                onChange={(su) => {
                  datCuaToi(su.target.checked);
                  datTrang(1);
                }}
              />
              Chỉ hiện yêu cầu do tôi tạo
            </label>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Chưa có yêu cầu nào.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {laAdmin ? (
                      <TableHead className="w-8">
                        <span className="sr-only">Chọn</span>
                      </TableHead>
                    ) : null}
                    <TableHead>Số yêu cầu</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Người tạo</TableHead>
                    <TableHead>Nơi đến</TableHead>
                    <TableHead className="text-right">Số dòng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Biên bản</TableHead>
                    <TableHead>Tạo lúc</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muc.map((y) => (
                    <TableRow key={y.id}>
                      {laAdmin ? (
                        <TableCell className="w-8">
                          <input
                            type="checkbox"
                            className="size-4 accent-[hsl(var(--chinh))]"
                            checked={daChon.has(y.id)}
                            onChange={() => bat(y.id)}
                            aria-label={`Chọn ${y.code}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Link
                          to={`/yeu-cau/${y.id}`}
                          className="font-mono text-sm font-medium text-primary-dam hover:underline"
                        >
                          {y.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {NHAN_LOAI_YEU_CAU[y.type]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {y.createdBy.fullName}
                        {y.createdBy.department ? (
                          <span className="block text-xs">{y.createdBy.department}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {y.toLocation?.name ?? y.destinationNote ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{y.items.length}</TableCell>
                      <TableCell>
                        <Badge variant={MAU_TRANG_THAI[y.status]}>
                          {NHAN_TRANG_THAI_YEU_CAU[y.status]}
                        </Badge>
                      </TableCell>
                      {/* ĐƯỜNG DẪN THẲNG SANG BIÊN BẢN của chính phiếu này —
                          không phải sang mục Biên bản rồi dò lại theo số phiếu. */}
                      <TableCell>
                        {y.handoverNotes[0] ? (
                          <Link
                            to={`/bbbg/${y.handoverNotes[0].id}`}
                            className="inline-flex items-center gap-1 font-mono text-xs text-primary-dam hover:underline"
                          >
                            <FileSignature className="size-3.5 shrink-0" aria-hidden />
                            {y.handoverNotes[0].code}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {ngayGio(y.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {soTrang > 1 ? (
                <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-0">
                  <Button variant="outline" disabled={trang <= 1} onClick={() => datTrang((t) => t - 1)}>
                    Trang trước
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Trang {trang} / {soTrang}
                  </span>
                  <Button
                    variant="outline"
                    disabled={trang >= soTrang}
                    onClick={() => datTrang((t) => t + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
