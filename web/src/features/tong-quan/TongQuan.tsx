import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Gauge,
  Handshake,
  MapPin,
  Monitor,
  PackageCheck,
  PackageOpen,
  PartyPopper,
  RefreshCw,
  Truck,
  UserRound,
  Warehouse,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { NHAN_TINH_TRANG } from '@ltl/taisan-shared';
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
import { VanhKhuyen } from '@/components/bieu-do/VanhKhuyen';
import { MAU_TINH_TRANG } from '@/lib/bieu-do';
import { dem, moTaBienDong } from '@/lib/so-lieu';
import { BangTonTheoDiem } from './BangTonTheoDiem';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth, VAI_TRO_NHAP_LIEU } from '@/lib/auth';
import { so } from '@/lib/bieu-do';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import type { DuLieuDashboard, DongRaVao } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';

function O({
  nhan,
  gia,
  phu,
  icon: Icon,
  mau,
  den,
  bienDong,
}: {
  nhan: string;
  gia: number;
  phu?: string;
  icon: typeof Warehouse;
  mau?: string;
  den?: string;
  /** Dòng tăng / giảm trong kỳ, vd "7 ngày: +1 / −0 bộ · +200 / −80 lẻ". */
  bienDong?: string | null | undefined;
}) {
  const noiDung = (
    <>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {nhan}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${mau ?? ''}`}>{so(gia)}</p>
      {phu ? <p className="text-xs text-muted-foreground">{phu}</p> : null}
      {bienDong ? (
        <p className="mt-1 border-t pt-1 text-[11px] leading-tight text-muted-foreground">
          {bienDong}
        </p>
      ) : null}
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
  const [soNgay, datSoNgay] = useState(7);
  /** Biểu đồ lưu chuyển: cả hai, chỉ bộ, hay chỉ hàng lẻ. */
  const [kieuLuuChuyen, datKieuLuuChuyen] = useState<'tat-ca' | 'bo' | 'le'>('tat-ca');
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


  const { dangNoi } = useRealtime(
    [SU_KIEN.KHO_DOI, SU_KIEN.YEU_CAU_MOI, SU_KIEN.YEU_CAU_DOI, SU_KIEN.CANH_BAO_MOI],
    () => {
      void tai();
    },
  );

  const laKho = nguoiDung ? VAI_TRO_NHAP_LIEU.includes(nguoiDung.role) : false;
  const s = dl?.soLieu;
  const bd = dl?.bienDong;
  const nhanKy = `${soNgay} ngày`;
  const dongBienDong = (g: keyof NonNullable<typeof bd>): string | null => {
    const m = moTaBienDong(bd?.[g]);
    return m ? `${nhanKy}: ${m}` : null;
  };
  // Biểu đồ lưu chuyển theo kiểu: API cũ chưa tách thì dùng số gộp.
  const dongLuuChuyen: DongRaVao[] = (dl?.raVao ?? []).map((d) =>
    kieuLuuChuyen === 'bo'
      ? { ngay: d.ngay, vao: d.vaoBo ?? 0, ra: d.raBo ?? 0 }
      : kieuLuuChuyen === 'le'
        ? { ngay: d.ngay, vao: d.vaoLe ?? 0, ra: d.raLe ?? 0 }
        : d,
  );
  const coTachLuuChuyen = (dl?.raVao ?? []).some((d) => d.vaoBo !== undefined);
  const theoDiem = s?.theoDiem ?? [];

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
          {/* Kỳ so sánh dùng chung cho dòng tăng / giảm ở các ô và biểu đồ lưu chuyển. */}
          <Select
            className="w-auto"
            value={String(soNgay)}
            onChange={(su) => datSoNgay(Number(su.target.value))}
            aria-label="Kỳ so sánh tăng / giảm"
          >
            <option value="7">Tăng / giảm 7 ngày</option>
            <option value="30">Tăng / giảm 30 ngày</option>
            <option value="90">Tăng / giảm 90 ngày</option>
          </Select>
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
          <O
            nhan="Mã thiết bị"
            gia={s.soMa}
            phu={
              s.soMaBo !== undefined
                ? `${so(s.soMaBo)} mã bộ · ${so(s.soMaLe ?? 0)} mã hàng lẻ`
                : 'mã'
            }
            icon={ClipboardList}
            den="/thiet-bi"
          />
          {/* Tách BỘ và LẺ: cộng 1 bộ robot với 200 quyển sách thành "201 đơn
              vị" là con số không dùng được vào việc gì. */}
          <O
            nhan="Tại kho"
            gia={s.taiKho.bo}
            phu={`bộ · ${so(s.taiKho.le)} hàng lẻ`}
            icon={Warehouse}
            bienDong={dongBienDong('taiKho')}
            den="/ton-kho?loaiDiem=KHO_VAN_PHONG"
          />
          <O
            nhan="Ở trường"
            gia={s.oTruong.bo}
            phu={`bộ · ${so(s.oTruong.le)} hàng lẻ`}
            icon={MapPin}
            bienDong={dongBienDong('oTruong')}
            den="/ton-kho?loaiDiem=DIEM_TRUONG"
          />
          {/* Hàng đã rời kho nhưng bên nhận chưa xác nhận. Phải có ô riêng:
              không hiện ở đâu thì bấm "xuất kho" xong dashboard đứng im, người
              dùng tưởng máy không ghi nhận. */}
          <O
            nhan="Đang chuyển"
            gia={dem(s.dangChuyen).bo}
            phu={`bộ · ${so(dem(s.dangChuyen).le)} hàng lẻ`}
            icon={Truck}
            bienDong={dongBienDong('dangChuyen')}
            den="/yeu-cau?status=DA_XUAT"
          />
          {/* Hai ô dưới đây trước kia KHÔNG tồn tại: hàng ở kho sự kiện bị gộp
              vào "Tại kho", còn hàng ở chỗ đối tác thì không được đếm vào ô nào
              cả. Nên xuất kho đi hai nơi đó xong, trang chủ trông như chưa có gì
              xảy ra. Giờ bốn loại điểm là bốn ô riêng — cộng với "đang chuyển"
              và "đang cho mượn" là đủ mọi chỗ thiết bị có thể nằm. */}
          <O
            nhan="Ở kho sự kiện"
            gia={dem(s.oSuKien).bo}
            phu={`bộ · ${so(dem(s.oSuKien).le)} hàng lẻ`}
            icon={PartyPopper}
            bienDong={dongBienDong('oSuKien')}
            den="/ton-kho?loaiDiem=KHO_SU_KIEN"
          />
          <O
            nhan="Ở chỗ đối tác"
            gia={dem(s.oDoiTac).bo}
            phu={`bộ · ${so(dem(s.oDoiTac).le)} hàng lẻ`}
            icon={Handshake}
            bienDong={dongBienDong('oDoiTac')}
            den="/ton-kho?loaiDiem=DOI_TAC_MUON"
          />
          {/* Hàng nhân sự đang mượn — đã ra khỏi kho, chưa trả. Trước đây chỉ đếm
              số MÃ, nên cho mượn 5 quyển trong 100 quyển thì không thấy ở đâu. */}
          <O
            nhan="Nhân sự đang mượn"
            gia={s.nhanSuGiu ? s.nhanSuGiu.bo : s.maChoMuon}
            phu={s.nhanSuGiu ? `bộ · ${so(s.nhanSuGiu.le)} hàng lẻ` : 'mã'}
            icon={UserRound}
            bienDong={dongBienDong('nhanSu')}
            den="/thiet-bi?allocationStatus=CHO_MUON"
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

      {s ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Không còn bước duyệt: việc đang chờ là XUẤT kho và NHẬP kho. API cũ
              chưa có hai số này thì dùng số "chờ duyệt + đã duyệt" như trước. */}
          <O
            nhan="Phiếu chờ xuất kho"
            gia={s.choXuatKho ?? s.yeuCauChoDuyet + s.yeuCauChoXuat}
            icon={PackageOpen}
            mau={(s.choXuatKho ?? s.yeuCauChoXuat) > 0 ? 'text-warning-dam' : ''}
            phu="chụp ảnh xác nhận là xong, không chờ duyệt"
            den="/yeu-cau?status=BAN_NHAP"
          />
          <O
            nhan="Phiếu chờ nhập kho"
            gia={s.choNhapKho ?? 0}
            icon={PackageCheck}
            mau={(s.choNhapKho ?? 0) > 0 ? 'text-warning-dam' : ''}
            phu="hàng về kho, nhân sự trả lại"
            den="/yeu-cau?status=BAN_NHAP&type=NHAP_KHO"
          />
          <O
            nhan="Biên bản chờ xác nhận"
            gia={s.bienBanChoXacNhan}
            icon={FileSignature}
            mau={s.bienBanChoXacNhan > 0 ? 'text-warning-dam' : ''}
            phu="bên nhận chưa bấm xác nhận"
            den="/bbbg"
          />
        </div>
      ) : null}

      {/* SỐ LƯỢNG TẠI TỪNG ĐIỂM — mỗi kho, mỗi trường một dòng, tách bộ / lẻ, có
          bộ lọc. Các ô ở trên gộp theo loại điểm; bảng này cho biết từng nơi. */}
      <BangTonTheoDiem nhung />

      <Card>
        <CardHeader>
          <CardTitle>Lưu chuyển theo ngày ({soNgay} ngày)</CardTitle>
          <CardDescription>
            Vào / ra tại các điểm bạn xem được, tính theo ngày giờ Việt Nam. Chọn xem riêng bộ
            hoặc hàng lẻ — cộng robot với sách thành một cột thì không đọc được gì.
          </CardDescription>
          {coTachLuuChuyen ? (
            <div className="flex flex-wrap gap-1 pt-2">
              {(
                [
                  ['tat-ca', 'Tất cả'],
                  ['bo', 'Chỉ bộ'],
                  ['le', 'Chỉ hàng lẻ'],
                ] as const
              ).map(([ma, nhan]) => (
                <Button
                  key={ma}
                  size="sm"
                  variant={kieuLuuChuyen === ma ? 'default' : 'outline'}
                  onClick={() => datKieuLuuChuyen(ma)}
                  aria-pressed={kieuLuuChuyen === ma}
                >
                  {nhan}
                </Button>
              ))}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {dl ? (
            <CotRaVao dong={dongLuuChuyen} />
          ) : (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Tình trạng thiết bị</CardTitle>
            <CardDescription>
              Mỗi mã thuộc đúng một tình trạng, cộng lại là tổng số mã đang theo dõi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dl ? (
              <VanhKhuyen
                phan={dl.theoTinhTrang.map((d) => ({
                  ...d,
                  mau: MAU_TINH_TRANG[d.ma] ?? 'var(--viz-thu-tu-3)',
                }))}
                donVi="mã"
                nhanTong="mã thiết bị"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bộ và hàng lẻ</CardTitle>
            <CardDescription>
              Thiết bị dán mã theo từng bộ, và hàng lẻ đếm theo số lượng (sách, cờ, standee).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dl ? (
              <VanhKhuyen
                phan={dl.theoKieuQuanLy.map((d) => ({
                  ...d,
                  mau: d.ma === 'DON_VI' ? 'var(--viz-chuoi-1)' : 'var(--viz-chuoi-2)',
                }))}
                donVi="mã"
                nhanTong="mã thiết bị"
              />
            ) : null}
          </CardContent>
        </Card>

        {/* TÌNH TRẠNG PHÂN BỔ — đủ cả năm, cộng lại đúng bằng số mã.
            Trước đây trang chủ chỉ hiện đúng một trạng thái ("đang cho mượn"),
            nên thiết bị chuyển sang "Đang vận chuyển" hay "Đang phục vụ sự kiện"
            thì không thấy ở đâu cả — nhìn như máy không ghi nhận gì. */}
        <Card>
          <CardHeader>
            <CardTitle>Tình trạng phân bổ</CardTitle>
            <CardDescription>
              Mỗi mã thuộc đúng một tình trạng. Xuất kho, nhập kho hay bàn giao xong là con số
              ở đây đổi ngay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dl ? <ThanhNgang dong={dl.theoPhanBo ?? []} donVi="mã" /> : null}
          </CardContent>
        </Card>

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
        {/* Theo điểm — TÁCH bộ và hàng lẻ. Trước đây cộng 1 robot với 200 quyển
            sách thành "201 đơn vị". API cũ chưa tách thì giữ biểu đồ cũ. */}
        <Card>
          <CardHeader>
            <CardTitle>Theo điểm lưu trữ</CardTitle>
            <CardDescription>
              {theoDiem.length > 0 ? 'Bộ và hàng lẻ tách riêng.' : 'Số lượng suy ra từ nhật ký di chuyển.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!dl ? null : theoDiem.length > 0 ? (
              <>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Bộ</p>
                  <ThanhNgang
                    dong={theoDiem
                      .filter((d) => d.bo > 0)
                      .map((d) => ({ ma: d.id, nhan: d.ten, so: d.bo }))
                      .sort((a, b) => b.so - a.so)}
                    donVi="bộ"
                    toiDaDong={12}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Hàng lẻ</p>
                  <ThanhNgang
                    dong={theoDiem
                      .filter((d) => d.le > 0)
                      .map((d) => ({ ma: d.id, nhan: d.ten, so: d.le }))
                      .sort((a, b) => b.so - a.so)}
                    donVi="cái"
                    toiDaDong={12}
                  />
                </div>
              </>
            ) : (
              <ThanhNgang dong={dl.theoDiaDiem} donVi="đơn vị" />
            )}
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

      </div>
    </div>
  );
}
