import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boxes, Filter, RefreshCw, Search } from 'lucide-react';
import { DS_LOAI_DIEM_LUU_TRU, NHAN_LOAI_DIEM_LUU_TRU } from '@ltl/taisan-shared';
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
import { so } from '@/lib/bieu-do';
import type { DanhMuc, DuLieuTonTheoDiem, NoiDen, TrangDuLieu } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';

type Tab = 'diem' | 'san-pham';
const KHOA_LOC = ['diaDiemId', 'loaiDiem', 'categoryId', 'productLineId', 'trackingType', 'tuKhoa'] as const;
type KhoaLoc = (typeof KHOA_LOC)[number];

/**
 * TRA CỨU TỒN theo điểm và theo sản phẩm, có bộ lọc.
 *
 * Trả lời đúng hai câu hỏi hay gặp nhất: "kho / trường này đang có bao nhiêu bộ,
 * bao nhiêu hàng lẻ?" và "mã này đang nằm ở những đâu, mỗi nơi bao nhiêu?". Số
 * cùng cách tính với các ô trên trang chủ (đã trừ hàng đang trên đường), nên
 * cộng lại khớp nhau.
 *
 * Bộ lọc nằm trên đường dẫn (?diaDiemId=…) để các ô trên trang chủ dẫn thẳng
 * vào đúng chỗ, và gửi đường dẫn cho người khác xem cùng một bảng.
 *
 * API cũ chưa có tuyến này thì khối tự ẩn, không làm hỏng trang chủ.
 */
