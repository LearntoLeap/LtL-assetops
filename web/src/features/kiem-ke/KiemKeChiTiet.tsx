import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Check,
  FileSpreadsheet,
  Loader2,
  Lock,
  Send,
  Trash2,
} from 'lucide-react';
import {
  DS_TINH_TRANG,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_KIEM_KE,
  type TinhTrang,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { ChupAnh } from '@/components/ChupAnh';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth, VAI_TRO_QUAN_LY } from '@/lib/auth';
import { ngayGio } from '@/lib/dinh-dang';
import { taiTep } from '@/lib/tep';
import type { AnhDaTai } from '@/lib/anh';
import type { BaoCaoKiemKe, DongBaoCaoKiemKe, PhieuKiemKe } from '@/lib/kieu';
import { MAU_TRANG_THAI_KIEM_KE } from '@/features/bbbg/tien-ich';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

interface PhanHoiKiemKe {
  ok: true;
  phieu: PhieuKiemKe;
  baoCao: BaoCaoKiemKe;
}

/**
 * Bọc ChupAnh để chỉ truyền `assetId` khi tra được — dự án bật
 * `exactOptionalPropertyTypes` nên không truyền thẳng `undefined` được.
 */
function ChupAnhDong({
  idThietBi,
  anh,
  onDoiAnh,
}: {
  idThietBi: string | undefined;
  anh: AnhDaTai[];
  onDoiAnh: (anh: AnhDaTai[]) => void;
}) {
  const moTa = 'Nên chụp ảnh khi số thực đếm khác hệ thống hoặc tình trạng thay đổi.';
  if (idThietBi === undefined) {
    return <ChupAnh kind="KIEM_KE" anh={anh} onDoiAnh={onDoiAnh} moTa={moTa} />;
  }
  return <ChupAnh kind="KIEM_KE" anh={anh} onDoiAnh={onDoiAnh} assetId={idThietBi} moTa={moTa} />;
}

function O({ nhan, so, mau }: { nhan: string; so: number | string; mau?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</p>
      <p className={`text-xl font-semibold tabular-nums ${mau ?? ''}`}>{so}</p>
    </div>
  );
}

