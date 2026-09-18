import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Gauge,
  MapPin,
  Monitor,
  PackageOpen,
  RefreshCw,
  Warehouse,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { NHAN_LOAI_DIEM_LUU_TRU, NHAN_TINH_TRANG } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CotRaVao } from '@/components/bieu-do/CotRaVao';
import { ThanhNgang } from '@/components/bieu-do/ThanhNgang';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth, VAI_TRO_NHAP_LIEU } from '@/lib/auth';
import { so } from '@/lib/bieu-do';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import type { DiaDiem, DuLieuDashboard, TrangDuLieu } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';

function O({
  nhan,
  gia,
  phu,
  icon: Icon,
  mau,
  den,
}: {
  nhan: string;
  gia: number;
  phu?: string;
  icon: typeof Warehouse;
  mau?: string;
  den?: string;
}) {
  const noiDung = (
    <>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {nhan}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${mau ?? ''}`}>{so(gia)}</p>
      {phu ? <p className="text-xs text-muted-foreground">{phu}</p> : null}
    </>
  );
  return den ? (
    <Link
      to={den}
      className="rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-secondary/50"
    >
      {noiDung}
    </Link>
  ) : (
    <div className="rounded-lg border p-3">{noiDung}</div>
  );
}

/**
 * Dashboard — trang chủ của mọi vai trò (giai đoạn 6).
 *
 * Số liệu do server tính và LỌC THEO PHẠM VI: quản trị thấy toàn hệ thống, điểm
 * trường chỉ thấy số của trường mình. Giao diện không tự cộng lại con số nào.
 */
export function TongQuan() {
  const { nguoiDung } = useAuth();
  const [dl, datDl] = useState<DuLieuDashboard | null>(null);
  const [diaDiem, datDiaDiem] = useState<DiaDiem[] | null>(null);
  const [soNgay, datSoNgay] = useState(30);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTai, datDangTai] = useState(true);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<DuLieuDashboard>(`/api/bao-cao/dashboard?soNgay=${soNgay}`);
      datDl(kq);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được số liệu tổng quan.');
    } finally {
      datDangTai(false);
    }
  }, [soNgay]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useEffect(() => {
    goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem')
      .then((kq) => datDiaDiem(kq.muc))
      .catch(() => datDiaDiem([]));
  }, []);

  const { dangNoi } = useRealtime(
    [SU_KIEN.KHO_DOI, SU_KIEN.YEU_CAU_MOI, SU_KIEN.YEU_CAU_DOI, SU_KIEN.CANH_BAO_MOI],
    () => {
      void tai();
    },
  );

  const laKho = nguoiDung ? VAI_TRO_NHAP_LIEU.includes(nguoiDung.role) : false;
  const s = dl?.soLieu;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Xin chào, <span className="chu-xanh-chuyen">{nguoiDung?.fullName}</span>
          </h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            Số liệu dưới đây do máy chủ tính và lọc theo phạm vi của bạn.
            <span
              className={dangNoi ? 'text-success-dam' : 'text-muted-foreground'}
              title={dangNoi ? 'Đang đồng bộ realtime' : 'Mất kết nối realtime'}
            >
              {dangNoi ? (
                <Wifi className="size-3.5" aria-hidden />
              ) : (
                <WifiOff className="size-3.5" aria-hidden />
              )}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {laKho ? (
            <Button variant="accent" asChild>
              <Link to="/kiosk">
                <Monitor aria-hidden />
                Mở màn hình kho
              </Link>
            </Button>
          ) : null}
          {/* Đường vào chính của trang Tổng thể: thanh điều hướng đã hết chỗ,
              mà đây là nơi mọi vai trò đi qua ngay sau khi đăng nhập. */}
          <Button variant="outline" asChild>
            <Link to="/tong-the">
              <Gauge aria-hidden />
              Xem tổng thể
            </Link>
          </Button>
          <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
            <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
          </Button>
        </div>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {s ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <O nhan="Mã thiết bị" gia={s.soMa} icon={ClipboardList} den="/thiet-bi" />
          <O nhan="Đơn vị tại kho" gia={s.donViTaiKho} icon={Warehouse} />
          <O nhan="Đơn vị ở trường" gia={s.donViOTruong} icon={MapPin} />
          <O
            nhan="Đang cho mượn"
            gia={s.maChoMuon}
            phu="mã"
            icon={PackageOpen}
          />
          <O
            nhan="Quá hạn trả"
            gia={s.maQuaHan}
            phu="mã"
            icon={AlertTriangle}
            mau={s.maQuaHan > 0 ? 'text-destructive-dam' : ''}
          />
          <O
            nhan="Hỏng / mất"
            gia={s.maHong}
            phu={`${so(s.maCanBaoTri)} mã cần bảo trì`}
            icon={Wrench}
            mau={s.maHong > 0 ? 'text-destructive-dam' : ''}
            den="/bao-hong"
          />
        </div>
      ) : null}

      {s && (s.yeuCauChoDuyet > 0 || s.yeuCauChoXuat > 0 || s.bienBanChoXacNhan > 0) ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <O
            nhan="Yêu cầu chờ duyệt"
            gia={s.yeuCauChoDuyet}
            icon={ClipboardList}
            mau={s.yeuCauChoDuyet > 0 ? 'text-warning-dam' : ''}
            den="/yeu-cau?status=CHO_DUYET"
          />
          <O
            nhan="Đã duyệt, chờ xuất kho"
            gia={s.yeuCauChoXuat}
            icon={PackageOpen}
            mau={s.yeuCauChoXuat > 0 ? 'text-warning-dam' : ''}
            den="/yeu-cau?status=DA_DUYET"
          />
          <O
            nhan="Biên bản chờ xác nhận"
            gia={s.bienBanChoXacNhan}
            icon={FileSignature}
            mau={s.bienBanChoXacNhan > 0 ? 'text-warning-dam' : ''}
            den="/bbbg"
          />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Lưu chuyển kho theo ngày</CardTitle>
          <CardDescription>
            Mỗi bút toán trong nhật ký di chuyển được tính vào ngày thực hiện. Luân chuyển nội bộ
            tính cả hai đầu vì kho vừa xuất vừa nhận.
          </CardDescription>
          <div className="pt-2 sm:max-w-[13rem]">
            <Select
              value={String(soNgay)}
              onChange={(su) => datSoNgay(Number(su.target.value))}
              aria-label="Khoảng thời gian"
            >
              <option value="7">7 ngày gần nhất</option>
              <option value="30">30 ngày gần nhất</option>
              <option value="90">90 ngày gần nhất</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {dl ? (
            <CotRaVao dong={dl.raVao} />
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Theo loại thiết bị</CardTitle>
            <CardDescription>Đếm theo số mã, không cộng số lượng đơn vị.</CardDescription>
          </CardHeader>
          <CardContent>
            {dl ? <ThanhNgang dong={dl.theoLoai} donVi="mã" /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Theo dòng giải pháp</CardTitle>
            <CardDescription>uKit, UGOT, Stick&apos;Em, Alpha Mini…</CardDescription>
          </CardHeader>
          <CardContent>
            {dl ? <ThanhNgang dong={dl.theoDongGiaiPhap} donVi="mã" /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Phân bổ theo điểm lưu trữ</CardTitle>
            <CardDescription>Số lượng đơn vị suy ra từ nhật ký di chuyển.</CardDescription>
          </CardHeader>
          <CardContent>
            {dl ? <ThanhNgang dong={dl.theoDiaDiem} donVi="đơn vị" /> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle
                className={dl && dl.quaHan.length > 0 ? 'text-destructive-dam' : 'text-muted-foreground'}
                aria-hidden
              />
              Quá hạn trả ({dl?.quaHan.length ?? 0})
            </CardTitle>
            <CardDescription>Sắp theo ngày hẹn trả, trễ nhất lên trước.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-5">
            {!dl ? (
              <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
            ) : dl.quaHan.length === 0 ? (
              <p className="px-5 text-sm text-muted-foreground sm:px-0">
                Không có thiết bị nào quá hạn trả.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã</TableHead>
                      <TableHead>Đang ở / ai giữ</TableHead>
                      <TableHead>Hẹn trả</TableHead>
                      <TableHead className="text-right">Trễ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dl.quaHan.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link
                            to={`/thiet-bi/${t.id}`}
                            className="font-mono text-sm text-primary-dam hover:underline"
                          >
                            {t.code}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{t.name}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.nguoiGiu ?? t.noiDat ?? '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {ngay(t.dueReturnAt)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-destructive-dam">
                          {t.soNgayQuaHan} ngày
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="text-muted-foreground" aria-hidden />
              Thiết bị hỏng, mất và cần bảo trì ({dl?.thietBiHong.length ?? 0})
            </CardTitle>
            <CardDescription>Gộp từ tình trạng hiện tại của thiết bị.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-5">
            {!dl ? (
              <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
            ) : dl.thietBiHong.length === 0 ? (
              <p className="px-5 text-sm text-muted-foreground sm:px-0">
                Không có thiết bị nào đang hỏng hoặc cần bảo trì.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã</TableHead>
                      <TableHead>Tình trạng</TableHead>
                      <TableHead>Nơi đặt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dl.thietBiHong.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link
                            to={`/thiet-bi/${t.id}`}
                            className="font-mono text-sm text-primary-dam hover:underline"
                          >
                            {t.code}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{t.name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              t.condition === 'CAN_BAO_TRI'
                                ? 'warning'
                                : t.condition === 'MAT'
                                  ? 'destructive'
                                  : 'destructive'
                            }
                          >
                            {NHAN_TINH_TRANG[t.condition]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{t.noiDat ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="text-muted-foreground" aria-hidden />
              Kiểm kê gần nhất
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!dl ? (
              <p className="text-sm text-muted-foreground">Đang tải…</p>
            ) : !dl.kiemKeGanNhat ? (
              <p className="text-sm text-muted-foreground">
                Chưa có đợt kiểm kê nào được chốt.{' '}
                <Link to="/kiem-ke" className="text-primary-dam hover:underline">
                  Mở đợt kiểm kê
                </Link>
              </p>
            ) : (
              <div className="space-y-2 text-sm">
                <p>
                  <Link
                    to={`/kiem-ke/${dl.kiemKeGanNhat.id}`}
                    className="font-mono font-medium text-primary-dam hover:underline"
                  >
                    {dl.kiemKeGanNhat.code}
                  </Link>{' '}
                  · {dl.kiemKeGanNhat.name}
                </p>
                <p className="text-muted-foreground">
                  {dl.kiemKeGanNhat.diaDiem} · chốt {ngayGio(dl.kiemKeGanNhat.closedAt)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant={dl.kiemKeGanNhat.soMaLech > 0 ? 'destructive' : 'success'}>
                    {dl.kiemKeGanNhat.soMaLech} mã chênh lệch
                  </Badge>
                  <Badge variant="muted">Thiếu {so(dl.kiemKeGanNhat.tongThieu)}</Badge>
                  <Badge variant="muted">Thừa +{so(dl.kiemKeGanNhat.tongThua)}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-muted-foreground" aria-hidden />
              Điểm lưu trữ bạn xem được
            </CardTitle>
            <CardDescription>
              Danh sách này do máy chủ lọc theo vai trò — không phải do giao diện ẩn bớt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {diaDiem === null ? (
              <p className="text-sm text-muted-foreground">Đang tải…</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {diaDiem.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-3">
                    <span>
                      <span className="font-medium">{d.name}</span>
                      <span className="block text-xs text-muted-foreground">{d.code}</span>
                    </span>
                    <Badge variant="muted">{NHAN_LOAI_DIEM_LUU_TRU[d.type]}</Badge>
                  </li>
                ))}
                <li className="border-t pt-2 text-muted-foreground">
                  Tổng: <strong className="text-foreground">{diaDiem.length}</strong> điểm
                </li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
