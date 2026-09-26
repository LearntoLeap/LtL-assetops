import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Gauge,
  History,
  MapPin,
  PackageOpen,
  RefreshCw,
  Timer,
  Warehouse,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react';
import {
  NHAN_LOAI_DIEM_LUU_TRU,
  NHAN_LOAI_YEU_CAU,
  NHAN_TRANG_THAI_YEU_CAU,
  type LoaiDiemLuuTru,
  type LoaiYeuCau,
  type TrangThaiYeuCau,
} from '@ltl/taisan-shared';
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
import { CotHaiChuoi } from '@/components/bieu-do/CotHaiChuoi';
import { ThanhChong } from '@/components/bieu-do/ThanhChong';
import { ThanhNgang } from '@/components/bieu-do/ThanhNgang';
import { goiApi, LoiApi } from '@/lib/api';
import { so } from '@/lib/bieu-do';
import { ngayGio } from '@/lib/dinh-dang';
import type { DuLieuTongThe } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';

/** Các bước yêu cầu theo dải màu THỨ TỰ — bước sau đậm hơn bước trước. */
const MAU_BUOC: Record<string, string> = {
  BAN_NHAP: 'var(--viz-thu-tu-1)',
  CHO_DUYET: 'var(--viz-thu-tu-2)',
  DA_DUYET: 'var(--viz-thu-tu-3)',
  DA_XUAT: 'var(--viz-thu-tu-4)',
  DA_HOAN_TAT: 'var(--viz-thu-tu-5)',
};

/**
 * "3,5 giờ" / "40 phút" / "2 ngày 4 giờ" — số giờ thô đọc rất khó, nhất là khi
 * dưới một giờ thì làm tròn một chữ số thập phân ra "0 giờ".
 */
function khoangThoiGian(gio: number | null): string {
  if (gio === null) return 'chưa có số liệu';
  if (gio < 1) return `${Math.max(1, Math.round(gio * 60))} phút`;
  if (gio < 48) return `${Math.round(gio * 10) / 10} giờ`;
  const ngay = Math.floor(gio / 24);
  const conLai = Math.round(gio - ngay * 24);
  return conLai > 0 ? `${ngay} ngày ${conLai} giờ` : `${ngay} ngày`;
}

