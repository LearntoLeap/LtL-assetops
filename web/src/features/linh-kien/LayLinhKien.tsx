import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Plus, RefreshCw, Search, Wrench } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ChupAnh } from '@/components/ChupAnh';
import { NutQuetQR } from '@/components/QuetQR';
import { goiApi, LoiApi } from '@/lib/api';
import type { AnhDaTai } from '@/lib/anh';
import { ngayGio } from '@/lib/dinh-dang';
import type { PhieuBaoHong, PhieuLinhKien, TrangDuLieu } from '@/lib/kieu';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface LyDo {
  id: string;
  name: string;
}

/**
 * LẤY LINH KIỆN THAY THẾ.
 *
 * Bắt buộc gắn vào một phiếu báo hỏng đang mở — không có đường nào lấy linh
 * kiện mà không có chứng từ gốc. Vào được từ màn hình kho (máy tại kho) và từ
 * chi tiết phiếu báo hỏng (máy người đề xuất), nên nhận `?baoHong=<id>` để
 * chọn sẵn phiếu khi đi từ đường thứ hai.
 *
 * Hai dạng linh kiện, giao diện đổi theo việc có điền mã hay không:
 *   - CÓ MÃ trong kho → chỉ cần mã + số lượng + lý do;
 *   - KHÔNG CÓ MÃ     → bắt buộc ẢNH và (tên linh kiện hoặc mã hãng).
 * Máy chủ kiểm lại cả hai điều kiện, ẩn/hiện ở đây chỉ để đỡ nhầm.
 */