export function KiemKeChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { nguoiDung } = useAuth();

  const [phieu, datPhieu] = useState<PhieuKiemKe | null>(null);
  const [baoCao, datBaoCao] = useState<BaoCaoKiemKe | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);
  const [chiChuaDem, datChiChuaDem] = useState(false);

  // Dòng đang nhập thực đếm
  const [dongMo, datDongMo] = useState<string | null>(null);
  const [soLuong, datSoLuong] = useState('');
  const [tinhTrang, datTinhTrang] = useState<TinhTrang>('TOT');
  const [anh, datAnh] = useState<AnhDaTai[]>([]);
  const [ghiChuDong, datGhiChuDong] = useState('');

  // Chốt phiếu
  const [moChot, datMoChot] = useState(false);
  const [dieuChinhTon, datDieuChinhTon] = useState(true);
  const [ghiChuChot, datGhiChuChot] = useState('');

  const tai = useCallback(async () => {
    if (!id) return;
    datLoi(null);
    try {
      const kq = await goiApi<PhanHoiKiemKe>(`/api/kiem-ke/${id}`);
      datPhieu(kq.phieu);
      datBaoCao(kq.baoCao);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được phiếu kiểm kê.');
    }
  }, [id]);

  useEffect(() => {
    void tai();
  }, [tai]);

  function moDong(d: DongBaoCaoKiemKe): void {
    datDongMo(d.id);
    datSoLuong(String(d.thucDem ?? d.heThong));
    datTinhTrang(d.tinhTrangThucTe ?? d.tinhTrangHeThong);
    datGhiChuDong(d.note ?? '');
    datAnh([]);
    datLoi(null);
  }

  async function luuDong(): Promise<void> {
    if (!dongMo) return;
    datLoi(null);
    datThongBao(null);
    datDangChay(true);
    try {
      const kq = await goiApi<PhanHoiKiemKe>(`/api/kiem-ke/${id}/muc/${dongMo}`, {
        method: 'POST',
        than: {
          countedQuantity: Number(soLuong),
          countedCondition: tinhTrang,
          anhIds: anh.map((a) => a.id),
          note: ghiChuDong.trim(),
        },
      });
      datPhieu(kq.phieu);
      datBaoCao(kq.baoCao);
      datDongMo(null);
      datAnh([]);
      datThongBao('Đã ghi kết quả thực đếm.');
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Ghi kết quả đếm thất bại.');
    } finally {
      datDangChay(false);
    }
  }

  /**
   * `thanhCong` chỉ dùng khi lời gọi không tự đặt thông báo riêng — nhờ vậy
   * thông báo chi tiết của bước chốt (điều chỉnh bao nhiêu mã) không bị ghi đè.
   */
  async function chay(goi: () => Promise<unknown>, thanhCong: string): Promise<void> {
    datLoi(null);
    datThongBao(null);
    datDangChay(true);
    try {
      const rieng = await goi();
      datThongBao(typeof rieng === 'string' ? rieng : thanhCong);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thao tác thất bại.');
    } finally {
      datDangChay(false);
    }
  }

  if (loi && !phieu) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/kiem-ke">
            <ArrowLeft aria-hidden />
            Về danh sách
          </Link>
        </Button>
        <Alert variant="destructive" tieuDe="Không mở được phiếu kiểm kê">
          {loi}
        </Alert>
      </div>
    );
  }
  if (!phieu || !baoCao) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const th = baoCao.tongHop;
  const laQuanLy = nguoiDung ? VAI_TRO_QUAN_LY.includes(nguoiDung.role) : false;
  const conMo = phieu.status === 'DANG_KIEM' || phieu.status === 'CHO_CHOT';
  const duocDem = conMo;
  const duocGuiChot = phieu.status === 'DANG_KIEM' && th.chuaDem === 0;
  const duocChot = conMo && laQuanLy && th.chuaDem === 0;
  const duocHuy = conMo && laQuanLy;

  const dsDong = chiChuaDem ? baoCao.dong.filter((d) => !d.daDem) : baoCao.dong;

  /**
   * Dòng báo cáo mang ID CỦA DÒNG KIỂM KÊ, còn ảnh phải gắn vào THIẾT BỊ —
   * tra ngược qua phiếu để không gửi sai id lên server.
   */
  const idThietBi = (idDong: string): string | undefined =>
    phieu.items.find((m) => m.id === idDong)?.asset.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/kiem-ke">
              <ArrowLeft aria-hidden />
              Về danh sách
            </Link>
          </Button>
          <h1 className="font-mono text-xl font-semibold sm:text-2xl">{phieu.code}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {phieu.name} · {phieu.location.name}
            <Badge variant={MAU_TRANG_THAI_KIEM_KE[phieu.status]}>
              {NHAN_TRANG_THAI_KIEM_KE[phieu.status]}
            </Badge>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void taiTep(`/api/kiem-ke/${phieu.id}/bao-cao.xlsx`, `${phieu.code}.xlsx`).catch((e) =>
                datLoi(e instanceof LoiApi ? e.message : 'Tải báo cáo thất bại.'),
              )
            }
          >
            <FileSpreadsheet aria-hidden />
            Xuất Excel
          </Button>
          {duocGuiChot ? (
            <Button
              variant="outline"
              disabled={dangChay}
              onClick={() =>
                void chay(
                  () => goiApi(`/api/kiem-ke/${phieu.id}/gui-chot`, { method: 'POST' }),
                  'Đã gửi phiếu cho quản trị chốt.',
                )
              }
            >
              <Send aria-hidden />
              Gửi chốt
            </Button>
          ) : null}
          {duocChot ? (
            <Button disabled={dangChay} onClick={() => datMoChot((m) => !m)}>
              <Lock aria-hidden />
              Chốt phiếu
            </Button>
          ) : null}
          {duocHuy ? (
            <Button
              variant="outline"
              className="text-destructive-dam"
              disabled={dangChay}
              onClick={() => {
                if (!window.confirm(`Huỷ đợt kiểm kê ${phieu.code}? Kết quả đã đếm sẽ không được điều chỉnh vào tồn.`)) {
                  return;
                }
                void chay(
                  () => goiApi(`/api/kiem-ke/${phieu.id}/huy`, { method: 'POST' }),
                  'Đã huỷ đợt kiểm kê.',
                );
              }}
            >
              <Trash2 aria-hidden />
              Huỷ đợt
            </Button>
          ) : null}
        </div>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}

      {phieu.status === 'DA_CHOT' ? (
        <Alert variant="success" tieuDe="Phiếu đã chốt">
          {phieu.closedBy?.fullName ?? 'Quản trị'} chốt lúc {ngayGio(phieu.closedAt)}. Các chênh lệch
          đã được ghi thành bút toán điều chỉnh và vào nhật ký thao tác.
        </Alert>
      ) : null}
      {phieu.status === 'HUY' ? (
        <Alert variant="warning" tieuDe="Đợt kiểm kê đã huỷ">
          Không có điều chỉnh nào được ghi vào tồn kho.
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <O nhan="Tổng dòng" so={th.tongDong} />
        <O nhan="Đã đếm" so={th.daDem} mau="text-success-dam" />
        <O nhan="Chưa đếm" so={th.chuaDem} mau={th.chuaDem > 0 ? 'text-warning-dam' : ''} />
        <O
          nhan="Chênh lệch"
          so={th.soChenhLech}
          mau={th.soChenhLech > 0 ? 'text-destructive-dam' : ''}
        />
        <O nhan="Thiếu / Thừa" so={`${th.thieu} / +${th.thua}`} />
        <O nhan="Đổi tình trạng" so={th.doiTinhTrang} />
      </div>

      {moChot ? (
        <Card>
          <CardHeader>
            <CardTitle>Chốt phiếu kiểm kê</CardTitle>
            <CardDescription>
              Chốt sẽ ghi bút toán điều chỉnh cho từng mã chênh lệch, cập nhật tình trạng thiết bị và
              sinh cảnh báo chênh lệch. Thao tác này không hoàn lại.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex min-h-cham cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--chinh))]"
                checked={dieuChinhTon}
                onChange={(su) => datDieuChinhTon(su.target.checked)}
              />
              Điều chỉnh tồn kho theo số thực đếm ({th.soChenhLech} mã chênh lệch)
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="kk-ghi-chu-chot">Ghi chú khi chốt</Label>
              <textarea
                id="kk-ghi-chu-chot"
                rows={2}
                className={O_VAN_BAN}
                value={ghiChuChot}
                placeholder="Ví dụ: thiếu 1 bộ do đang cho lớp mượn, đã lập phiếu bù."
                onChange={(su) => datGhiChuChot(su.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={dangChay}
                onClick={() =>
                  void chay(async () => {
                    const kq = await goiApi<{
                      ok: true;
                      soDieuChinh: number;
                      soDoiTinhTrang: number;
                    }>(`/api/kiem-ke/${phieu.id}/chot`, {
                      method: 'POST',
                      than: { dieuChinhTon, note: ghiChuChot.trim() },
                    });
                    datMoChot(false);
                    return `Đã chốt phiếu: điều chỉnh ${kq.soDieuChinh} mã, cập nhật tình trạng ${kq.soDoiTinhTrang} mã.`;
                  }, 'Đã chốt phiếu kiểm kê.')
                }
              >
                {dangChay ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
                Xác nhận chốt
              </Button>
              <Button variant="outline" onClick={() => datMoChot(false)}>
                Thôi
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Bảng kiểm kê ({dsDong.length})</CardTitle>
          <CardDescription>
            Cột “Hệ thống” là tồn kho chụp lại lúc mở đợt. Chênh lệch được tính khi đọc, không lưu
            thành cột riêng.
          </CardDescription>
          {th.chuaDem > 0 ? (
            <label className="flex min-h-cham cursor-pointer items-center gap-2 pt-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--chinh))]"
                checked={chiChuaDem}
                onChange={(su) => datChiChuaDem(su.target.checked)}
              />
              Chỉ hiện dòng chưa đếm ({th.chuaDem})
            </label>
          ) : null}
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <div className="max-h-[32rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã thiết bị</TableHead>
                  <TableHead>Tên thiết bị</TableHead>
                  <TableHead className="text-right">Hệ thống</TableHead>
                  <TableHead className="text-right">Thực đếm</TableHead>
                  <TableHead className="text-right">Chênh lệch</TableHead>
                  <TableHead>Tình trạng</TableHead>
                  <TableHead className="text-right">Ảnh</TableHead>
                  {duocDem ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dsDong.map((d) => (
                  <Fragment key={d.id}>
                    <TableRow>
                      <TableCell className="font-mono text-sm font-medium">{d.code}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.name}
                        <span className="block text-xs">{d.loai}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.heThong}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.daDem ? d.thucDem : <span className="text-warning-dam">chưa đếm</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.chenhLech === null ? (
                          '—'
                        ) : d.chenhLech === 0 ? (
                          <span className="text-success-dam">0</span>
                        ) : (
                          <strong className="text-destructive-dam">
                            {d.chenhLech > 0 ? `+${d.chenhLech}` : d.chenhLech}
                          </strong>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {NHAN_TINH_TRANG[d.tinhTrangHeThong]}
                        {d.doiTinhTrang && d.tinhTrangThucTe ? (
                          <span className="block text-xs text-destructive-dam">
                            → {NHAN_TINH_TRANG[d.tinhTrangThucTe]}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {d.soAnh}
                      </TableCell>
                      {duocDem ? (
                        <TableCell className="text-right">
                          <Button
                            variant={d.daDem ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => (dongMo === d.id ? datDongMo(null) : moDong(d))}
                          >
                            {d.daDem ? 'Sửa' : 'Đếm'}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>

                    {dongMo === d.id ? (
                      <TableRow>
                        <TableCell colSpan={duocDem ? 8 : 7} className="bg-secondary/40">
                          <div className="space-y-3 py-1">
                            <p className="text-sm font-medium">
                              Nhập thực đếm cho <span className="font-mono">{d.code}</span> — {d.name}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label htmlFor="kk-so-luong">Số lượng thực đếm</Label>
                                <Input
                                  id="kk-so-luong"
                                  type="number"
                                  min={0}
                                  inputMode="numeric"
                                  value={soLuong}
                                  onChange={(su) => datSoLuong(su.target.value)}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="kk-tinh-trang">Tình trạng thực tế</Label>
                                <Select
                                  id="kk-tinh-trang"
                                  value={tinhTrang}
                                  onChange={(su) => datTinhTrang(su.target.value as TinhTrang)}
                                >
                                  {DS_TINH_TRANG.map((t) => (
                                    <option key={t.ma} value={t.ma}>
                                      {t.nhan}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Ảnh kiểm kê</Label>
                              <ChupAnhDong
                                idThietBi={idThietBi(d.id)}
                                anh={anh}
                                onDoiAnh={datAnh}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="kk-ghi-chu-dong">Ghi chú</Label>
                              <textarea
                                id="kk-ghi-chu-dong"
                                rows={2}
                                className={O_VAN_BAN}
                                value={ghiChuDong}
                                placeholder="Ví dụ: thiếu 1 bộ, giáo viên đang giữ."
                                onChange={(su) => datGhiChuDong(su.target.value)}
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="cham"
                                disabled={dangChay || soLuong.trim() === ''}
                                onClick={() => void luuDong()}
                              >
                                {dangChay ? (
                                  <Loader2 className="animate-spin" aria-hidden />
                                ) : (
                                  <Check aria-hidden />
                                )}
                                Lưu dòng này
                              </Button>
                              <Button variant="outline" size="cham" onClick={() => datDongMo(null)}>
                                Thôi
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {th.soChenhLech > 0 ? (
        <Alert variant="warning" tieuDe={`Có ${th.soChenhLech} mã chênh lệch`}>
          Bảng trên nêu rõ số hệ thống và số thực đếm của từng mã. Khi chốt, mỗi chênh lệch được ghi
          thành một bút toán <strong>Điều chỉnh sau kiểm kê</strong> — tồn kho vẫn suy ra từ bảng
          giao dịch, không sửa tay.
        </Alert>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Camera className="size-3.5" aria-hidden />
        Mở đợt lúc {ngayGio(phieu.startedAt ?? phieu.createdAt)} bởi{' '}
        {phieu.createdBy?.fullName ?? '—'}
        {phieu.note ? ` · ${phieu.note}` : ''}
      </p>
    </div>
  );
}
