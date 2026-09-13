import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Search } from 'lucide-react';
import QRCode from 'qrcode';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { goiApi, LoiApi } from '@/lib/api';
import type { ThietBi, TrangDuLieu } from '@/lib/kieu';

/**
 * In nhãn QR khổ A4, nhiều nhãn một trang.
 *
 * Mã QR sinh ngay trên trình duyệt (thư viện qrcode) nên in bao nhiêu nhãn cũng
 * không phải gọi server. Nội dung mã QR đúng bằng MÃ THIẾT BỊ — quét ra là tra
 * cứu được ngay, không nhúng URL để nhãn không chết khi đổi tên miền.
 */
type CoNhan = 'nho' | 'vua' | 'lon';

const CO_NHAN: Record<CoNhan, { nhan: string; rongMm: number; caoMm: number; qrMm: number; coChuPt: number }> = {
  nho: { nhan: 'Nhỏ — 38×25mm (55 nhãn/trang)', rongMm: 38, caoMm: 25, qrMm: 17, coChuPt: 6 },
  vua: { nhan: 'Vừa — 50×30mm (32 nhãn/trang)', rongMm: 50, caoMm: 30, qrMm: 21, coChuPt: 7.5 },
  lon: { nhan: 'Lớn — 70×40mm (15 nhãn/trang)', rongMm: 70, caoMm: 40, qrMm: 29, coChuPt: 10 },
};

interface NhanIn {
  code: string;
  name: string;
  anhQR: string;
}

