import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileSignature, Loader2 } from 'lucide-react';
import { NHAN_LOAI_YEU_CAU, NHAN_TINH_TRANG } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
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
import type { BienBan, DiaDiem, TrangDuLieu, YeuCau } from '@/lib/kieu';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function homNay(): string {
  const d = new Date();
  const thang = String(d.getMonth() + 1).padStart(2, '0');
  const ngayTrongThang = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${thang}-${ngayTrongThang}`;
}

/**
 * Lập biên bản bàn giao từ một yêu cầu ĐÃ XUẤT KHO.
 *
 * Danh sách thiết bị không nhập tay: server tự chụp lại mã, tên và tình trạng
 * của từng thiết bị trong yêu cầu tại đúng thời điểm lập biên bản.
 */
export function FormBienBan() {
  const dieuHuong = useNavigate();
  const [thamSo] = useSearchParams();
  const { nguoiDung } = useAuth();

  const [dsYeuCau, datDsYeuCau] = useState<YeuCau[]>([]);
  const [dsDiaDiem, datDsDiaDiem] = useState<DiaDiem[]>([]);
  const [dangTaiDs, datDangTaiDs] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangLuu, datDangLuu] = useState(false);

  const [requestId, datRequestId] = useState(thamSo.get('yeuCau') ?? '');
  const [giverName, datGiverName] = useState(nguoiDung?.fullName ?? '');
  const [giverTitle, datGiverTitle] = useState('');
  const [giverOrg, datGiverOrg] = useState('Công ty Learn to Leap');
  const [receiverOrg, datReceiverOrg] = useState('');
  const [receiverName, datReceiverName] = useState('');
  const [receiverTitle, datReceiverTitle] = useState('');
  const [receiverPhone, datReceiverPhone] = useState('');
  const [issuedDate, datIssuedDate] = useState(homNay());
  const [note, datNote] = useState('');

  const tai = useCallback(async () => {
    datDangTaiDs(true);
    datLoi(null);
    try {
      const [ycXuat, ycXong, dd] = await Promise.all([
        goiApi<TrangDuLieu<YeuCau>>('/api/yeu-cau?status=DA_XUAT&moiTrang=100'),
        goiApi<TrangDuLieu<YeuCau>>('/api/yeu-cau?status=DA_HOAN_TAT&moiTrang=100'),
        goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true'),
      ]);
      datDsYeuCau([...ycXuat.muc, ...ycXong.muc]);
      datDsDiaDiem(dd.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách yêu cầu đã xuất kho.');
    } finally {
      datDangTaiDs(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  const yeuCau = useMemo(() => dsYeuCau.find((y) => y.id === requestId) ?? null, [dsYeuCau, requestId]);

  // Điền sẵn bên nhận theo điểm đến của yêu cầu — người lập vẫn sửa được.
  useEffect(() => {
    if (!yeuCau?.toLocation) return;
    const diem = dsDiaDiem.find((d) => d.id === yeuCau.toLocation?.id);
    datReceiverOrg(yeuCau.toLocation.name);
    if (diem?.contactName) datReceiverName(diem.contactName);
    if (diem?.contactPhone) datReceiverPhone(diem.contactPhone);
  }, [yeuCau, dsDiaDiem]);

  async function luu(su: React.FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datDangLuu(true);
    try {
      const kq = await goiApi<{ ok: true; bbbg: BienBan }>('/api/bbbg', {
        method: 'POST',
        than: {
          requestId,
          giverName: giverName.trim(),
          giverTitle: giverTitle.trim(),
          giverOrg: giverOrg.trim(),
          receiverOrg: receiverOrg.trim(),
          receiverName: receiverName.trim(),
          receiverTitle: receiverTitle.trim(),
          receiverPhone: receiverPhone.trim(),
          issuedDate,
          note: note.trim(),
        },
      });
      dieuHuong(`/bbbg/${kq.bbbg.id}`, { replace: true });
    } catch (e) {
      // Yêu cầu đã có biên bản: đưa thẳng sang biên bản đó cho khỏi phải tự tìm.
      if (e instanceof LoiApi && e.maHttp === 409 && typeof e.chiTiet?.['bbbgId'] === 'string') {
        dieuHuong(`/bbbg/${String(e.chiTiet['bbbgId'])}`, { replace: true });
        return;
      }
      datLoi(e instanceof LoiApi ? e.message : 'Lập biên bản thất bại.');
    } finally {
      datDangLuu(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to="/bbbg">
            <ArrowLeft aria-hidden />
            Về danh sách biên bản
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Lập biên bản bàn giao</h1>
        <p className="text-sm text-muted-foreground">
          Biên bản chỉ lập được từ yêu cầu đã xuất kho. Danh sách thiết bị lấy tự động từ yêu cầu.
        </p>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <form onSubmit={(su) => void luu(su)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Yêu cầu nguồn</CardTitle>
            <CardDescription>
              Chỉ hiện yêu cầu đang ở trạng thái Đã xuất hoặc Đã hoàn tất.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bb-yeu-cau">Yêu cầu</Label>
              <Select
                id="bb-yeu-cau"
                required
                value={requestId}
                onChange={(su) => datRequestId(su.target.value)}
                disabled={dangTaiDs}
              >
                <option value="">
                  {dangTaiDs ? 'Đang tải…' : '— Chọn yêu cầu đã xuất kho —'}
                </option>
                {dsYeuCau.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.code} · {NHAN_LOAI_YEU_CAU[y.type]} ·{' '}
                    {y.toLocation?.name ?? y.destinationNote ?? 'chưa rõ nơi đến'} ·{' '}
                    {y.items.length} dòng
                  </option>
                ))}
              </Select>
              {!dangTaiDs && dsYeuCau.length === 0 ? (
                <p className="text-sm text-warning-dam">
                  Chưa có yêu cầu nào đã xuất kho. Hãy xuất kho xong rồi quay lại lập biên bản.
                </p>
              ) : null}
            </div>

            {yeuCau ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã thiết bị</TableHead>
                      <TableHead>Tên thiết bị</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead>Tình trạng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yeuCau.items.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm">{m.asset.code}</TableCell>
                        <TableCell className="text-muted-foreground">{m.asset.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.quantity}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {NHAN_TINH_TRANG[m.asset.condition]}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Bên giao</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bb-giao-ten">Họ tên người giao</Label>
                <Input
                  id="bb-giao-ten"
                  required
                  minLength={2}
                  value={giverName}
                  onChange={(su) => datGiverName(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bb-giao-cv">Chức vụ</Label>
                <Input
                  id="bb-giao-cv"
                  value={giverTitle}
                  placeholder="Chuyên viên vận hành"
                  onChange={(su) => datGiverTitle(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bb-giao-dv">Đơn vị bên giao</Label>
                <Input
                  id="bb-giao-dv"
                  required
                  minLength={2}
                  value={giverOrg}
                  onChange={(su) => datGiverOrg(su.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bên nhận</CardTitle>
              <CardDescription>
                Điền sẵn theo điểm đến của yêu cầu; sửa lại nếu người nhận thực tế khác.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bb-nhan-dv">Đơn vị bên nhận</Label>
                <Input
                  id="bb-nhan-dv"
                  required
                  minLength={2}
                  value={receiverOrg}
                  onChange={(su) => datReceiverOrg(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bb-nhan-ten">Họ tên người nhận</Label>
                <Input
                  id="bb-nhan-ten"
                  required
                  minLength={2}
                  value={receiverName}
                  onChange={(su) => datReceiverName(su.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bb-nhan-cv">Chức vụ</Label>
                  <Input
                    id="bb-nhan-cv"
                    value={receiverTitle}
                    placeholder="Hiệu trưởng"
                    onChange={(su) => datReceiverTitle(su.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bb-nhan-dt">Số điện thoại</Label>
                  <Input
                    id="bb-nhan-dt"
                    inputMode="tel"
                    value={receiverPhone}
                    placeholder="0912345678"
                    onChange={(su) => datReceiverPhone(su.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin biên bản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="bb-ngay">Ngày lập biên bản</Label>
              <Input
                id="bb-ngay"
                type="date"
                required
                value={issuedDate}
                onChange={(su) => datIssuedDate(su.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bb-ghi-chu">Ghi chú</Label>
              <textarea
                id="bb-ghi-chu"
                rows={2}
                className={O_VAN_BAN}
                value={note}
                placeholder="Ví dụ: giao kèm 2 dây nguồn dự phòng."
                onChange={(su) => datNote(su.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Nội dung cam kết mặc định sẽ được điền sẵn và sửa được ở bước sau, khi biên bản còn là
              bản nháp.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={dangLuu || !requestId}>
            {dangLuu ? <Loader2 className="animate-spin" aria-hidden /> : <FileSignature aria-hidden />}
            Lập biên bản
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/bbbg">Huỷ</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