export function BangTonTheoDiem({ nhung = false }: { nhung?: boolean }) {
  const [thamSo, datThamSo] = useSearchParams();
  const [tab, datTab] = useState<Tab>(thamSo.get('diaDiemId') ? 'san-pham' : 'diem');
  const [dl, datDl] = useState<DuLieuTonTheoDiem | null>(null);
  const [khongHoTro, datKhongHoTro] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTai, datDangTai] = useState(false);
  const [dsDiem, datDsDiem] = useState<NoiDen[]>([]);
  const [dsLoai, datDsLoai] = useState<DanhMuc[]>([]);
  const [dsDong, datDsDong] = useState<DanhMuc[]>([]);
  const [tuKhoaGo, datTuKhoaGo] = useState(thamSo.get('tuKhoa') ?? '');
  const [lanTai, datLanTai] = useState(0);

  const loc = Object.fromEntries(
    KHOA_LOC.map((k) => [k, thamSo.get(k) ?? '']),
  ) as Record<KhoaLoc, string>;
  const chuoiLoc = KHOA_LOC.map((k) => `${k}=${loc[k]}`).join('&');

  function datLoc(k: KhoaLoc, v: string): void {
    const moi = new URLSearchParams(thamSo);
    if (v) moi.set(k, v);
    else moi.delete(k);
    datThamSo(moi, { replace: true });
  }

  useEffect(() => {
    void (async () => {
      try {
        const [d, l, g] = await Promise.all([
          goiApi<TrangDuLieu<NoiDen>>('/api/dia-diem/noi-den'),
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/loai-tai-san'),
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/dong-giai-phap'),
        ]);
        datDsDiem(d.muc);
        datDsLoai(l.muc);
        datDsDong(g.muc);
      } catch {
        // Thiếu danh mục thì vẫn xem được bảng, chỉ thiếu ô lọc.
      }
    })();
  }, []);

  // Gõ từ khoá: đợi người dùng ngừng gõ rồi mới lọc.
  useEffect(() => {
    const hen = setTimeout(() => {
      if ((thamSo.get('tuKhoa') ?? '') !== tuKhoaGo.trim()) datLoc('tuKhoa', tuKhoaGo.trim());
    }, 300);
    return () => clearTimeout(hen);
  }, [tuKhoaGo]);

  useEffect(() => {
    let conDung = true;
    void (async () => {
      datDangTai(true);
      try {
        const q = new URLSearchParams({ gioiHan: '500' });
        for (const k of KHOA_LOC) if (loc[k]) q.set(k, loc[k]);
        const kq = await goiApi<DuLieuTonTheoDiem>(`/api/bao-cao/ton-theo-diem?${q.toString()}`);
        if (conDung) {
          datDl(kq);
          datLoi(null);
        }
      } catch (e) {
        if (!conDung) return;
        if (e instanceof LoiApi && e.maHttp === 404) datKhongHoTro(true);
        else datLoi(e instanceof LoiApi ? e.message : 'Không tải được bảng tồn.');
      } finally {
        if (conDung) datDangTai(false);
      }
    })();
    return () => {
      conDung = false;
    };
  }, [chuoiLoc, lanTai]);

  useRealtime([SU_KIEN.KHO_DOI], () => datLanTai((n) => n + 1));

  if (khongHoTro) {
    return nhung ? null : (
      <Alert variant="info">
        Máy chủ chưa cập nhật bản có bảng tồn theo điểm. Chạy script cập nhật trên VPS rồi tải lại.
      </Alert>
    );
  }

  const coLoc = KHOA_LOC.some((k) => loc[k]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="text-primary-dam" aria-hidden />
              Tồn theo điểm và theo sản phẩm
            </CardTitle>
            <CardDescription>
              Lọc để xem chính xác từng kho, từng trường còn bao nhiêu bộ / hàng lẻ, và từng mã
              đang nằm ở đâu. Đã trừ hàng đang trên đường.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {nhung ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/ton-kho?${thamSo.toString()}`}>Mở trang riêng</Link>
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={() => datLanTai((n) => n + 1)}
              aria-label="Tải lại bảng tồn"
            >
              <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Select
            value={loc.diaDiemId}
            onChange={(su) => datLoc('diaDiemId', su.target.value)}
            aria-label="Lọc theo điểm"
          >
            <option value="">Mọi điểm</option>
            {dsDiem.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            value={loc.loaiDiem}
            onChange={(su) => datLoc('loaiDiem', su.target.value)}
            aria-label="Lọc theo loại điểm"
          >
            <option value="">Mọi loại điểm</option>
            {DS_LOAI_DIEM_LUU_TRU.map((l) => (
              <option key={l.ma} value={l.ma}>
                {l.nhan}
              </option>
            ))}
          </Select>
          <Select
            value={loc.categoryId}
            onChange={(su) => datLoc('categoryId', su.target.value)}
            aria-label="Lọc theo loại tài sản"
          >
            <option value="">Mọi loại tài sản</option>
            {dsLoai.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select
            value={loc.productLineId}
            onChange={(su) => datLoc('productLineId', su.target.value)}
            aria-label="Lọc theo dòng giải pháp"
          >
            <option value="">Mọi dòng giải pháp</option>
            {dsDong.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select
            value={loc.trackingType}
            onChange={(su) => datLoc('trackingType', su.target.value)}
            aria-label="Bộ hay hàng lẻ"
          >
            <option value="">Bộ và hàng lẻ</option>
            <option value="DON_VI">Chỉ bộ (từng cái có mã)</option>
            <option value="SO_LUONG">Chỉ hàng lẻ</option>
          </Select>
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-8"
              placeholder="Mã hoặc tên"
              value={tuKhoaGo}
              onChange={(su) => datTuKhoaGo(su.target.value)}
              aria-label="Tìm theo mã hoặc tên"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={tab === 'diem' ? 'default' : 'outline'}
            onClick={() => datTab('diem')}
            aria-pressed={tab === 'diem'}
          >
            Theo điểm
          </Button>
          <Button
            size="sm"
            variant={tab === 'san-pham' ? 'default' : 'outline'}
            onClick={() => datTab('san-pham')}
            aria-pressed={tab === 'san-pham'}
          >
            Theo sản phẩm
          </Button>
          {coLoc ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                datTuKhoaGo('');
                datThamSo(new URLSearchParams(), { replace: true });
              }}
            >
              <Filter aria-hidden />
              Bỏ lọc
            </Button>
          ) : null}
          {dl ? (
            <span className="ml-auto text-sm text-muted-foreground">
              Tổng: <strong className="text-foreground">{so(dl.tongCong.bo)}</strong> bộ ·{' '}
              <strong className="text-foreground">{so(dl.tongCong.le)}</strong> hàng lẻ
              {dl.tongCong.dangDiBo + dl.tongCong.dangDiLe > 0
                ? ` · đang chuyển đi ${so(dl.tongCong.dangDiBo)} bộ, ${so(dl.tongCong.dangDiLe)} lẻ`
                : ''}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-5">
        {loi ? <Alert variant="destructive">{loi}</Alert> : null}
        {!dl ? (
          <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
        ) : tab === 'diem' ? (
          dl.diem.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Không có điểm nào khớp bộ lọc.</p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Điểm</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="text-right">Bộ</TableHead>
                    <TableHead className="text-right">Hàng lẻ</TableHead>
                    <TableHead className="text-right">Đang chuyển đi</TableHead>
                    <TableHead className="text-right">Số mã</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dl.diem.map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer"
                      onClick={() => {
                        datLoc('diaDiemId', d.id);
                        datTab('san-pham');
                      }}
                    >
                      <TableCell>
                        <span className="font-medium text-primary-dam">{d.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{d.code}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="muted">{NHAN_LOAI_DIEM_LUU_TRU[d.type]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{so(d.bo)}</TableCell>
                      <TableCell className="text-right tabular-nums">{so(d.le)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {d.dangDiBo + d.dangDiLe > 0
                          ? `${so(d.dangDiBo)} bộ · ${so(d.dangDiLe)} lẻ`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{so(d.soMa)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : dl.dong.length === 0 ? (
          <p className="px-5 text-sm text-muted-foreground sm:px-0">Không có sản phẩm nào khớp bộ lọc.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã / Tên</TableHead>
                  <TableHead>Kiểu</TableHead>
                  <TableHead className="text-right">
                    {loc.diaDiemId ? 'Tại điểm' : 'Tổng'}
                  </TableHead>
                  <TableHead>Đang ở đâu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dl.dong.map((t) => (
                  <TableRow key={t.assetId}>
                    <TableCell>
                      <Link
                        to={`/thiet-bi/${t.assetId}`}
                        className="font-mono text-sm text-primary-dam hover:underline"
                      >
                        {t.code}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {t.name} · {t.category.name}
                        {t.productLine ? ` · ${t.productLine.name}` : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.trackingType === 'DON_VI' ? 'default' : 'accent'}>
                        {t.trackingType === 'DON_VI' ? 'Bộ' : 'Hàng lẻ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {so(t.tong)}
                      {t.dangDi > 0 ? (
                        <span className="block text-xs text-warning-dam">đang đi {so(t.dangDi)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.theoDiem.length === 0
                        ? 'Không còn ở điểm nào (đã ra khỏi hệ thống / nhân sự mượn)'
                        : t.theoDiem
                            .map(
                              (d) =>
                                `${d.ten} ${so(d.khaDung)}${d.dangDi > 0 ? ` (đi ${so(d.dangDi)})` : ''}`,
                            )
                            .join(' · ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {dl.tongDong > dl.dong.length ? (
              <p className="px-5 pt-2 text-xs text-muted-foreground sm:px-0">
                Hiện {dl.dong.length}/{dl.tongDong} mã — lọc thêm để thu hẹp.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