export function InNhanQR() {
  const [thamSo] = useSearchParams();
  const maBanDau = thamSo.get('ma');

  const [thietBi, datThietBi] = useState<ThietBi[]>([]);
  const [daChon, datDaChon] = useState<Set<string>>(new Set(maBanDau ? [maBanDau] : []));
  const [tuKhoa, datTuKhoa] = useState('');
  const [coNhan, datCoNhan] = useState<CoNhan>('vua');
  const [soBanMoiMa, datSoBanMoiMa] = useState('1');
  const [nhan, datNhan] = useState<NhanIn[]>([]);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTai, datDangTai] = useState(true);

  useEffect(() => {
    async function tai(): Promise<void> {
      datDangTai(true);
      try {
        const q = new URLSearchParams({ moiTrang: '200' });
        if (tuKhoa.trim()) q.set('tuKhoa', tuKhoa.trim());
        const kq = await goiApi<TrangDuLieu<ThietBi>>(`/api/thiet-bi?${q.toString()}`);
        datThietBi(kq.muc);
      } catch (e) {
        datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách thiết bị.');
      } finally {
        datDangTai(false);
      }
    }
    void tai();
  }, [tuKhoa]);

  const danhSachChon = useMemo(
    () => thietBi.filter((t) => daChon.has(t.code)),
    [thietBi, daChon],
  );

  // Sinh ảnh QR cho các mã đang chọn.
  useEffect(() => {
    let conHieuLuc = true;
    async function sinh(): Promise<void> {
      const ketQua: NhanIn[] = [];
      for (const t of danhSachChon) {
        const anhQR = await QRCode.toDataURL(t.code, {
          errorCorrectionLevel: 'M',
          margin: 0,
          width: 320,
        });
        ketQua.push({ code: t.code, name: t.name, anhQR });
      }
      if (conHieuLuc) datNhan(ketQua);
    }
    void sinh().catch(() => {
      if (conHieuLuc) datLoi('Không tạo được mã QR.');
    });
    return () => {
      conHieuLuc = false;
    };
  }, [danhSachChon]);

  const doiChon = useCallback((code: string) => {
    datDaChon((cu) => {
      const moi = new Set(cu);
      if (moi.has(code)) moi.delete(code);
      else moi.add(code);
      return moi;
    });
  }, []);

  const cauHinh = CO_NHAN[coNhan];
  const soBan = Math.max(1, Math.min(20, Number(soBanMoiMa) || 1));
  const nhanIn = useMemo(
    () => nhan.flatMap((n) => Array.from({ length: soBan }, () => n)),
    [nhan, soBan],
  );

  return (
    <div className="space-y-4">
      {/* Khối điều khiển — ẩn khi in */}
      <div className="khong-in space-y-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/thiet-bi">
              <ArrowLeft aria-hidden />
              Về danh sách thiết bị
            </Link>
          </Button>
          <h1 className="text-xl font-semibold sm:text-2xl">In nhãn QR</h1>
          <p className="text-sm text-muted-foreground">
            Mã QR chứa đúng mã thiết bị. Chọn thiết bị, chọn cỡ nhãn rồi bấm In.
          </p>
        </div>

        {loi ? <Alert variant="destructive">{loi}</Alert> : null}

        <Card>
          <CardHeader>
            <CardTitle>Chọn thiết bị ({daChon.size} đã chọn)</CardTitle>
            <CardDescription>Tổng số nhãn sẽ in: {nhanIn.length}</CardDescription>
            <div className="grid gap-2 pt-2 sm:grid-cols-4">
              <div className="relative sm:col-span-2">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className="pl-9"
                  placeholder="Tìm theo mã hoặc tên…"
                  value={tuKhoa}
                  onChange={(su) => datTuKhoa(su.target.value)}
                  aria-label="Tìm thiết bị"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-nhan" className="sr-only">
                  Cỡ nhãn
                </Label>
                <Select
                  id="co-nhan"
                  value={coNhan}
                  onChange={(su) => datCoNhan(su.target.value as CoNhan)}
                  aria-label="Cỡ nhãn"
                >
                  {(Object.keys(CO_NHAN) as CoNhan[]).map((k) => (
                    <option key={k} value={k}>
                      {CO_NHAN[k].nhan}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="so-ban" className="sr-only">
                  Số bản mỗi mã
                </Label>
                <Input
                  id="so-ban"
                  type="number"
                  min={1}
                  max={20}
                  value={soBanMoiMa}
                  onChange={(su) => datSoBanMoiMa(su.target.value)}
                  aria-label="Số bản mỗi mã"
                  placeholder="Số bản mỗi mã"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => datDaChon(new Set(thietBi.map((t) => t.code)))}
              >
                Chọn tất cả ({thietBi.length})
              </Button>
              <Button variant="outline" size="sm" onClick={() => datDaChon(new Set())}>
                Bỏ chọn tất cả
              </Button>
              <Button
                className="ml-auto"
                disabled={nhanIn.length === 0}
                onClick={() => window.print()}
              >
                <Printer aria-hidden />
                In {nhanIn.length} nhãn
              </Button>
            </div>

            {dangTai ? (
              <p className="text-sm text-muted-foreground">Đang tải…</p>
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-md border">
                <ul className="divide-y">
                  {thietBi.map((t) => (
                    <li key={t.id}>
                      <label className="flex min-h-cham cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          className="size-4 accent-[hsl(var(--chinh))]"
                          checked={daChon.has(t.code)}
                          onChange={() => doiChon(t.code)}
                        />
                        <span className="font-mono text-sm">{t.code}</span>
                        <span className="truncate text-sm text-muted-foreground">{t.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {nhanIn.length > 0 ? (
          <Badge variant="muted">
            Xem trước bên dưới đúng bằng bản in. Trong hộp thoại in, chọn khổ A4 và bỏ tuỳ chọn
            “Headers and footers”.
          </Badge>
        ) : null}
      </div>

      {/* Vùng in */}
      <div
        className="trang-in"
        style={
          {
            '--nhan-rong': `${cauHinh.rongMm}mm`,
            '--nhan-cao': `${cauHinh.caoMm}mm`,
            '--qr-co': `${cauHinh.qrMm}mm`,
            '--nhan-chu': `${cauHinh.coChuPt}pt`,
          } as React.CSSProperties
        }
      >
        {nhanIn.map((n, i) => (
          <div className="nhan-qr" key={`${n.code}-${i}`}>
            <img src={n.anhQR} alt="" className="nhan-qr-anh" />
            <div className="nhan-qr-chu">
              <span className="nhan-qr-ma">{n.code}</span>
              <span className="nhan-qr-ten">{n.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
