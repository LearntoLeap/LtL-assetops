import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, TriangleAlert } from 'lucide-react';
import { NHAN_TINH_TRANG, type TinhTrang } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ChupAnh } from '@/components/ChupAnh';
import { NutQuetQR } from '@/components/QuetQR';
import { goiApi, LoiApi } from '@/lib/api';
import type { AnhDaTai } from '@/lib/anh';
import type { PhieuBaoHong, ThietBi } from '@/lib/kieu';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Tình trạng người báo được phép đề xuất — không cho chọn "Tốt" khi đang báo hỏng. */
const TINH_TRANG_DE_XUAT: readonly TinhTrang[] = ['CAN_BAO_TRI', 'HONG', 'MAT'];

type ThietBiTraCuu = Pick<ThietBi, 'code' | 'name'>;

export function FormBaoHong() {
  const dieuHuong = useNavigate();

  const [code, datCode] = useState('');
  const [thietBi, datThietBi] = useState<ThietBiTraCuu | null>(null);
  const [dangTraCuu, datDangTraCuu] = useState(false);
  const [loiTraCuu, datLoiTraCuu] = useState<string | null>(null);

  const [moTa, datMoTa] = useState('');
  const [tinhTrangDeXuat, datTinhTrangDeXuat] = useState<TinhTrang>('CAN_BAO_TRI');
  const [anh, datAnh] = useState<AnhDaTai[]>([]);

  const [loi, datLoi] = useState<string | null>(null);
  const [dangLuu, datDangLuu] = useState(false);

  async function traCuu(ma: string): Promise<void> {
    const sach = ma.trim().toUpperCase();
    datCode(sach);
    datThietBi(null);
    datLoiTraCuu(null);
    if (sach.length < 3) {
      datLoiTraCuu('Mã thiết bị phải có ít nhất 3 ký tự.');
      return;
    }
    datDangTraCuu(true);
    try {
      const kq = await goiApi<{ ok: true; thietBi: ThietBiTraCuu }>(
        `/api/thiet-bi/tra-cuu/${encodeURIComponent(sach)}`,
      );
      datThietBi(kq.thietBi);
    } catch (e) {
      datLoiTraCuu(e instanceof LoiApi ? e.message : 'Không tra cứu được mã thiết bị.');
    } finally {
      datDangTraCuu(false);
    }
  }

  async function guiPhieu(su: React.FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datDangLuu(true);
    try {
      const kq = await goiApi<{ ok: true; phieu: PhieuBaoHong }>('/api/bao-hong', {
        method: 'POST',
        than: {
          code: code.trim().toUpperCase(),
          moTa: moTa.trim(),
          anhIds: anh.map((a) => a.id),
          tinhTrangDeXuat,
        },
      });
      dieuHuong(`/bao-hong/${kq.phieu.id}`, { replace: true });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Gửi phiếu báo hỏng thất bại.');
    } finally {
      datDangLuu(false);
    }
  }

  const duGui = code.trim().length >= 3 && moTa.trim().length >= 10 && anh.length > 0;

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to="/bao-hong">
            <ArrowLeft aria-hidden />
            Về danh sách báo hỏng
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Báo hỏng thiết bị</h1>
        <p className="text-sm text-muted-foreground">
          Phiếu vào thẳng hàng chờ duyệt của quản trị. Bắt buộc có ảnh chụp chỗ hỏng.
        </p>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <form onSubmit={(su) => void guiPhieu(su)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Thiết bị bị hỏng</CardTitle>
            <CardDescription>
              Gõ mã in trên tem hoặc quét mã QR dán trên thiết bị.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bh-ma">Mã thiết bị</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="bh-ma"
                  required
                  className="font-mono sm:max-w-xs"
                  value={code}
                  placeholder="LTL-UGOT-0001"
                  onChange={(su) => {
                    datCode(su.target.value.toUpperCase());
                    datThietBi(null);
                  }}
                  onBlur={(su) => {
                    if (su.target.value.trim()) void traCuu(su.target.value);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void traCuu(code)}
                  disabled={dangTraCuu}
                >
                  {dangTraCuu ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
                  Tra cứu
                </Button>
                <NutQuetQR nhan="Quét QR" onQuetDuoc={(ma) => void traCuu(ma)} />
              </div>
            </div>
            {thietBi ? (
              <Alert variant="success" tieuDe={thietBi.code}>
                {thietBi.name}
              </Alert>
            ) : null}
            {loiTraCuu ? <Alert variant="warning">{loiTraCuu}</Alert> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mô tả hỏng hóc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bh-mo-ta">Hỏng thế nào (ít nhất 10 ký tự)</Label>
              <textarea
                id="bh-mo-ta"
                required
                minLength={10}
                rows={3}
                className={O_VAN_BAN}
                value={moTa}
                placeholder="Ví dụ: robot không lên nguồn, đèn báo pin nháy đỏ liên tục."
                onChange={(su) => datMoTa(su.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="bh-tinh-trang">Tình trạng bạn đánh giá</Label>
              <Select
                id="bh-tinh-trang"
                value={tinhTrangDeXuat}
                onChange={(su) => datTinhTrangDeXuat(su.target.value as TinhTrang)}
              >
                {TINH_TRANG_DE_XUAT.map((t) => (
                  <option key={t} value={t}>
                    {NHAN_TINH_TRANG[t]}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Quản trị kết luận tình trạng cuối cùng khi xử lý phiếu.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ảnh chỗ hỏng</CardTitle>
            <CardDescription>
              Bắt buộc có ít nhất một ảnh — không có ảnh thì không biết hỏng thế nào.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChupAnh
              kind="BAO_HONG"
              anh={anh}
              onDoiAnh={datAnh}
              moTa="Chụp rõ chỗ hỏng và mã dán trên thiết bị nếu được."
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="cham" disabled={dangLuu || !duGui}>
            {dangLuu ? <Loader2 className="animate-spin" aria-hidden /> : <TriangleAlert aria-hidden />}
            Gửi phiếu báo hỏng
          </Button>
          <Button type="button" variant="outline" size="cham" asChild>
            <Link to="/bao-hong">Huỷ</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
