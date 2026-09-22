import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, QrCode, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import {
  NHAN_KIEU_QUAN_LY,
  NHAN_LOAI_DI_CHUYEN,
  NHAN_MUC_DICH_SU_DUNG,
  NHAN_NGUON_GOC,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_PHAN_BO,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HoSoThietBi } from '@/features/wiki/HoSoThietBi';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import type { ChiTietThietBi } from '@/lib/kieu';
import { MAU_PHAN_BO, MAU_TINH_TRANG, tienVN } from './ThietBiList';

function Muc({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export function ThietBiChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { nguoiDung } = useAuth();
  const dieuHuong = useNavigate();
  const duocSua =
    nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH' || nguoiDung?.role === 'KHO';

  const [duLieu, datDuLieu] = useState<ChiTietThietBi | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [anhQR, datAnhQR] = useState<string | null>(null);

  const tai = useCallback(async () => {
    if (!id) return;
    datLoi(null);
    try {
      datDuLieu(await goiApi<ChiTietThietBi>(`/api/thiet-bi/${id}`));
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được thiết bị.');
    }
  }, [id]);

  useEffect(() => {
    void tai();
  }, [tai]);

  // Sinh QR ngay trên máy người dùng — không cần gọi server cho mỗi nhãn.
  useEffect(() => {
    const ma = duLieu?.thietBi.code;
    if (!ma) return;
    let conHieuLuc = true;
    void QRCode.toDataURL(ma, { errorCorrectionLevel: 'M', margin: 1, width: 220 })
      .then((url) => {
        if (conHieuLuc) datAnhQR(url);
      })
      .catch(() => {
        if (conHieuLuc) datAnhQR(null);
      });
    return () => {
      conHieuLuc = false;
    };
  }, [duLieu?.thietBi.code]);

  async function xoa(): Promise<void> {
    if (!duLieu) return;
    // Đây là chuyển vào thùng rác, không phải xoá hẳn — nói đúng việc sắp xảy ra.
    if (
      !window.confirm(
        `Chuyển thiết bị ${duLieu.thietBi.code} vào thùng rác?\n\n` +
          'Khôi phục lại được ở Thiết bị → Thùng rác.',
      )
    ) {
      return;
    }
    try {
      await goiApi(`/api/thiet-bi/${duLieu.thietBi.id}`, { method: 'DELETE' });
      dieuHuong('/thiet-bi', { replace: true });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá thất bại.');
    }
  }

  if (loi && !duLieu) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/thiet-bi">
            <ArrowLeft aria-hidden />
            Về danh sách
          </Link>
        </Button>
        <Alert variant="destructive" tieuDe="Không mở được thiết bị">
          {loi}
        </Alert>
      </div>
    );
  }

  if (!duLieu) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const t = duLieu.thietBi;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/thiet-bi">
              <ArrowLeft aria-hidden />
              Về danh sách
            </Link>
          </Button>
          <h1 className="font-mono text-xl font-semibold sm:text-2xl">{t.code}</h1>
          <p className="text-muted-foreground">{t.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/thiet-bi/in-nhan?ma=${encodeURIComponent(t.code)}`}>
              <QrCode aria-hidden />
              In nhãn
            </Link>
          </Button>
          {duocSua ? (
            <Button variant="outline" asChild>
              <Link to={`/thiet-bi/${t.id}/sua`}>
                <Pencil aria-hidden />
                Sửa
              </Link>
            </Button>
          ) : null}
          {nguoiDung?.role === 'ADMIN' ? (
            <Button
              variant="outline"
              className="text-destructive-dam"
              onClick={() => void xoa()}
            >
              <Trash2 aria-hidden />
              Xoá
            </Button>
          ) : null}
        </div>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {!t.isActive ? (
        <Alert variant="warning" tieuDe="Thiết bị đã ngừng theo dõi">
          Thiết bị vẫn còn trong hệ thống để giữ lịch sử, nhưng không xuất hiện ở danh sách mặc định.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Thông tin thiết bị</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Muc nhan="Loại tài sản">{t.category.name}</Muc>
              <Muc nhan="Dòng giải pháp">{t.productLine?.name ?? '—'}</Muc>
              <Muc nhan="Serial NSX">{t.serialNumber ?? '—'}</Muc>
              <Muc nhan="Nguồn gốc">
                {NHAN_NGUON_GOC[t.origin]}
                {t.originNote ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {t.originNote}
                  </span>
                ) : null}
              </Muc>
              <Muc nhan="Ngày nhập">{ngay(t.receivedDate)}</Muc>
              <Muc nhan="Giá trị">{tienVN(t.value)} đ</Muc>
              <Muc nhan="Mục đích sử dụng">{NHAN_MUC_DICH_SU_DUNG[t.purpose]}</Muc>
              <Muc nhan="Kiểu quản lý">{NHAN_KIEU_QUAN_LY[t.trackingType]}</Muc>
              <Muc nhan="Vị trí hiện tại">
                {t.currentLocation?.name ??
                  (t.holder ? `Đang do ${t.holder.fullName} giữ` : '—')}
              </Muc>
              <Muc nhan="Tình trạng">
                <Badge variant={MAU_TINH_TRANG[t.condition]}>{NHAN_TINH_TRANG[t.condition]}</Badge>
              </Muc>
              <Muc nhan="Trạng thái phân bổ">
                <Badge variant={MAU_PHAN_BO[t.allocationStatus]}>
                  {NHAN_TRANG_THAI_PHAN_BO[t.allocationStatus]}
                </Badge>
              </Muc>
              <Muc nhan="Người đang giữ">{t.holder?.fullName ?? '—'}</Muc>
              <Muc nhan="Hạn trả">{ngay(t.dueReturnAt)}</Muc>
            </dl>
            {t.note ? (
              <div className="mt-4 rounded-md bg-muted p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Ghi chú chi tiết theo bộ
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{t.note}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tồn kho</CardTitle>
              <CardDescription>
                Suy ra từ nhật ký di chuyển — không có cột số tồn nào trong CSDL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{duLieu.tonKho.tongTon}</p>
              <p className="mb-3 text-sm text-muted-foreground">
                đơn vị đang nằm tại các điểm lưu trữ
              </p>
              {t.holder ? (
                <Alert variant="info" className="mb-3">
                  Thiết bị đã rời điểm lưu trữ và đang do <strong>{t.holder.fullName}</strong> giữ,
                  nên không tính vào tồn của điểm nào. Khi trả về kho, tồn sẽ được khôi phục.
                </Alert>
              ) : null}
              <ul className="space-y-1 text-sm">
                {duLieu.tonKho.theoDiaDiem.length === 0 ? (
                  <li className="text-muted-foreground">
                    {t.holder ? 'Đang trong tay người giữ.' : 'Không còn tồn ở điểm nào.'}
                  </li>
                ) : (
                  duLieu.tonKho.theoDiaDiem.map((d) => (
                    <li key={d.locationId} className="flex justify-between gap-3 border-b py-1">
                      <span>{d.tenDiaDiem}</span>
                      <span className="font-medium tabular-nums">{d.ton}</span>
                    </li>
                  ))
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nhãn QR</CardTitle>
              <CardDescription>Nội dung mã QR chính là mã thiết bị.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              {anhQR ? (
                <img src={anhQR} alt={`Mã QR của ${t.code}`} className="size-40" />
              ) : (
                <p className="text-sm text-muted-foreground">Đang tạo mã…</p>
              )}
              <p className="font-mono text-sm">{t.code}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Wiki phải tự tìm đến người dùng: ai cũng mở trang thiết bị, không ai
          nhớ vào /wiki. Cảnh báo nguy hiểm hiện thẳng ở đây. */}
      <HoSoThietBi assetId={t.id} />

      <Card>
        <CardHeader>
          <CardTitle>Nhật ký di chuyển ({duLieu.lichSu.length})</CardTitle>
          <CardDescription>Mới nhất ở trên. Đây là nguồn sự thật của tồn kho.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời điểm</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Từ</TableHead>
                <TableHead>Đến</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duLieu.lichSu.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {ngayGio(d.performedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{NHAN_LOAI_DI_CHUYEN[d.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.fromLocation?.name ?? 'Ngoài hệ thống'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.toLocation?.name ?? 'Ra khỏi hệ thống'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{d.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.performedBy?.fullName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
