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
import { useXacNhan } from '@/components/ui/hop-xac-nhan';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import { taiTep } from '@/lib/tep';
import type { BienBan, YeuCau } from '@/lib/kieu';
import { MAU_TRANG_THAI } from './tien-ich';

/** Loại yêu cầu đưa hàng ra khỏi kho / đưa hàng về kho. */
const LOAI_XUAT = new Set(['XUAT_KHO', 'PHAN_BO_VE_TRUONG', 'LUAN_CHUYEN_TRUONG', 'CHO_MUON']);
const LOAI_NHAP = new Set(['NHAP_KHO', 'TRA_VE_KHO']);
/**
 * Trạng thái còn chờ thực hiện. Không còn bước duyệt: phiếu tạo xong là xuất /
 * nhập kho được ngay. Phiếu cũ đang "Chờ duyệt" / "Đã duyệt" cũng thực hiện
 * tiếp được, không bị kẹt. Trùng với `TRANG_THAI_CHO_THUC_HIEN` ở máy chủ.
 */
const CHO_THUC_HIEN = new Set(['BAN_NHAP', 'CHO_DUYET', 'DA_DUYET']);

function Muc({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export function YeuCauChiTiet() {
  const hoi = useXacNhan();
  const { id } = useParams<{ id: string }>();
  const { nguoiDung } = useAuth();
  const dieuHuong = useNavigate();

  const [yeuCau, datYeuCau] = useState<YeuCau | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);
  const [dangXuatBBBG, datDangXuatBBBG] = useState(false);
  const [hoiXoa, datHoiXoa] = useState(false);
  const [hoiGhiNhan, datHoiGhiNhan] = useState(false);

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
    if (!(await hoi({
      tieuDe: 'Huỷ phiếu này?',
      noiDung: 'Phiếu chưa xuất / nhập gì nên huỷ không ảnh hưởng tồn kho.',
      nutCo: 'Có, huỷ phiếu',
    }))) return;
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
  const laQuanLy = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  /**
   * Xoá phiếu / biên bản: quản trị hệ thống và vận hành thiết bị.
   * Trùng với `duocXoaPhieu` ở máy chủ — nơi thật sự chặn.
   */
  const duocXoaPhieu = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  const laKho =
    nguoiDung?.role === 'KHO' || nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';

  const choThucHien = CHO_THUC_HIEN.has(yeuCau.status);
  // Người lập tự xuất / nhập phiếu của mình, kho làm được mọi phiếu. Máy chủ
  // kiểm lại (tài khoản trường chỉ với hàng của trường mình).
  const duocThucHien = choThucHien && (laKho || laNguoiTao);
  const duocHuyNhap = yeuCau.status === 'BAN_NHAP' && (laNguoiTao || nguoiDung?.role === 'ADMIN');
  // Quản trị / vận hành huỷ được phiếu chưa thực hiện, kèm lý do.
  const duocTuChoi = choThucHien && laQuanLy;
  /*
   * XÁC NHẬN BÀN GIAO — Quản trị / Vận hành làm trung gian, bên nhận không bấm.
   * Phân bổ / luân chuyển đã xuất kho; hoặc biên bản cũ lỡ gửi "chờ xác nhận".
   */
  const laLuongC = yeuCau.type === 'PHAN_BO_VE_TRUONG' || yeuCau.type === 'LUAN_CHUYEN_TRUONG';
  // Hàng đang trên đường: xác nhận mới ghi hàng về nơi nhận.
  const dangTrenDuong = yeuCau.status === 'DA_XUAT' && laLuongC;
  // Biên bản cũ lỡ gửi "chờ xác nhận" của phiếu đã ghi xong tồn kho — chỉ đóng.
  const bienBanCu =
    !dangTrenDuong && yeuCau.handoverNotes.some((b) => b.status === 'CHO_XAC_NHAN');
  const choXacNhanBanGiao = dangTrenDuong || bienBanCu;
  const duocXacNhanBanGiao = choXacNhanBanGiao && laQuanLy;
  const duocHuyBanGiao = dangTrenDuong && laQuanLy;
  // Phiếu cũ: approvedBy là người DUYỆT. API mới ghi người xác nhận bàn giao cùng
  // một thời điểm với lúc hoàn tất — dùng đúng dấu đó để gọi đúng tên.
  const laNguoiXacNhan =
    yeuCau.status === 'DA_HOAN_TAT' &&
    laLuongC &&
    yeuCau.approvedAt !== null &&
    yeuCau.approvedAt === yeuCau.completedAt;

  async function xacNhanBanGiao(): Promise<void> {
    if (
      !(await hoi(
        dangTrenDuong
          ? {
              tieuDe: `Xác nhận đã bàn giao phiếu ${yeuCau?.code ?? ''}?`,
              noiDung:
                'Hệ thống ghi thiết bị đã về ' +
                (yeuCau?.toLocation?.name ?? 'nơi nhận') +
                ', trừ ở nơi gửi và cập nhật số lượng trên Tổng quan ngay. Thao tác không hoàn lại.',
              nutCo: 'Có, xác nhận',
              nguyHiem: false,
            }
          : {
              tieuDe: 'Đóng biên bản cũ của phiếu này?',
              noiDung: 'Tồn kho đã ghi lúc xuất / nhập kho — đóng biên bản không đổi số lượng.',
              nutCo: 'Có, đóng biên bản',
              nguyHiem: false,
            },
      ))
    ) {
      return;
    }
    await hanhDong(
      '/xac-nhan-ban-giao',
      {},
      dangTrenDuong
        ? 'Đã xác nhận bàn giao. Số lượng trên Tổng quan đã cập nhật.'
        : 'Đã đóng biên bản.',
    );
  }
  const duocXuat = duocThucHien && LOAI_XUAT.has(yeuCau.type);
  const duocNhap = duocThucHien && LOAI_NHAP.has(yeuCau.type);
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
    laKho && (choThucHien || yeuCau.status === 'DA_XUAT' || yeuCau.status === 'DA_HOAN_TAT');

  /*
   * BIÊN BẢN ĐÃ XUẤT MÀ TỒN KHO CHƯA ĐỔI — trạng thái nửa vời phải nhìn thấy.
   *
   * Duyệt xong bấm "Xuất biên bản" là có tờ giấy hai bên ký, hàng rời kho ngay
   * lúc đó; nhưng tồn kho và tình trạng chỉ đổi ở bước xuất/nhập kho. Không nói
   * ra thì người dùng tưởng xong việc rồi, còn dashboard thì vẫn báo thiết bị
   * nằm trong kho — đúng lỗi đã dựng lại được.
   */
  const bienBanDaCoFile = Boolean(yeuCau.handoverNotes[0]?.fileName);
  const duocGhiNhanTheoBienBan =
    laKho && choThucHien && bienBanDaCoFile && (duocXuat || duocNhap);

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
      // Nói luôn phần việc CÒN LẠI. Xuất biên bản chỉ ra tờ giấy; tồn kho và
      // tình trạng chỉ đổi khi ghi nhận xuất/nhập kho. Thiếu câu này thì người
      // dùng tưởng đã xong và không hiểu vì sao số liệu đứng im.
      const conPhaiGhiNhan = CHO_THUC_HIEN.has(yc.status);
      datThongBao(
        (kq.moi
          ? `Đã lập biên bản ${kq.bbbg.code} và tải file Word về máy. Bản mềm được lưu trong mục Biên bản.`
          : `Yêu cầu này đã có biên bản ${kq.bbbg.code} — đã tải lại file Word về máy.`) +
          (conPhaiGhiNhan
            ? ' Tồn kho và tình trạng thiết bị CHƯA đổi — còn phải ghi nhận bàn giao (xem ô màu vàng bên dưới).'
            : ''),
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
          {duocHuyNhap ? (
            <Button variant="outline" className="text-destructive-dam" onClick={() => void xoaNhap()}>
              <Trash2 aria-hidden />
              Huỷ phiếu
            </Button>
          ) : null}

          {/* Quản trị và vận hành xoá được phiếu ở mọi trạng thái; server mới là
              chỗ chặn thật, đây chỉ là ẩn nút cho gọn mắt. */}
          {duocXoaPhieu && yeuCau.status !== 'BAN_NHAP' && yeuCau.status !== 'DA_XUAT' ? (
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

          {duocTuChoi ? (
            <Button
              variant="outline"
              className="text-destructive-dam"
              disabled={dangChay}
              onClick={() => {
                const lyDo = window.prompt('Lý do huỷ / từ chối phiếu (ít nhất 5 ký tự):');
                if (lyDo && lyDo.trim().length >= 5) {
                  void hanhDong('/tu-choi', { rejectionNote: lyDo.trim() }, 'Đã từ chối phiếu.');
                }
              }}
            >
              <X aria-hidden />
              Từ chối
            </Button>
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

      {duocGhiNhanTheoBienBan && !hoiGhiNhan ? (
        <Alert
          variant="warning"
          tieuDe={`Đã có biên bản ${yeuCau.handoverNotes[0]?.code} nhưng CHƯA ghi nhận ${
            duocNhap ? 'nhập kho' : 'xuất kho'
          }`}
        >
          <div className="space-y-3">
            <p className="text-sm">
              Tồn kho và tình trạng thiết bị chưa đổi, nên các trang số liệu vẫn tính thiết bị
              này nằm ở chỗ cũ. Chọn một trong hai cách để ghi nhận:
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to={duocNhap ? `/kho/nhap/${yeuCau.id}` : `/kho/xuat/${yeuCau.id}`}>
                  {duocNhap ? <PackageCheck aria-hidden /> : <PackageOpen aria-hidden />}
                  {duocNhap ? 'Nhập kho kèm ảnh' : 'Xuất kho kèm ảnh'}
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => datHoiGhiNhan(true)}>
                <FileSignature aria-hidden />
                Ghi nhận theo biên bản (không cần ảnh)
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {hoiGhiNhan ? (
        <Alert variant="warning" tieuDe="Ghi nhận bàn giao theo biên bản?">
          <div className="space-y-3">
            <p className="text-sm">
              Hệ thống sẽ ghi nhận đúng số lượng đã duyệt của yêu cầu{' '}
              <strong>{yeuCau.code}</strong>, lấy biên bản{' '}
              <strong>{yeuCau.handoverNotes[0]?.code}</strong> làm bằng chứng thay cho ảnh chụp.
              Tồn kho và tình trạng thiết bị sẽ đổi ngay. Muốn có ảnh chụp thực tế thì dùng màn
              hình {duocNhap ? 'Nhập kho' : 'Xuất kho'} thay vì cách này.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={dangChay}
                onClick={() => {
                  datHoiGhiNhan(false);
                  void hanhDong(
                    '/ghi-nhan-bien-ban',
                    undefined,
                    `Đã ghi nhận bàn giao theo biên bản ${yeuCau.handoverNotes[0]?.code}. Tồn kho và tình trạng đã cập nhật.`,
                  );
                }}
              >
                Ghi nhận
              </Button>
              <Button size="sm" variant="ghost" onClick={() => datHoiGhiNhan(false)}>
                Thôi
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

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

      {duocXuat || duocNhap ? (
        <Alert variant="info" tieuDe={`Phiếu chờ ${duocNhap ? 'nhập' : 'xuất'} kho`}>
          Không cần chờ duyệt: bấm <strong>{duocNhap ? 'Nhập kho' : 'Xuất kho'}</strong>, chụp ảnh
          từng thiết bị rồi hoàn tất — tồn kho đổi ngay, quản trị được báo tự động.
        </Alert>
      ) : null}
      {yeuCau.status === 'TU_CHOI' && yeuCau.rejectionNote ? (
        <Alert variant="destructive" tieuDe="Yêu cầu bị từ chối">
          {yeuCau.rejectionNote}
        </Alert>
      ) : null}
      {choXacNhanBanGiao ? (
        <Alert
          variant="warning"
          tieuDe={
            bienBanCu
              ? 'Biên bản cũ đang chờ đóng'
              : duocXacNhanBanGiao
                ? 'Đã xuất kho — chờ bạn xác nhận bàn giao'
                : 'Đã xuất kho — chờ Quản trị / Vận hành xác nhận bàn giao'
          }
        >
          <div className="space-y-3">
            {bienBanCu ? (
              <p className="text-sm">
                Tồn kho của phiếu này đã ghi ngay lúc xuất / nhập kho. Quản trị / Vận hành bấm xác
                nhận chỉ để đóng biên bản — không ghi thêm gì, số lượng không đổi.
              </p>
            ) : (
              <p className="text-sm">
                Hàng đang ở ô &ldquo;Đang chuyển&rdquo;. Bên nhận <strong>không cần bấm gì</strong>:
                khi Quản trị hệ thống hoặc Vận hành thiết bị xác nhận, thiết bị được ghi về{' '}
                <strong>{yeuCau.toLocation?.name ?? 'nơi nhận'}</strong> và số lượng trên Tổng quan
                đổi ngay.
              </p>
            )}
            {duocXacNhanBanGiao ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={dangChay} onClick={() => void xacNhanBanGiao()}>
                  {dangChay ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  {bienBanCu ? 'Đóng biên bản cũ' : 'Xác nhận đã bàn giao'}
                </Button>
                {duocHuyBanGiao ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive-dam"
                    disabled={dangChay}
                    onClick={() => {
                      const lyDo = window.prompt(
                        'Lý do huỷ bàn giao (ít nhất 5 ký tự) — hàng sẽ tính lại ở nơi gửi:',
                      );
                      if (lyDo && lyDo.trim().length >= 5) {
                        void hanhDong(
                          '/tu-choi',
                          { rejectionNote: lyDo.trim() },
                          'Đã huỷ bàn giao — hàng tính lại ở nơi gửi.',
                        );
                      }
                    }}
                  >
                    <X aria-hidden />
                    Huỷ bàn giao
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
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
            <Muc nhan={LOAI_NHAP.has(yeuCau.type) ? 'Nhận từ' : 'Nơi đi'}>
              {yeuCau.fromLocation?.name ??
                (LOAI_NHAP.has(yeuCau.type) ? 'Bên ngoài / nhân sự trả' : 'Kho còn hàng (tự chọn)')}
            </Muc>
            <Muc nhan={LOAI_NHAP.has(yeuCau.type) ? 'Kho nhận' : 'Nơi đến'}>
              {yeuCau.toLocation?.name ??
                yeuCau.destinationNote ??
                (yeuCau.type === 'CHO_MUON' ? `Nhân sự: ${yeuCau.createdBy.fullName}` : '—')}
            </Muc>
            <Muc nhan="Dự kiến trả">{ngay(yeuCau.expectedReturnAt)}</Muc>
            <Muc nhan="Lập lúc">{ngayGio(yeuCau.createdAt)}</Muc>
            {/* Phiếu cũ còn người duyệt thì hiện; phiếu mới không qua bước duyệt. */}
            {yeuCau.approvedBy ? (
              <Muc nhan={laNguoiXacNhan ? 'Người xác nhận bàn giao' : 'Người duyệt'}>
                {yeuCau.approvedBy.fullName}
                {yeuCau.approvedAt ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {ngayGio(yeuCau.approvedAt)}
                  </span>
                ) : null}
              </Muc>
            ) : null}
            <Muc nhan="Hoàn tất lúc">{ngayGio(yeuCau.completedAt)}</Muc>
          </dl>
          <div className="rounded-md bg-muted p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Lý do</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{yeuCau.reason}</p>
          </div>
          {yeuCau.note ? (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Ghi chú (mượn thêm từ kho khác…)
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{yeuCau.note}</p>
            </div>
          ) : null}
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
