import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  FileDown,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  NHAN_LOAI_YEU_CAU,
  NHAN_MAU_BBBG,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_BBBG,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth, VAI_TRO_NHAP_LIEU, VAI_TRO_QUAN_LY } from '@/lib/auth';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import { taiTep } from '@/lib/tep';
import type { BienBan } from '@/lib/kieu';
import { MAU_TRANG_THAI_BBBG } from './tien-ich';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function Muc({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

function ngayChoO(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : (d.toISOString().slice(0, 10) ?? '');
}

export function BienBanChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { nguoiDung } = useAuth();

  const [bb, datBb] = useState<BienBan | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);
  const [suaMo, datSuaMo] = useState(false);
  const [ghiChuXacNhan, datGhiChuXacNhan] = useState('');
  const [lyDoTuChoi, datLyDoTuChoi] = useState('');
  const [moTuChoi, datMoTuChoi] = useState(false);

  // Bản nháp đang sửa
  const [sGiverName, datSGiverName] = useState('');
  const [sGiverTitle, datSGiverTitle] = useState('');
  const [sGiverOrg, datSGiverOrg] = useState('');
  const [sReceiverOrg, datSReceiverOrg] = useState('');
  const [sReceiverName, datSReceiverName] = useState('');
  const [sReceiverTitle, datSReceiverTitle] = useState('');
  const [sReceiverPhone, datSReceiverPhone] = useState('');
  const [sIssuedDate, datSIssuedDate] = useState('');
  const [sCommitment, datSCommitment] = useState('');
  const [sNote, datSNote] = useState('');
  const [sSubtitle, datSSubtitle] = useState('');
  const [sBasis, datSBasis] = useState('');
  const [sGiverAddress, datSGiverAddress] = useState('');
  const [sGiverTaxCode, datSGiverTaxCode] = useState('');
  const [sGiverPhone, datSGiverPhone] = useState('');
  const [sReceiverAddress, datSReceiverAddress] = useState('');
  const [sHandoverPlace, datSHandoverPlace] = useState('');
  const [sInspection, datSInspection] = useState('');
  const [sObligations, datSObligations] = useState('');
  const [sCopies, datSCopies] = useState(4);
  /** Đơn vị tính từng dòng — khoá là id dòng biên bản. */
  const [sDonVi, datSDonVi] = useState<Record<string, string>>({});
  const [dangTaiTep, datDangTaiTep] = useState(false);
  const [hoiXoa, datHoiXoa] = useState(false);

  const tai = useCallback(async () => {
    if (!id) return;
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; bbbg: BienBan }>(`/api/bbbg/${id}`);
      datBb(kq.bbbg);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được biên bản.');
    }
  }, [id]);

  useEffect(() => {
    void tai();
  }, [tai]);

  function moSua(b: BienBan): void {
    datSGiverName(b.giverName);
    datSGiverTitle(b.giverTitle ?? '');
    datSGiverOrg(b.giverOrg);
    datSReceiverOrg(b.receiverOrg);
    datSReceiverName(b.receiverName);
    datSReceiverTitle(b.receiverTitle ?? '');
    datSReceiverPhone(b.receiverPhone ?? '');
    datSIssuedDate(ngayChoO(b.issuedDate));
    datSCommitment(b.commitment ?? '');
    datSNote(b.note ?? '');
    datSSubtitle(b.subtitle ?? '');
    datSBasis(b.basis ?? '');
    datSGiverAddress(b.giverAddress ?? '');
    datSGiverTaxCode(b.giverTaxCode ?? '');
    datSGiverPhone(b.giverPhone ?? '');
    datSReceiverAddress(b.receiverAddress ?? '');
    datSHandoverPlace(b.handoverPlace ?? '');
    datSInspection(b.inspection ?? '');
    datSObligations(b.obligations ?? '');
    datSCopies(b.copies);
    datSDonVi(Object.fromEntries(b.items.map((m) => [m.id, m.unit])));
    datSuaMo(true);
  }

  /**
   * Tải file Word. Endpoint đòi xác thực nên không dán thẳng vào <a href> được —
   * phải tải bằng fetch kèm token rồi mới lưu xuống máy.
   */
  /**
   * ADMIN xoá biên bản — vào thùng rác, khôi phục lại được.
   *
   * Nói thẳng điều dễ hiểu nhầm: biên bản đã xác nhận thì việc bàn giao ĐÃ xảy
   * ra, xoá tờ giấy không kéo thiết bị về chỗ cũ.
   */
  async function xoaBienBan(b: BienBan): Promise<void> {
    datLoi(null);
    datDangChay(true);
    try {
      await goiApi(`/api/bbbg/${b.id}`, { method: 'DELETE' });
      window.location.assign('/bbbg');
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá biên bản thất bại.');
      datDangChay(false);
    }
  }

  async function taiWord(b: BienBan): Promise<void> {
    datLoi(null);
    datDangTaiTep(true);
    try {
      await taiTep(`/api/bbbg/${b.id}/tep`, b.fileName ?? `${b.code}.docx`);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được file biên bản.');
    } finally {
      datDangTaiTep(false);
    }
  }

  async function chay(
    goi: () => Promise<unknown>,
    thanhCong: string,
    sauKhi?: () => void,
  ): Promise<void> {
    datLoi(null);
    datThongBao(null);
    datDangChay(true);
    try {
      await goi();
      datThongBao(thanhCong);
      sauKhi?.();
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thao tác thất bại.');
    } finally {
      datDangChay(false);
    }
  }

  if (loi && !bb) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/bbbg">
            <ArrowLeft aria-hidden />
            Về danh sách
          </Link>
        </Button>
        <Alert variant="destructive" tieuDe="Không mở được biên bản">
          {loi}
        </Alert>
      </div>
    );
  }
  if (!bb) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const laBenGiao = nguoiDung ? VAI_TRO_NHAP_LIEU.includes(nguoiDung.role) : false;
  const laQuanLy = nguoiDung ? VAI_TRO_QUAN_LY.includes(nguoiDung.role) : false;
  // Bên nhận là tài khoản thuộc đúng điểm nhận; quản lý cũng xác nhận hộ được.
  const laBenNhan =
    laQuanLy ||
    (bb.receiverLocation !== null && nguoiDung?.locationId === bb.receiverLocation.id);

  /**
   * Xoá phiếu / biên bản: quản trị hệ thống và vận hành thiết bị.
   * Trùng với `duocXoaPhieu` ở máy chủ — nơi thật sự chặn.
   */
  const duocXoaPhieu = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  const duocSua = bb.status === 'BAN_NHAP' && laBenGiao;
  const duocGui = bb.status === 'BAN_NHAP' && laBenGiao;
  const duocXacNhan = bb.status === 'CHO_XAC_NHAN' && laBenNhan;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/bbbg">
              <ArrowLeft aria-hidden />
              Về danh sách
            </Link>
          </Button>
          <h1 className="font-mono text-xl font-semibold sm:text-2xl">{bb.code}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {NHAN_MAU_BBBG[bb.templateType]}
            <Badge variant={MAU_TRANG_THAI_BBBG[bb.status]}>
              {NHAN_TRANG_THAI_BBBG[bb.status]}
            </Badge>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={dangTaiTep} onClick={() => void taiWord(bb)}>
            {dangTaiTep ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
            Tải file Word
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/bbbg/${bb.id}/in`} target="_blank" rel="noreferrer">
              <Printer aria-hidden />
              In / Lưu PDF
            </Link>
          </Button>
          {duocSua && !suaMo ? (
            <Button variant="outline" onClick={() => moSua(bb)}>
              <Pencil aria-hidden />
              Sửa nội dung
            </Button>
          ) : null}
          {duocXoaPhieu ? (
            <Button
              variant="outline"
              className="text-destructive-dam"
              disabled={dangChay}
              onClick={() => datHoiXoa(true)}
            >
              <Trash2 aria-hidden />
              Xoá biên bản
            </Button>
          ) : null}
          {duocGui ? (
            <Button
              disabled={dangChay}
              onClick={() =>
                void chay(
                  () => goiApi(`/api/bbbg/${bb.id}/gui-xac-nhan`, { method: 'POST' }),
                  'Đã gửi cho bên nhận xác nhận.',
                )
              }
            >
              <Send aria-hidden />
              Gửi bên nhận xác nhận
            </Button>
          ) : null}
        </div>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}

      {hoiXoa ? (
        <Alert variant="warning" tieuDe="Xoá biên bản này?">
          <div className="space-y-3">
            <p>
              Biên bản sẽ vào <strong>thùng rác</strong> và khôi phục lại được.
              {bb.status === 'DA_XAC_NHAN' ? (
                <>
                  {' '}
                  Biên bản này <strong>đã được bên nhận xác nhận</strong> — việc bàn giao đã xảy ra
                  thật, nên xoá biên bản <strong>không</strong> kéo thiết bị về chỗ cũ. Muốn đưa
                  thiết bị về thì lập yêu cầu trả về kho.
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={dangChay} onClick={() => void xoaBienBan(bb)}>
                <Trash2 aria-hidden />
                Xoá vào thùng rác
              </Button>
              <Button variant="outline" onClick={() => datHoiXoa(false)}>
                Thôi
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {/* File mềm lưu lại để theo dõi — mọi lần xuất/nhập đều có một bản. */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 text-sm">
            {bb.fileName ? (
              <>
                <span className="font-medium">File mềm đã lưu: </span>
                <span className="break-all font-mono text-xs">{bb.fileName}</span>
                <span className="text-muted-foreground">
                  {' '}· {Math.max(1, Math.round((bb.fileSize ?? 0) / 1024))} KB · xuất lúc{' '}
                  {bb.fileGeneratedAt ? ngayGio(bb.fileGeneratedAt) : '—'}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                Chưa xuất file mềm lần nào — bấm &quot;Tải file Word&quot; là hệ thống tạo và lưu lại.
              </span>
            )}
          </div>
          {duocSua ? (
            <Button
              variant="outline"
              size="sm"
              disabled={dangChay}
              onClick={() =>
                void chay(
                  () => goiApi(`/api/bbbg/${bb.id}/xuat-file`, { method: 'POST' }),
                  'Đã tạo lại file Word theo nội dung mới nhất.',
                )
              }
            >
              <RefreshCw aria-hidden />
              Tạo lại file
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {bb.status === 'CHO_XAC_NHAN' ? (
        <Alert variant="warning" tieuDe="Đang chờ bên nhận xác nhận">
          Thiết bị vẫn <strong>đang vận chuyển</strong> và <strong>chưa đổi vị trí</strong>. Chỉ khi
          bên nhận bấm xác nhận, hệ thống mới ghi nhận thiết bị đã về{' '}
          {bb.receiverLocation?.name ?? bb.receiverOrg}.
        </Alert>
      ) : null}
      {bb.status === 'DA_XAC_NHAN' ? (
        <Alert variant="success" tieuDe="Bên nhận đã xác nhận">
          {bb.confirmedBy?.fullName ?? 'Bên nhận'} đã xác nhận lúc {ngayGio(bb.confirmedAt)}. Vị trí
          thiết bị đã chuyển sang {bb.receiverLocation?.name ?? bb.receiverOrg}.
        </Alert>
      ) : null}
      {bb.status === 'TU_CHOI' ? (
        <Alert variant="destructive" tieuDe="Bên nhận từ chối nhận">
          {bb.rejectionNote ?? 'Không có lý do.'} Hàng vẫn thuộc bên giao — hãy xử lý rồi lập biên
          bản mới.
        </Alert>
      ) : null}

      {duocXacNhan ? (
        <Card>
          <CardHeader>
            <CardTitle>Bên nhận kiểm hàng</CardTitle>
            <CardDescription>
              Kiểm đủ số lượng và tình trạng như bảng dưới rồi mới xác nhận. Xác nhận là thao tác
              không hoàn lại.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bb-ghi-chu-xn">Ghi chú khi nhận (không bắt buộc)</Label>
              <textarea
                id="bb-ghi-chu-xn"
                rows={2}
                className={O_VAN_BAN}
                value={ghiChuXacNhan}
                placeholder="Ví dụ: thiếu 1 dây nguồn, đã ghi nhận."
                onChange={(su) => datGhiChuXacNhan(su.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="cham"
                disabled={dangChay}
                onClick={() =>
                  void chay(
                    () =>
                      goiApi(`/api/bbbg/${bb.id}/xac-nhan`, {
                        method: 'POST',
                        than: { ghiChu: ghiChuXacNhan.trim() },
                      }),
                    'Đã xác nhận nhận hàng. Vị trí thiết bị đã được cập nhật.',
                    () => datGhiChuXacNhan(''),
                  )
                }
              >
                {dangChay ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                Xác nhận đã nhận đủ
              </Button>
              <Button
                variant="outline"
                size="cham"
                className="text-destructive-dam"
                onClick={() => datMoTuChoi((m) => !m)}
              >
                <X aria-hidden />
                Từ chối nhận
              </Button>
            </div>

            {moTuChoi ? (
              <div className="space-y-2 rounded-md border border-destructive/35 p-3">
                <Label htmlFor="bb-ly-do">Lý do từ chối (bắt buộc, ít nhất 5 ký tự)</Label>
                <textarea
                  id="bb-ly-do"
                  rows={2}
                  className={O_VAN_BAN}
                  value={lyDoTuChoi}
                  onChange={(su) => datLyDoTuChoi(su.target.value)}
                />
                <Button
                  variant="destructive"
                  disabled={dangChay || lyDoTuChoi.trim().length < 5}
                  onClick={() =>
                    void chay(
                      () =>
                        goiApi(`/api/bbbg/${bb.id}/tu-choi`, {
                          method: 'POST',
                          than: { rejectionNote: lyDoTuChoi.trim() },
                        }),
                      'Đã từ chối nhận và báo lại cho bên giao.',
                      () => {
                        datLyDoTuChoi('');
                        datMoTuChoi(false);
                      },
                    )
                  }
                >
                  Xác nhận từ chối
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {suaMo ? (
        <Card>
          <CardHeader>
            <CardTitle>Sửa nội dung biên bản</CardTitle>
            <CardDescription>Chỉ sửa được khi biên bản còn là bản nháp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-giao-ten">Người giao</Label>
                <Input
                  id="s-giao-ten"
                  value={sGiverName}
                  onChange={(su) => datSGiverName(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-giao-cv">Chức vụ bên giao</Label>
                <Input
                  id="s-giao-cv"
                  value={sGiverTitle}
                  onChange={(su) => datSGiverTitle(su.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-giao-dv">Đơn vị bên giao</Label>
                <Input
                  id="s-giao-dv"
                  value={sGiverOrg}
                  onChange={(su) => datSGiverOrg(su.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-giao-dc">Địa chỉ bên giao</Label>
                <Input
                  id="s-giao-dc"
                  value={sGiverAddress}
                  onChange={(su) => datSGiverAddress(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-giao-mst">Mã số thuế bên giao</Label>
                <Input
                  id="s-giao-mst"
                  value={sGiverTaxCode}
                  onChange={(su) => datSGiverTaxCode(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-giao-dt">Điện thoại bên giao</Label>
                <Input
                  id="s-giao-dt"
                  inputMode="tel"
                  value={sGiverPhone}
                  onChange={(su) => datSGiverPhone(su.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-nhan-dv">Đơn vị bên nhận</Label>
                <Input
                  id="s-nhan-dv"
                  value={sReceiverOrg}
                  onChange={(su) => datSReceiverOrg(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-nhan-ten">Người nhận</Label>
                <Input
                  id="s-nhan-ten"
                  value={sReceiverName}
                  onChange={(su) => datSReceiverName(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-nhan-cv">Chức vụ bên nhận</Label>
                <Input
                  id="s-nhan-cv"
                  value={sReceiverTitle}
                  onChange={(su) => datSReceiverTitle(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-nhan-dt">Điện thoại bên nhận</Label>
                <Input
                  id="s-nhan-dt"
                  inputMode="tel"
                  value={sReceiverPhone}
                  onChange={(su) => datSReceiverPhone(su.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-nhan-dc">Địa chỉ bên nhận</Label>
                <Input
                  id="s-nhan-dc"
                  value={sReceiverAddress}
                  onChange={(su) => datSReceiverAddress(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-ngay">Ngày lập</Label>
                <Input
                  id="s-ngay"
                  type="date"
                  value={sIssuedDate}
                  onChange={(su) => datSIssuedDate(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-so-ban">Số bản được lập</Label>
                <Input
                  id="s-so-ban"
                  type="number"
                  min={1}
                  max={20}
                  value={sCopies}
                  onChange={(su) => datSCopies(Number(su.target.value))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-noi">Địa điểm bàn giao</Label>
                <Input
                  id="s-noi"
                  value={sHandoverPlace}
                  onChange={(su) => datSHandoverPlace(su.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="s-vviec">Trích yếu (dòng &quot;V/v …&quot;)</Label>
                <Input
                  id="s-vviec"
                  value={sSubtitle}
                  onChange={(su) => datSSubtitle(su.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s-can-cu">Các dòng &quot;Căn cứ …&quot; — mỗi dòng một căn cứ</Label>
              <textarea
                id="s-can-cu"
                rows={3}
                className={O_VAN_BAN}
                value={sBasis}
                onChange={(su) => datSBasis(su.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-kiem-tra">Kết quả kiểm tra — mỗi dòng một ý</Label>
              <textarea
                id="s-kiem-tra"
                rows={3}
                className={O_VAN_BAN}
                value={sInspection}
                onChange={(su) => datSInspection(su.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-trach-nhiem">Trách nhiệm của các Bên — mỗi dòng một ý</Label>
              <textarea
                id="s-trach-nhiem"
                rows={5}
                className={O_VAN_BAN}
                value={sObligations}
                onChange={(su) => datSObligations(su.target.value)}
              />
            </div>

            {/* Đơn vị tính từng dòng: sách là "Quyển", cờ là "Lá", robot là "Bộ". */}
            <div className="space-y-2">
              <Label>Đơn vị tính từng dòng thiết bị</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {bb.items.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm" title={m.assetNameSnapshot}>
                      {m.assetNameSnapshot}
                    </span>
                    <Input
                      aria-label={`Đơn vị tính của ${m.assetNameSnapshot}`}
                      className="w-24 shrink-0"
                      value={sDonVi[m.id] ?? m.unit}
                      onChange={(su) =>
                        datSDonVi((cu) => ({ ...cu, [m.id]: su.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-cam-ket">Nội dung cam kết in trên biên bản</Label>
              <textarea
                id="s-cam-ket"
                rows={4}
                className={O_VAN_BAN}
                value={sCommitment}
                onChange={(su) => datSCommitment(su.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-ghi-chu">Ghi chú</Label>
              <textarea
                id="s-ghi-chu"
                rows={2}
                className={O_VAN_BAN}
                value={sNote}
                onChange={(su) => datSNote(su.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={dangChay}
                onClick={() =>
                  void chay(
                    () =>
                      goiApi(`/api/bbbg/${bb.id}`, {
                        method: 'PATCH',
                        than: {
                          subtitle: sSubtitle.trim(),
                          basis: sBasis.trim(),
                          giverName: sGiverName.trim(),
                          giverTitle: sGiverTitle.trim(),
                          giverOrg: sGiverOrg.trim(),
                          giverAddress: sGiverAddress.trim(),
                          giverTaxCode: sGiverTaxCode.trim(),
                          giverPhone: sGiverPhone.trim(),
                          receiverOrg: sReceiverOrg.trim(),
                          receiverName: sReceiverName.trim(),
                          receiverTitle: sReceiverTitle.trim(),
                          receiverPhone: sReceiverPhone.trim(),
                          receiverAddress: sReceiverAddress.trim(),
                          ...(sIssuedDate ? { issuedDate: sIssuedDate } : {}),
                          handoverPlace: sHandoverPlace.trim(),
                          inspection: sInspection.trim(),
                          obligations: sObligations.trim(),
                          copies: sCopies,
                          commitment: sCommitment.trim(),
                          note: sNote.trim(),
                          muc: bb.items
                            .filter((m) => (sDonVi[m.id] ?? m.unit).trim() !== m.unit)
                            .map((m) => ({ id: m.id, unit: (sDonVi[m.id] ?? m.unit).trim() })),
                        },
                      }),
                    'Đã lưu nội dung biên bản.',
                    () => datSuaMo(false),
                  )
                }
              >
                {dangChay ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                Lưu
              </Button>
              <Button variant="outline" onClick={() => datSuaMo(false)}>
                Thôi
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bên giao</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Muc nhan="Đơn vị">{bb.giverOrg}</Muc>
              {bb.giverAddress ? <Muc nhan="Địa chỉ">{bb.giverAddress}</Muc> : null}
              {bb.giverTaxCode ? <Muc nhan="Mã số thuế">{bb.giverTaxCode}</Muc> : null}
              {bb.giverPhone ? <Muc nhan="Điện thoại">{bb.giverPhone}</Muc> : null}
              <Muc nhan="Người giao">
                {bb.giverName}
                {bb.giverTitle ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {bb.giverTitle}
                  </span>
                ) : null}
              </Muc>
              <Muc nhan="Người lập biên bản">{bb.createdBy.fullName}</Muc>
              <Muc nhan="Ngày lập">{bb.issuedDate ? ngay(bb.issuedDate) : ngayGio(bb.createdAt)}</Muc>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bên nhận</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Muc nhan="Đơn vị">{bb.receiverOrg}</Muc>
              <Muc nhan="Điểm nhận trong danh mục">
                {bb.receiverLocation ? (
                  <>
                    {bb.receiverLocation.name}
                    <span className="block font-mono text-xs font-normal text-muted-foreground">
                      {bb.receiverLocation.code}
                    </span>
                  </>
                ) : (
                  <span className="text-warning-dam">Chưa gắn điểm trong danh mục</span>
                )}
              </Muc>
              <Muc nhan="Người nhận">
                {bb.receiverName}
                {bb.receiverTitle ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {bb.receiverTitle}
                  </span>
                ) : null}
              </Muc>
              <Muc nhan="Điện thoại">{bb.receiverPhone ?? '—'}</Muc>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thiết bị bàn giao ({bb.items.length})</CardTitle>
          <CardDescription>
            Mã, tên và tình trạng được chụp lại đúng lúc lập biên bản, không đổi theo dữ liệu thiết
            bị về sau — đây là bằng chứng của lần bàn giao này.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">TT</TableHead>
                <TableHead>Mã thiết bị</TableHead>
                <TableHead>Tên thiết bị</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead>Tình trạng khi giao</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bb.items.map((m, i) => (
                <Fragment key={m.id}>
                  {/* Dòng tiêu đề nhóm, in y như trên biên bản giấy. */}
                  {m.groupLabel && m.groupLabel !== bb.items[i - 1]?.groupLabel ? (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/50 font-semibold">
                        {m.groupLabel}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {m.assetCodeSnapshot}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.assetNameSnapshot}</TableCell>
                    <TableCell className="text-muted-foreground">{m.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {NHAN_TINH_TRANG[m.conditionSnapshot]}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.note ?? '—'}</TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nội dung biên bản</CardTitle>
          <CardDescription>Đúng phần sẽ in ra trên file Word.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {bb.subtitle ? (
            <p>
              <span className="font-medium">Trích yếu: </span>
              <span className="text-muted-foreground">{bb.subtitle}</span>
            </p>
          ) : null}
          {bb.basis ? (
            <div>
              <p className="font-medium">Căn cứ</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{bb.basis}</p>
            </div>
          ) : null}
          {bb.handoverPlace ? (
            <p>
              <span className="font-medium">Địa điểm bàn giao: </span>
              <span className="text-muted-foreground">{bb.handoverPlace}</span>
            </p>
          ) : null}
          {bb.inspection ? (
            <div>
              <p className="font-medium">Kết quả kiểm tra</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{bb.inspection}</p>
            </div>
          ) : null}
          {bb.obligations ? (
            <div>
              <p className="font-medium">Trách nhiệm của các Bên</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{bb.obligations}</p>
            </div>
          ) : null}
          <p className="text-muted-foreground">
            Biên bản được lập thành <strong className="text-foreground">{bb.copies}</strong> bản.
          </p>
          <p className="whitespace-pre-wrap text-sm">{bb.commitment ?? '—'}</p>
          {bb.note ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Ghi chú: </span>
              {bb.note}
            </p>
          ) : null}
          {bb.request ? (
            <p className="text-sm text-muted-foreground">
              Lập từ yêu cầu{' '}
              <Link to={`/yeu-cau/${bb.request.id}`} className="font-mono text-primary-dam hover:underline">
                {bb.request.code}
              </Link>{' '}
              ({NHAN_LOAI_YEU_CAU[bb.request.type]}) — {bb.request.reason}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