function O({
  nhan,
  gia,
  phu,
  icon: Icon,
  mau,
  den,
}: {
  nhan: string;
  gia: number | string;
  phu?: string;
  icon: typeof Warehouse;
  mau?: string;
  den?: string;
}) {
  const noiDung = (
    <>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 flex-none" aria-hidden />
        <span className="truncate">{nhan}</span>
      </p>
      <p className={`mt-1 text-2xl font-semibold ${mau ?? ''}`}>
        {typeof gia === 'number' ? so(gia) : gia}
      </p>
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
 * DASHBOARD TỔNG THỂ.
 *
 * Trang chủ chỉ nhìn TÀI SẢN — bao nhiêu mã, nằm ở đâu, cái nào hỏng. Trang này
 * nhìn CẢ GUỒNG: đang tắc ở đâu, xử lý báo hỏng có theo kịp lượng việc phát sinh
 * không, điểm nào ngốn linh kiện, mất bao lâu để duyệt một yêu cầu.
 *
 * Toàn bộ số do máy chủ tính và lọc theo phạm vi vai trò: điểm trường mở trang
 * này chỉ thấy số của trường mình. Giao diện không tự cộng lại con số nghiệp vụ
 * nào — riêng ô lớn đầu trang là tổng của sáu ô "đang chờ" ngay dưới nó, cộng ở
 * đây cho đúng nghĩa "tổng số việc đang chờ người".
 */
export function TongThe() {
  const [dl, datDl] = useState<DuLieuTongThe | null>(null);
  const [soNgay, datSoNgay] = useState(30);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangTai, datDangTai] = useState(true);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<DuLieuTongThe>(`/api/bao-cao/tong-the?soNgay=${soNgay}`);
      datDl(kq);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được số liệu tổng thể.');
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

  const c = dl?.dangCho;
  const tongDangCho = c
    ? c.yeuCauChoDuyet +
      c.yeuCauChoXuat +
      c.bienBanChoXacNhan +
      c.kiemKeDangMo +
      c.baoHongDangMo +
      c.thietBiQuaHan
    : 0;

  const doanBuoc = (dl?.yeuCauTheoBuoc ?? []).map((b) => ({
    ma: b.ma,
    nhan: NHAN_TRANG_THAI_YEU_CAU[b.ma as TrangThaiYeuCau] ?? b.ma,
    so: b.so,
    mau: MAU_BUOC[b.ma] ?? 'var(--viz-thu-tu-3)',
  }));

  const dongLoai = (dl?.yeuCauTheoLoai ?? []).map((l) => ({
    ma: l.ma,
    nhan: NHAN_LOAI_YEU_CAU[l.ma as LoaiYeuCau] ?? l.ma,
    so: l.so,
  }));

  return (
    <div className="space-y-5">
      {/* Một hàng điều khiển duy nhất, đặt TRÊN mọi biểu đồ: đổi khoảng thời gian
          là mọi con số bên dưới đổi theo, nên không rải bộ chọn vào từng thẻ. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Tổng thể <span className="chu-xanh-chuyen">vận hành</span>
          </h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Cả guồng trong một trang: chỗ đang tắc, tốc độ xử lý, điểm cần để mắt.
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
          <Select
            value={String(soNgay)}
            onChange={(su) => datSoNgay(Number(su.target.value))}
            aria-label="Khoảng thời gian"
            className="w-[11.5rem]"
          >
            <option value="7">7 ngày gần nhất</option>
            <option value="30">30 ngày gần nhất</option>
            <option value="90">90 ngày gần nhất</option>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
            <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
          </Button>
        </div>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {dl === null ? (
        <p className="text-sm text-muted-foreground">Đang tải số liệu…</p>
      ) : (
        /* Đang tải lại thì GIỮ NGUYÊN khung cũ và làm mờ, không thay bằng ô
           trống: số cũ vẫn đọc được và trang không nhảy chỗ. */
        <div
          className={`space-y-5 transition-opacity ${dangTai ? 'opacity-60' : 'opacity-100'}`}
          aria-busy={dangTai}
        >
          {/* --- Ô LỚN: con số trang này dẫn đầu, kèm sáu chỗ tắc cụ thể. */}
          <Card>
            <CardHeader>
              <CardTitle>Việc đang chờ người</CardTitle>
              <CardDescription>
                Mỗi ô là một chỗ công việc đứng lại chờ ai đó bấm. Bấm vào ô để đi thẳng tới
                danh sách.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={`text-5xl font-semibold leading-none ${
                    tongDangCho > 0 ? 'text-warning-dam' : 'text-success-dam'
                  }`}
                >
                  {so(tongDangCho)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {tongDangCho > 0 ? 'việc đang chờ xử lý' : 'không còn việc nào tắc'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <O
                  nhan="Chờ duyệt"
                  gia={c?.yeuCauChoDuyet ?? 0}
                  phu="yêu cầu"
                  icon={ClipboardList}
                  mau={c && c.yeuCauChoDuyet > 0 ? 'text-warning-dam' : ''}
                  den="/yeu-cau?status=CHO_DUYET"
                />
                <O
                  nhan="Chờ xuất kho"
                  gia={c?.yeuCauChoXuat ?? 0}
                  phu="yêu cầu đã duyệt"
                  icon={PackageOpen}
                  mau={c && c.yeuCauChoXuat > 0 ? 'text-warning-dam' : ''}
                  den="/yeu-cau?status=DA_DUYET"
                />
                <O
                  nhan="Biên bản chờ ký"
                  gia={c?.bienBanChoXacNhan ?? 0}
                  phu="biên bản bàn giao"
                  icon={FileSignature}
                  mau={c && c.bienBanChoXacNhan > 0 ? 'text-warning-dam' : ''}
                  den="/bbbg"
                />
                <O
                  nhan="Kiểm kê đang mở"
                  gia={c?.kiemKeDangMo ?? 0}
                  phu="phiếu chưa chốt"
                  icon={ClipboardCheck}
                  mau={c && c.kiemKeDangMo > 0 ? 'text-warning-dam' : ''}
                  den="/kiem-ke"
                />
                <O
                  nhan="Báo hỏng đang mở"
                  gia={c?.baoHongDangMo ?? 0}
                  phu="chưa bấm đã xử lý"
                  icon={Wrench}
                  mau={c && c.baoHongDangMo > 0 ? 'text-destructive-dam' : ''}
                  den="/bao-hong"
                />
                <O
                  nhan="Quá hạn trả"
                  gia={c?.thietBiQuaHan ?? 0}
                  phu="mã thiết bị"
                  icon={AlertTriangle}
                  mau={c && c.thietBiQuaHan > 0 ? 'text-destructive-dam' : ''}
                  den="/thiet-bi"
                />
              </div>
            </CardContent>
          </Card>

          {/* --- BÁO HỎNG: mở mới so với đã đóng, cùng một trục. */}
          <Card>
            <CardHeader>
              <CardTitle>Báo hỏng: mở mới so với đã đóng</CardTitle>
              <CardDescription>
                Cột trái là phiếu điểm trường mới báo, cột phải là phiếu đã bấm &ldquo;đã xử
                lý&rdquo;. Cột phải thấp hơn cột trái nhiều ngày liền là việc đang dồn lại.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CotHaiChuoi
                dong={dl.baoHongTheoNgay.map((d) => ({ ngay: d.ngay, a: d.moMoi, b: d.daDong }))}
                nhanA="Mở mới"
                nhanB="Đã đóng"
                donVi="phiếu"
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <O nhan="Đang mở" gia={dl.baoHong.dangMo} phu="phiếu" icon={Wrench} den="/bao-hong" />
                <O nhan="Mở trong kỳ" gia={dl.baoHong.moTrongKy} phu="phiếu" icon={ClipboardList} />
                <O nhan="Đóng trong kỳ" gia={dl.baoHong.dongTrongKy} phu="phiếu" icon={ClipboardCheck} />
                <O
                  nhan="Thời gian xử lý"
                  gia={khoangThoiGian(dl.baoHong.gioXuLyTrungBinh)}
                  phu="trung bình mỗi phiếu đã đóng"
                  icon={Timer}
                />
              </div>
            </CardContent>
          </Card>

          {/* `min-w-0` trên từng thẻ là BẮT BUỘC, không phải cho đẹp: thẻ là ô của
              lưới nên mặc định có `min-width: auto`, tức không co nhỏ hơn bề rộng
              tối thiểu của nội dung. Bảng bên trong đòi 505px, thẻ phình theo và
              kéo cả trang tràn ngang ở khổ điện thoại — đã dựng lại đúng lỗi này
              (scrollWidth 563 trên màn 390). Khung cuộn ngang của bảng không cứu
              được, vì nó là con của thẻ chứ không phải chính thẻ. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* --- YÊU CẦU đang nằm ở bước nào (các bước có thứ tự). */}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Yêu cầu đang ở bước nào</CardTitle>
                <CardDescription>
                  Mỗi phiếu nằm ở đúng một bước, nên cộng lại là tổng số phiếu. Màu đậm dần
                  theo chiều tiến của quy trình. Không tính phiếu báo hỏng.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ThanhChong doan={doanBuoc} donVi="phiếu" nhanTong="phiếu yêu cầu" />
                <div className="grid grid-cols-2 gap-3">
                  <O
                    nhan="Thời gian duyệt"
                    gia={khoangThoiGian(dl.gioDuyetTrungBinh)}
                    phu="trung bình, từ lúc gửi duyệt"
                    icon={Gauge}
                  />
                  <O
                    nhan="Bị từ chối"
                    gia={dl.yeuCauBiTuChoi}
                    phu="phiếu trong kỳ"
                    icon={ClipboardList}
                    mau={dl.yeuCauBiTuChoi > 0 ? 'text-warning-dam' : ''}
                  />
                </div>
              </CardContent>
            </Card>

            {/* --- YÊU CẦU lập trong kỳ, chia theo loại (không có thứ tự). */}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Yêu cầu lập trong kỳ</CardTitle>
                <CardDescription>
                  Đếm theo số phiếu đã lập, chia theo loại yêu cầu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ThanhNgang dong={dongLoai} donVi="phiếu" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* --- LINH KIỆN: lý do thay là hạng mục KHÔNG có thứ tự → một màu. */}
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Linh kiện thay thế</CardTitle>
                <CardDescription>
                  Lý do lấy linh kiện ra khỏi kho trong kỳ. Mỗi phiếu đều gắn với một báo
                  hỏng và đều vào cơ sở dữ liệu.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ThanhNgang dong={dl.linhKien.theoLyDo} donVi="phiếu" />
                <div className="grid grid-cols-3 gap-3">
                  <O nhan="Số phiếu" gia={dl.linhKien.soPhieu} icon={Wrench} den="/lich-su-sua-chua" />
                  <O nhan="Linh kiện" gia={dl.linhKien.tongLinhKien} phu="cộng số lượng" icon={PackageOpen} />
                  <O
                    nhan="Không có mã"
                    gia={dl.linhKien.soPhieuKhongMa}
                    phu="phiếu, bắt buộc kèm ảnh"
                    icon={ClipboardList}
                  />
                </div>
              </CardContent>
            </Card>

            {/* --- ĐIỂM CẦN ĐỂ MẮT: bảng vì mỗi dòng có bốn con số khác đơn vị. */}
            <Card className="min-w-0">
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="size-4" aria-hidden />
                    Điểm cần để mắt
                  </CardTitle>
                  <CardDescription>
                    Xếp theo số báo hỏng còn đang mở, rồi tới tổng số lần phải sửa hoặc thay
                    linh kiện.
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/lich-su-sua-chua">
                    <History aria-hidden />
                    Lịch sử
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {dl.diemCanDeMat.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa điểm nào phát sinh sửa chữa hay thay linh kiện.
                  </p>
                ) : (
                  <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Điểm lưu trữ</TableHead>
                          <TableHead className="text-right">Đang mở</TableHead>
                          <TableHead className="text-right">Báo hỏng</TableHead>
                          <TableHead className="text-right">Linh kiện</TableHead>
                          <TableHead>Lần cuối</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dl.diemCanDeMat.map((d) => (
                          <TableRow key={d.diaDiemId}>
                            <TableCell>
                              <span className="block">{d.ten}</span>
                              <span className="text-xs text-muted-foreground">
                                {NHAN_LOAI_DIEM_LUU_TRU[d.loai as LoaiDiemLuuTru] ?? d.loai}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {d.soBaoHongDangMo > 0 ? (
                                <Badge variant="destructive">{so(d.soBaoHongDangMo)}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {so(d.soBaoHong)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {so(d.soPhieuLinhKien)}
                              {d.tongLinhKien > 0 ? (
                                <span className="block text-xs">{so(d.tongLinhKien)} cái</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {d.lanCuoi ? ngayGio(d.lanCuoi) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <O nhan="Mã thiết bị" gia={dl.soLieu.soMa} icon={ClipboardList} den="/thiet-bi" />
            {/* Tách BỘ và LẺ như trang Tổng quan và màn hình kho. */}
            <O
              nhan="Tại kho"
              gia={dl.soLieu.taiKho.bo}
              phu={`bộ · ${so(dl.soLieu.taiKho.le)} hàng lẻ`}
              icon={Warehouse}
            />
            <O
              nhan="Ở trường"
              gia={dl.soLieu.oTruong.bo}
              phu={`bộ · ${so(dl.soLieu.oTruong.le)} hàng lẻ`}
              icon={MapPin}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Số liệu tính từ ngày {dl.tuNgay.split('-').reverse().join('/')} đến hôm nay
            ({dl.soNgay} ngày), lọc theo phạm vi vai trò của bạn.
          </p>
        </div>
      )}
    </div>
  );
}