export function LayLinhKien() {
  const [thamSo] = useSearchParams();
  const baoHongTuLink = thamSo.get('baoHong');

  const [dsBaoHong, datDsBaoHong] = useState<PhieuBaoHong[]>([]);
  const [dsLyDo, datDsLyDo] = useState<LyDo[]>([]);
  const [lichSu, datLichSu] = useState<PhieuLinhKien[]>([]);
  const [dangTai, datDangTai] = useState(true);

  const [baoHongId, datBaoHongId] = useState(baoHongTuLink ?? '');
  const [maLinhKien, datMaLinhKien] = useState('');
  const [tenLinhKien, datTenLinhKien] = useState('');
  const [maHang, datMaHang] = useState('');
  const [soLuong, datSoLuong] = useState('1');
  const [lyDoId, datLyDoId] = useState('');
  const [ghiChu, datGhiChu] = useState('');
  const [anh, datAnh] = useState<AnhDaTai[]>([]);

  const [lyDoMoi, datLyDoMoi] = useState('');
  const [moThemLyDo, datMoThemLyDo] = useState(false);

  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangLuu, datDangLuu] = useState(false);

  const coMa = maLinhKien.trim().length >= 3;

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const [bh, ld, ls] = await Promise.all([
        goiApi<TrangDuLieu<PhieuBaoHong>>('/api/bao-hong?dangMo=true'),
        goiApi<{ ok: true; muc: LyDo[] }>('/api/linh-kien/ly-do'),
        goiApi<{ ok: true; muc: PhieuLinhKien[] }>('/api/linh-kien?moiTrang=30'),
      ]);
      datDsBaoHong(bh.muc);
      datDsLyDo(ld.muc);
      datLichSu(ls.muc);
      if (ld.muc[0] && !lyDoId) datLyDoId(ld.muc[0].id);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được dữ liệu.');
    } finally {
      datDangTai(false);
    }
    // lyDoId cố tình không nằm trong deps: chỉ dùng để đặt giá trị mặc định lần
    // đầu, thêm vào sẽ tải lại mỗi lần người dùng đổi ô chọn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function themLyDo(): Promise<void> {
    const ten = lyDoMoi.trim();
    if (ten.length < 3) {
      datLoi('Lý do phải có ít nhất 3 ký tự.');
      return;
    }
    try {
      const kq = await goiApi<{ ok: true; lyDo: LyDo; daCoSan: boolean }>('/api/linh-kien/ly-do', {
        method: 'POST',
        than: { name: ten },
      });
      datDsLyDo((ds) => (ds.some((l) => l.id === kq.lyDo.id) ? ds : [...ds, kq.lyDo]));
      datLyDoId(kq.lyDo.id);
      datLyDoMoi('');
      datMoThemLyDo(false);
      datThongBao(kq.daCoSan ? 'Lý do này đã có sẵn — đã chọn giúp bạn.' : 'Đã thêm lý do mới.');
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không thêm được lý do.');
    }
  }

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datThongBao(null);
    datDangLuu(true);
    try {
      const kq = await goiApi<{ ok: true; phieu: PhieuLinhKien }>('/api/linh-kien', {
        method: 'POST',
        than: {
          baoHongId,
          ...(coMa ? { maLinhKien: maLinhKien.trim().toUpperCase() } : {}),
          ...(tenLinhKien.trim() ? { tenLinhKien: tenLinhKien.trim() } : {}),
          ...(maHang.trim() ? { maHang: maHang.trim() } : {}),
          soLuong: Number(soLuong),
          lyDoId,
          ...(ghiChu.trim() ? { ghiChu: ghiChu.trim() } : {}),
          anhIds: anh.map((a) => a.id),
        },
      });
      datThongBao(`Đã lập phiếu ${kq.phieu.code}. Kho, vận hành và nhân sự đã được thông báo.`);
      datMaLinhKien('');
      datTenLinhKien('');
      datMaHang('');
      datSoLuong('1');
      datGhiChu('');
      datAnh([]);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không lập được phiếu.');
    } finally {
      datDangLuu(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Lấy linh kiện thay thế</h1>
          <p className="text-sm text-muted-foreground">
            Lấy được ngay, không chờ duyệt — nhưng phải gắn vào một phiếu báo hỏng đang mở.
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
            <Wrench className="text-primary" aria-hidden />
            Phiếu lấy linh kiện
          </CardTitle>
          <CardDescription>
            Linh kiện <strong>không có mã</strong> trong kho thì bắt buộc chụp ảnh và điền tên
            hoặc mã của hãng cung cấp — đó là bằng chứng duy nhất cho thấy linh kiện đã ra khỏi kho.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(su) => void gui(su)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lk-bh">Phiếu báo hỏng</Label>
              <Select
                id="lk-bh"
                value={baoHongId}
                onChange={(su) => datBaoHongId(su.target.value)}
                required
              >
                <option value="">— Chọn phiếu báo hỏng đang mở —</option>
                {dsBaoHong.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.items?.[0]?.asset.code ?? '?'} — {p.items?.[0]?.asset.name ?? ''}
                  </option>
                ))}
              </Select>
              {dsBaoHong.length === 0 && !dangTai ? (
                <p className="text-xs text-muted-foreground">
                  Chưa có phiếu báo hỏng nào đang mở.{' '}
                  <Link to="/bao-hong/moi" className="font-medium text-primary underline">
                    Lập phiếu báo hỏng trước
                  </Link>
                  .
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lk-ma">Mã linh kiện trong kho</Label>
              <div className="flex gap-2">
                <Input
                  id="lk-ma"
                  className="font-mono"
                  placeholder="LTL-PK-0001"
                  value={maLinhKien}
                  onChange={(su) => datMaLinhKien(su.target.value.toUpperCase())}
                />
                <NutQuetQR nhan="Quét" onQuetDuoc={(ma) => datMaLinhKien(ma.toUpperCase())} />
              </div>
              <p className="text-xs text-muted-foreground">
                Để trống nếu linh kiện chưa có mã trong kho.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lk-sl">Số lượng</Label>
              <Input
                id="lk-sl"
                type="number"
                min={1}
                max={100000}
                value={soLuong}
                onChange={(su) => datSoLuong(su.target.value)}
                required
              />
            </div>

            {!coMa ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lk-ten">Tên linh kiện</Label>
                  <Input
                    id="lk-ten"
                    placeholder="Bánh răng nhựa 20T"
                    value={tenLinhKien}
                    onChange={(su) => datTenLinhKien(su.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lk-hang">Mã của hãng cung cấp</Label>
                  <Input
                    id="lk-hang"
                    className="font-mono"
                    placeholder="MG996R"
                    value={maHang}
                    onChange={(su) => datMaHang(su.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Điền <strong>tên</strong> hoặc <strong>mã hãng</strong> — có một trong hai là đủ.
                  </p>
                </div>
              </>
            ) : null}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lk-lydo">Lý do thay</Label>
              <div className="flex flex-wrap gap-2">
                <Select
                  id="lk-lydo"
                  className="min-w-0 flex-1"
                  value={lyDoId}
                  onChange={(su) => datLyDoId(su.target.value)}
                  required
                >
                  {dsLyDo.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => datMoThemLyDo((m) => !m)}
                  aria-expanded={moThemLyDo}
                >
                  <Plus aria-hidden />
                  Lý do khác
                </Button>
              </div>
              {moThemLyDo ? (
                <div className="flex flex-wrap gap-2 rounded-lg border bg-secondary/40 p-3">
                  <Input
                    className="min-w-0 flex-1"
                    placeholder="Mô tả hiện tượng chưa có trong danh sách"
                    value={lyDoMoi}
                    onChange={(su) => datLyDoMoi(su.target.value)}
                    onKeyDown={(su) => {
                      if (su.key === 'Enter') {
                        su.preventDefault();
                        void themLyDo();
                      }
                    }}
                  />
                  <Button type="button" onClick={() => void themLyDo()}>
                    Thêm vào danh sách
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="lk-gc">Ghi chú thêm</Label>
              <textarea
                id="lk-gc"
                className={`${O_VAN_BAN} min-h-20`}
                placeholder="Thay cả cặp để đồng bộ…"
                value={ghiChu}
                onChange={(su) => datGhiChu(su.target.value)}
                maxLength={2000}
              />
            </div>

            <div className="sm:col-span-2">
              <ChupAnh
                kind="LINH_KIEN"
                anh={anh}
                onDoiAnh={datAnh}
                toiDa={5}
                batBuoc={!coMa}
                moTa={
                  coMa
                    ? 'Không bắt buộc với linh kiện đã có mã trong kho.'
                    : 'BẮT BUỘC: chụp linh kiện vừa lấy ra, vì linh kiện này chưa có mã trong kho.'
                }
              />
            </div>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={dangLuu || !baoHongId}>
                {dangLuu ? <Loader2 className="animate-spin" aria-hidden /> : <Wrench aria-hidden />}
                Lập phiếu lấy linh kiện
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="text-primary" aria-hidden />
            Lịch sử lấy linh kiện
          </CardTitle>
          <CardDescription>
            30 phiếu gần nhất trong phạm vi của bạn. Điểm trường chỉ thấy linh kiện thay cho thiết
            bị của trường mình.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lichSu.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có phiếu nào.</p>
          ) : (
            lichSu.map((p) => (
              <div key={p.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{p.code}</span>
                  <Badge variant="muted">{p.quantity} cái</Badge>
                  <Badge variant="warning">{p.reason.name}</Badge>
                  {p.asset ? (
                    <span className="font-mono text-xs text-muted-foreground">{p.asset.code}</span>
                  ) : (
                    <Badge variant="muted">không có mã</Badge>
                  )}
                  {p.photos.length > 0 ? (
                    <Badge variant="muted">{p.photos.length} ảnh</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm">
                  {p.asset?.name ?? p.partName ?? p.vendorCode ?? '—'}
                  {p.vendorCode && p.partName ? (
                    <span className="font-mono text-xs text-muted-foreground"> · {p.vendorCode}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.request.code} · {p.request.items?.[0]?.asset.code ?? '?'}
                  {p.request.items?.[0]?.asset.currentLocation
                    ? ` · ${p.request.items[0].asset.currentLocation.name}`
                    : ''}{' '}
                  · {p.issuedBy.fullName} · {ngayGio(p.issuedAt)}
                </p>
                {p.note ? <p className="mt-1 text-sm text-muted-foreground">{p.note}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
