import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  FileDown,
  FileSignature,
  Loader2,
  PackageCheck,
  PackageOpen,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  NHAN_LOAI_YEU_CAU,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_PHAN_BO,
  NHAN_TRANG_THAI_YEU_CAU,
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
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import { taiTep } from '@/lib/tep';
import type { BienBan, YeuCau } from '@/lib/kieu';
import { MAU_TRANG_THAI } from './tien-ich';

/** Loại yêu cầu đưa hàng ra khỏi kho / đưa hàng về kho. */
const LOAI_XUAT = new Set(['XUAT_KHO', 'PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG', 'CHO_MUON']);
const LOAI_NHAP = new Set(['NHAP_KHO', 'TRA_VE_KHO']);

function Muc({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export function YeuCauChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { nguoiDung } = useAuth();
  const dieuHuong = useNavigate();

  const [yeuCau, datYeuCau] = useState<YeuCau | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);
  const [dangXuatBBBG, datDangXuatBBBG] = useState(false);
  const [hoiXoa, datHoiXoa] = useState(false);

  const tai = useCallback(async () => {
    if (!id) return;
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; yeuCau: YeuCau }>(`/api/yeu-cau/${id}`);
      datYeuCau(kq.yeuCau);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được yêu cầu.');
    }
  }, [id]);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function hanhDong(
    duongDan: string,
    than: Record<string, unknown> | undefined,
    thanhCong: string,
  ): Promise<void> {
    datLoi(null);
    datThongBao(null);
    datDangChay(true);
    try {
      await goiApi(`/api/yeu-cau/${id}${duongDan}`, { method: 'POST', ...(than ? { than } : {}) });
      datThongBao(thanhCong);
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Thao tác thất bại.');
    } finally {
      datDangChay(false);
    }
  }

  async function xoaNhap(): Promise<void> {
    if (!window.confirm('Xoá bản nháp yêu cầu này?')) return;
    try {
      await goiApi(`/api/yeu-cau/${id}`, { method: 'DELETE' });
      dieuHuong('/yeu-cau', { replace: true });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá thất bại.');
    }
  }

  /**
   * ADMIN xoá phiếu ở bất kỳ trạng thái nào — chuyển vào thùng rác, khôi phục lại được.
   *
   * Hỏi thẳng điều dễ hiểu nhầm nhất: xoá phiếu KHÔNG làm hàng quay về kho.
   */
  async function xoaMem(): Promise<void> {
    datLoi(null);
    datDangChay(true);
    try {
      await goiApi(`/api/yeu-cau/${id}/xoa-mem`, { method: 'DELETE' });
      dieuHuong('/yeu-cau', { replace: true });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá thất bại.');
      datDangChay(false);
    }
  }

  if (loi && !yeuCau) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/yeu-cau">
            <ArrowLeft aria-hidden />
            Về danh sách
          </Link>
        </Button>
        <Alert variant="destructive" tieuDe="Không mở được yêu cầu">
          {loi}
        </Alert>
      </div>
    );
  }
  if (!yeuCau) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const laNguoiTao = nguoiDung?.id === yeuCau.createdBy.id;
  const laNguoiDuyet = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  /**
   * Xoá phiếu / biên bản: quản trị hệ thống và vận hành thiết bị.
   * Trùng với `duocXoaPhieu` ở máy chủ — nơi thật sự chặn.
   */
  const duocXoaPhieu = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  const laKho =
    nguoiDung?.role === 'KHO' || nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';

  const duocGuiDuyet = yeuCau.status === 'BAN_NHAP' && (laNguoiTao || nguoiDung?.role === 'ADMIN');
  // Không ai tự duyệt yêu cầu của chính mình — server chặn, đây chỉ là ẩn nút.
  const duocDuyet = yeuCau.status === 'CHO_DUYET' && laNguoiDuyet && !laNguoiTao;
  const duocXuat = yeuCau.status === 'DA_DUYET' && laKho && LOAI_XUAT.has(yeuCau.type);
  const duocNhap = yeuCau.status === 'DA_DUYET' && laKho && LOAI_NHAP.has(yeuCau.type);
  /*
   * Biên bản bàn giao lập được NGAY KHI YÊU CẦU ĐƯỢC DUYỆT.
   *
   * Trước đây phải xuất kho xong mới lập được, nên lúc mang hàng đi giao thì
   * chưa có giấy để ký — người đi giao phải quay về in rồi đi lại. Giờ duyệt
   * xong là in được mang theo. Đổi lại, biên bản lập sớm vẫn là BẢN NHÁP: chỉ
   * gửi bên nhận bấm xác nhận trên hệ thống được sau khi hàng thật sự xuất kho
   * (server chặn, xem `guiXacNhan`).
   */
  const duocLapBienBan =
    laKho &&
    (yeuCau.status === 'DA_DUYET' ||
      yeuCau.status === 'DA_XUAT' ||
      yeuCau.status === 'DA_HOAN_TAT');

  /**
   * XUẤT BIÊN BẢN WORD THẲNG TỪ ĐÂY — không phải sang trang Biên bản chọn lại.
   *
   * Server điền sẵn hai bên từ trang Cài đặt và từ điểm lưu trữ, dựng file rồi
   * lưu lại luôn; bấm nhiều lần vẫn là một biên bản, không cấp số mới.
   */
  async function xuatBBBG(yc: YeuCau): Promise<void> {
    datLoi(null);
    datThongBao(null);
    datDangXuatBBBG(true);
    try {
      const kq = await goiApi<{ ok: true; bbbg: BienBan; moi: boolean }>(
        `/api/bbbg/tu-yeu-cau/${yc.id}`,
        { method: 'POST' },
      );
      await taiTep(`/api/bbbg/${kq.bbbg.id}/tep`, kq.bbbg.fileName ?? `${kq.bbbg.code}.docx`);
      datThongBao(
        kq.moi
          ? `Đã lập biên bản ${kq.bbbg.code} và tải file Word về máy. Bản mềm được lưu trong mục Biên bản.`
          : `Yêu cầu này đã có biên bản ${kq.bbbg.code} — đã tải lại file Word về máy.`,
      );
      // Nạp lại để nút "Mở biên bản …" hiện ra ngay, khỏi phải tải lại trang.
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không xuất được biên bản bàn giao.');
    } finally {
      datDangXuatBBBG(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
            <Link to="/yeu-cau">
              <ArrowLeft aria-hidden />
              Về danh sách
            </Link>
          </Button>
          <h1 className="font-mono text-xl font-semibold sm:text-2xl">{yeuCau.code}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {NHAN_LOAI_YEU_CAU[yeuCau.type]}
            <Badge variant={MAU_TRANG_THAI[yeuCau.status]}>
              {NHAN_TRANG_THAI_YEU_CAU[yeuCau.status]}
            </Badge>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {duocGuiDuyet ? (
            <>
              <Button
                disabled={dangChay}
                onClick={() => void hanhDong('/gui-duyet', undefined, 'Đã gửi duyệt.')}
              >
                <Send aria-hidden />
                Gửi duyệt
              </Button>
              <Button variant="outline" className="text-destructive-dam" onClick={() => void xoaNhap()}>
                <Trash2 aria-hidden />
                Xoá nháp
              </Button>
            </>
          ) : null}

          {/* Quản trị và vận hành xoá được phiếu ở mọi trạng thái; server mới là
              chỗ chặn thật, đây chỉ là ẩn nút cho gọn mắt. */}
          {duocXoaPhieu && yeuCau.status !== 'BAN_NHAP' ? (
            <Button
              variant="outline"
              className="text-destructive-dam"
              disabled={dangChay}
              onClick={() => datHoiXoa(true)}
            >
              <Trash2 aria-hidden />
              Xoá yêu cầu
            </Button>
          ) : null}

          {duocDuyet ? (
            <>
              <Button
                disabled={dangChay}
                onClick={() => void hanhDong('/duyet', {}, 'Đã duyệt yêu cầu.')}
              >
                <Check aria-hidden />
                Duyệt
              </Button>
              <Button
                variant="outline"
                className="text-destructive-dam"
                disabled={dangChay}
                onClick={() => {
                  const lyDo = window.prompt('Lý do từ chối (ít nhất 5 ký tự):');
                  if (lyDo && lyDo.trim().length >= 5) {
                    void hanhDong('/tu-choi', { rejectionNote: lyDo.trim() }, 'Đã từ chối yêu cầu.');
                  }
                }}
              >
                <X aria-hidden />
                Từ chối
              </Button>
            </>
          ) : null}

          {duocXuat ? (
            <Button asChild>
              <Link to={`/kho/xuat/${yeuCau.id}`}>
                <PackageOpen aria-hidden />
                Xuất kho
              </Link>
            </Button>
          ) : null}
          {duocNhap ? (
            <Button asChild>
              <Link to={`/kho/nhap/${yeuCau.id}`}>
                <PackageCheck aria-hidden />
                Nhập kho
              </Link>
            </Button>
          ) : null}
          {/* Đã có biên bản thì dẫn thẳng sang, không bắt đi vòng qua mục Biên bản. */}
          {yeuCau.handoverNotes[0] ? (
            <Button variant="outline" asChild>
              <Link to={`/bbbg/${yeuCau.handoverNotes[0].id}`}>
                <FileSignature aria-hidden />
                Mở biên bản {yeuCau.handoverNotes[0].code}
              </Link>
            </Button>
          ) : null}
          {duocLapBienBan ? (
            <>
              <Button disabled={dangXuatBBBG} onClick={() => void xuatBBBG(yeuCau)}>
                {dangXuatBBBG ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <FileDown aria-hidden />
                )}
                Xuất biên bản (Word)
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/bbbg/moi?yeuCau=${yeuCau.id}`}>
                  <FileSignature aria-hidden />
                  Lập biên bản chi tiết
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}
      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {hoiXoa ? (
        <Alert variant="warning" tieuDe="Xoá yêu cầu này?">
          <div className="space-y-3">
            <p>
              Phiếu sẽ vào <strong>thùng rác</strong> và khôi phục lại được. Nhưng việc đã xảy ra
              thì không hoàn tác: <strong>hàng đã ra khỏi kho vẫn ở ngoài kho</strong>, nhật ký di
              chuyển và tồn kho giữ nguyên. Muốn hàng quay về thì phải lập yêu cầu nhập kho.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={dangChay} onClick={() => void xoaMem()}>
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

      {yeuCau.status === 'CHO_DUYET' && laNguoiTao && laNguoiDuyet ? (
        <Alert variant="info" tieuDe="Bạn không tự duyệt yêu cầu của mình được">
          Đây là yêu cầu do chính bạn tạo. Nhờ một người có quyền duyệt khác xử lý — đây là chốt
          phân định trách nhiệm, máy chủ chặn chứ không phải giao diện ẩn nút.
        </Alert>
      ) : null}
      {yeuCau.status === 'TU_CHOI' && yeuCau.rejectionNote ? (
        <Alert variant="destructive" tieuDe="Yêu cầu bị từ chối">
          {yeuCau.rejectionNote}
        </Alert>
      ) : null}
      {yeuCau.status === 'DA_XUAT' ? (
        <Alert variant="warning" tieuDe="Đã xuất, đang chờ bên nhận xác nhận">
          Thiết bị đang ở trạng thái “Đang vận chuyển”. Vị trí sở hữu chỉ đổi khi bên nhận xác nhận
          biên bản bàn giao.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin yêu cầu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Muc nhan="Người tạo">
              {yeuCau.createdBy.fullName}
              <span className="block text-xs font-normal text-muted-foreground">
                {yeuCau.createdBy.department ?? yeuCau.createdBy.email}
              </span>
            </Muc>
            <Muc nhan="Nơi đến">{yeuCau.toLocation?.name ?? yeuCau.destinationNote ?? '—'}</Muc>
            <Muc nhan="Dự kiến trả">{ngay(yeuCau.expectedReturnAt)}</Muc>
            <Muc nhan="Gửi duyệt lúc">{ngayGio(yeuCau.submittedAt)}</Muc>
            <Muc nhan="Người duyệt">
              {yeuCau.approvedBy?.fullName ?? '—'}
              {yeuCau.approvedAt ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  {ngayGio(yeuCau.approvedAt)}
                </span>
              ) : null}
            </Muc>
            <Muc nhan="Hoàn tất lúc">{ngayGio(yeuCau.completedAt)}</Muc>
          </dl>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Lý do</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{yeuCau.reason}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thiết bị ({yeuCau.items.length})</CardTitle>
          <CardDescription>Tham chiếu theo mã, không nhập tên tự do.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead>Vị trí hiện tại</TableHead>
                <TableHead>Tình trạng</TableHead>
                <TableHead>Phân bổ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yeuCau.items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      to={`/thiet-bi/${m.asset.id}`}
                      className="font-mono text-sm text-primary-dam hover:underline"
                    >
                      {m.asset.code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.asset.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.asset.currentLocation?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {NHAN_TINH_TRANG[m.asset.condition]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {NHAN_TRANG_THAI_PHAN_BO[m.asset.allocationStatus]}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
