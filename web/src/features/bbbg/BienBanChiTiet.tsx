import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Printer,
  Send,
  X,
} from 'lucide-react';
import {
  NHAN_LOAI_YEU_CAU,
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
    datSuaMo(true);
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
            Biên bản bàn giao
            <Badge variant={MAU_TRANG_THAI_BBBG[bb.status]}>
              {NHAN_TRANG_THAI_BBBG[bb.status]}
            </Badge>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
              <div className="space-y-1.5">
                <Label htmlFor="s-ngay">Ngày lập</Label>
                <Input
                  id="s-ngay"
                  type="date"
                  value={sIssuedDate}
                  onChange={(su) => datSIssuedDate(su.target.value)}
                />
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
                          giverName: sGiverName.trim(),
                          giverTitle: sGiverTitle.trim(),
                          giverOrg: sGiverOrg.trim(),
                          receiverOrg: sReceiverOrg.trim(),
                          receiverName: sReceiverName.trim(),
                          receiverTitle: sReceiverTitle.trim(),
                          receiverPhone: sReceiverPhone.trim(),
                          ...(sIssuedDate ? { issuedDate: sIssuedDate } : {}),
                          commitment: sCommitment.trim(),
                          note: sNote.trim(),
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
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead>Tình trạng khi giao</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bb.items.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {m.assetCodeSnapshot}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.assetNameSnapshot}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {NHAN_TINH_TRANG[m.conditionSnapshot]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.note ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cam kết và ghi chú</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
