import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileSignature, Loader2 } from 'lucide-react';
import {
  DS_MAU_BBBG,
  MO_TA_MAU_BBBG,
  NHAN_LOAI_YEU_CAU,
  NHAN_TINH_TRANG,
  type LoaiYeuCau,
} from '@ltl/taisan-shared';
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
import type { BienBan, CaiDatChung, DiaDiem, TrangDuLieu, YeuCau } from '@/lib/kieu';
import type { MauBBBG } from './mau';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function homNay(): string {
  const d = new Date();
  const thang = String(d.getMonth() + 1).padStart(2, '0');
  const ngayTrongThang = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${thang}-${ngayTrongThang}`;
}

/**
 * Lập biên bản bàn giao từ một yêu cầu ĐÃ DUYỆT.
 *
 * Ba điều làm nên trang này:
 *   1. MỖI LOẠI YÊU CẦU MỘT MẪU RIÊNG. Chọn yêu cầu là mẫu tự đổi theo, kéo
 *      theo tên văn bản, dòng V/v, kết quả kiểm tra và trách nhiệm các Bên.
 *   2. ĐIỀN SẴN TỐI ĐA: bên LtL lấy từ trang Cài đặt, bên còn lại lấy từ điểm
 *      lưu trữ đã khai trong danh mục. Người lập chỉ sửa chỗ nào khác thực tế.
 *   3. THẤY TRƯỚC KHI KÝ: các mục sẽ in ra đều hiện ngay ở đây và sửa được,
 *      không phải lập xong mới biết mình vừa ký cái gì.
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
  const [caiDat, datCaiDat] = useState<CaiDatChung | null>(null);
  const [dsMau, datDsMau] = useState<Record<LoaiYeuCau, MauBBBG> | null>(null);
  const [dangTaiDs, datDangTaiDs] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangLuu, datDangLuu] = useState(false);

  const [requestId, datRequestId] = useState(thamSo.get('yeuCau') ?? '');
  const [templateType, datTemplateType] = useState<LoaiYeuCau | ''>('');
  const [subtitle, datSubtitle] = useState('');
  const [basis, datBasis] = useState('');
  const [giverName, datGiverName] = useState('');
  const [giverTitle, datGiverTitle] = useState('');
  const [giverOrg, datGiverOrg] = useState('');
  const [giverAddress, datGiverAddress] = useState('');
  const [giverTaxCode, datGiverTaxCode] = useState('');
  const [giverPhone, datGiverPhone] = useState('');
  const [receiverOrg, datReceiverOrg] = useState('');
  const [receiverName, datReceiverName] = useState('');
  const [receiverTitle, datReceiverTitle] = useState('');
  const [receiverPhone, datReceiverPhone] = useState('');
  const [receiverAddress, datReceiverAddress] = useState('');
  const [issuedDate, datIssuedDate] = useState(homNay());
  const [handoverPlace, datHandoverPlace] = useState('');
  const [inspection, datInspection] = useState('');
  const [obligations, datObligations] = useState('');
  const [commitment, datCommitment] = useState('');
  const [copies, datCopies] = useState(4);
  const [note, datNote] = useState('');

  const tai = useCallback(async () => {
    datDangTaiDs(true);
    datLoi(null);
    try {
      const [ycDuyet, ycXuat, ycXong, dd, cd, mau] = await Promise.all([
        goiApi<TrangDuLieu<YeuCau>>('/api/yeu-cau?status=DA_DUYET&moiTrang=100'),
        goiApi<TrangDuLieu<YeuCau>>('/api/yeu-cau?status=DA_XUAT&moiTrang=100'),
        goiApi<TrangDuLieu<YeuCau>>('/api/yeu-cau?status=DA_HOAN_TAT&moiTrang=100'),
        goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true'),
        goiApi<{ ok: true; caiDat: CaiDatChung }>('/api/cai-dat'),
        goiApi<{ ok: true; mau: Record<LoaiYeuCau, MauBBBG> }>('/api/bbbg/mau'),
      ]);
      datDsYeuCau([...ycDuyet.muc, ...ycXuat.muc, ...ycXong.muc]);
      datDsDiaDiem(dd.muc);
      datCaiDat(cd.caiDat);
      datDsMau(mau.mau);
      datCopies(cd.caiDat.soBan);
      datBasis(cd.caiDat.canCu);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách yêu cầu.');
    } finally {
      datDangTaiDs(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  const yeuCau = useMemo(() => dsYeuCau.find((y) => y.id === requestId) ?? null, [dsYeuCau, requestId]);
  const mau = templateType && dsMau ? dsMau[templateType] : null;

  // Chọn yêu cầu → mẫu đi theo loại yêu cầu. Người lập đổi lại được.
  useEffect(() => {
    if (yeuCau) datTemplateType(yeuCau.type);
  }, [yeuCau]);

  /*
   * ĐIỀN SẴN HAI BÊN.
   *
   * Bên nào là LtL lấy theo trang Cài đặt, bên còn lại lấy theo điểm lưu trữ.
   * Chạy lại mỗi khi đổi yêu cầu hoặc đổi mẫu, vì đổi mẫu có thể đảo vai hai bên
   * (xuất kho thì LtL giao, nhập kho thì LtL nhận).
   */
  useEffect(() => {
    if (!yeuCau || !mau || !caiDat) return;
    const diemDen = dsDiaDiem.find((d) => d.id === yeuCau.toLocation?.id) ?? null;
    const diemDi = dsDiaDiem.find((d) => d.id === yeuCau.fromLocation?.id) ?? null;
    const doiTac = mau.benGiaoLaLtL ? diemDen : (diemDi ?? diemDen);
    const tenDoiTac =
      (mau.benGiaoLaLtL ? yeuCau.toLocation?.name : yeuCau.fromLocation?.name) ??
      doiTac?.name ??
      yeuCau.destinationNote ??
      '';

    if (mau.benGiaoLaLtL) {
      datGiverOrg(caiDat.congTyTen);
      datGiverName(caiDat.daiDienTen || nguoiDung?.fullName || '');
      datGiverTitle(caiDat.daiDienChucVu);
      datGiverAddress(caiDat.congTyDiaChi);
      datGiverTaxCode(caiDat.congTyMaSoThue);
      datGiverPhone(caiDat.congTyDienThoai);
      datReceiverOrg(tenDoiTac);
      datReceiverName(doiTac?.contactName ?? '');
      datReceiverPhone(doiTac?.contactPhone ?? '');
      datReceiverAddress(doiTac?.address ?? '');
      datHandoverPlace(doiTac?.address ?? tenDoiTac);
    } else {
      datGiverOrg(tenDoiTac);
      datGiverName(doiTac?.contactName ?? '');
      datGiverTitle('');
      datGiverAddress(doiTac?.address ?? '');
      datGiverTaxCode('');
      datGiverPhone(doiTac?.contactPhone ?? '');
      datReceiverOrg(caiDat.congTyTen);
      datReceiverName(caiDat.daiDienTen || nguoiDung?.fullName || '');
      datReceiverTitle(caiDat.daiDienChucVu);
      datReceiverPhone(caiDat.congTyDienThoai);
      datReceiverAddress(caiDat.congTyDiaChi);
      datHandoverPlace(caiDat.congTyDiaChi);
    }
  }, [yeuCau, mau, caiDat, dsDiaDiem, nguoiDung]);

  // Nội dung mẫu: kết quả kiểm tra, trách nhiệm, cam kết, dòng V/v.
  useEffect(() => {
    if (!mau) return;
    datInspection(mau.ketQuaKiemTra.join('\n'));
    datObligations(mau.trachNhiem.join('\n'));
    datCommitment(mau.camKet);
  }, [mau]);

  // Dòng V/v luôn nêu tên ĐƠN VỊ ĐỐI TÁC, không phải lúc nào cũng là bên nhận:
  // mẫu nhập kho / trả về kho thì LtL là bên nhận, đối tác là bên giao.
  useEffect(() => {
    if (!mau) return;
    const doiTac = (mau.benGiaoLaLtL ? receiverOrg : giverOrg) || '…………';
    datSubtitle(mau.vViec.replace('{noiNhan}', doiTac));
  }, [mau, receiverOrg, giverOrg]);

  async function luu(su: React.FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datDangLuu(true);
    try {
      const kq = await goiApi<{ ok: true; bbbg: BienBan }>('/api/bbbg', {
        method: 'POST',
        than: {
          requestId,
          ...(templateType ? { templateType } : {}),
          subtitle: subtitle.trim(),
          basis: basis.trim(),
          giverName: giverName.trim(),
          giverTitle: giverTitle.trim(),
          giverOrg: giverOrg.trim(),
          giverAddress: giverAddress.trim(),
          giverTaxCode: giverTaxCode.trim(),
          giverPhone: giverPhone.trim(),
          receiverOrg: receiverOrg.trim(),
          receiverName: receiverName.trim(),
          receiverTitle: receiverTitle.trim(),
          receiverPhone: receiverPhone.trim(),
          receiverAddress: receiverAddress.trim(),
          issuedDate,
          handoverPlace: handoverPlace.trim(),
          inspection: inspection.trim(),
          obligations: obligations.trim(),
          commitment: commitment.trim(),
          copies,
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
          Chọn yêu cầu đã duyệt, mẫu biên bản tự chọn theo loại yêu cầu. Danh sách thiết bị lấy tự
          động từ yêu cầu.
        </p>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <form onSubmit={(su) => void luu(su)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Yêu cầu nguồn và mẫu biên bản</CardTitle>
            <CardDescription>
              Hiện yêu cầu đang ở trạng thái Đã duyệt, Đã xuất hoặc Đã hoàn tất.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="bb-yeu-cau">Yêu cầu</Label>
                <Select
                  id="bb-yeu-cau"
                  required
                  value={requestId}
                  onChange={(su) => datRequestId(su.target.value)}
                  disabled={dangTaiDs}
                >
                  <option value="">{dangTaiDs ? 'Đang tải…' : '— Chọn yêu cầu —'}</option>
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
                    Chưa có yêu cầu nào được duyệt. Hãy duyệt yêu cầu rồi quay lại lập biên bản.
                  </p>
                ) : null}
              </div>

              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="bb-mau">Mẫu biên bản</Label>
                <Select
                  id="bb-mau"
                  value={templateType}
                  onChange={(su) => datTemplateType(su.target.value as LoaiYeuCau)}
                >
                  <option value="">— Chọn mẫu —</option>
                  {DS_MAU_BBBG.map((m) => (
                    <option key={m.ma} value={m.ma}>
                      {m.nhan}
                    </option>
                  ))}
                </Select>
                {templateType ? (
                  <p className="text-xs text-muted-foreground">{MO_TA_MAU_BBBG[templateType]}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bb-vviec">Trích yếu (dòng &quot;V/v …&quot; dưới tên văn bản)</Label>
              <Input
                id="bb-vviec"
                value={subtitle}
                onChange={(su) => datSubtitle(su.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bb-can-cu">Các dòng &quot;Căn cứ …&quot; — mỗi dòng một căn cứ</Label>
              <textarea
                id="bb-can-cu"
                rows={3}
                className={O_VAN_BAN}
                value={basis}
                onChange={(su) => datBasis(su.target.value)}
              />
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
              <CardTitle>{mau?.nhanBenGiao ?? 'Bên giao'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
              <div className="space-y-1.5">
                <Label htmlFor="bb-giao-dc">Địa chỉ</Label>
                <Input
                  id="bb-giao-dc"
                  required
                  value={giverAddress}
                  onChange={(su) => datGiverAddress(su.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bb-giao-mst">Mã số thuế</Label>
                  <Input
                    id="bb-giao-mst"
                    value={giverTaxCode}
                    onChange={(su) => datGiverTaxCode(su.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bb-giao-dt">Điện thoại</Label>
                  <Input
                    id="bb-giao-dt"
                    inputMode="tel"
                    required
                    value={giverPhone}
                    onChange={(su) => datGiverPhone(su.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bb-giao-ten">Đại diện — họ tên</Label>
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
                    required
                    value={giverTitle}
                    placeholder="Trưởng phòng Chuyên môn"
                    onChange={(su) => datGiverTitle(su.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{mau?.nhanBenNhan ?? 'Bên nhận'}</CardTitle>
              <CardDescription>
                Điền sẵn theo điểm lưu trữ trong danh mục; sửa lại nếu thực tế khác.
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
                <Label htmlFor="bb-nhan-dc">Địa chỉ</Label>
                <Input
                  id="bb-nhan-dc"
                  required
                  value={receiverAddress}
                  onChange={(su) => datReceiverAddress(su.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bb-nhan-ten">Đại diện — họ tên</Label>
                  <Input
                    id="bb-nhan-ten"
                    required
                    minLength={2}
                    value={receiverName}
                    onChange={(su) => datReceiverName(su.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bb-nhan-cv">Chức vụ</Label>
                  <Input
                    id="bb-nhan-cv"
                    required
                    value={receiverTitle}
                    placeholder="Hiệu trưởng"
                    onChange={(su) => datReceiverTitle(su.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:max-w-[16rem]">
                <Label htmlFor="bb-nhan-dt">Số điện thoại</Label>
                <Input
                  id="bb-nhan-dt"
                  inputMode="tel"
                  required
                  value={receiverPhone}
                  placeholder="0912345678"
                  onChange={(su) => datReceiverPhone(su.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nội dung biên bản</CardTitle>
            <CardDescription>
              Điền sẵn theo mẫu đã chọn. Sửa ở đây là sửa đúng chữ sẽ in ra file Word.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bb-ngay">Ngày lập biên bản</Label>
                <Input
                  id="bb-ngay"
                  type="date"
                  required
                  value={issuedDate}
                  onChange={(su) => datIssuedDate(su.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bb-noi">Địa điểm bàn giao</Label>
                <Input
                  id="bb-noi"
                  required
                  value={handoverPlace}
                  placeholder="Phòng Tin học, Trường Tiểu học An Dương Vương"
                  onChange={(su) => datHandoverPlace(su.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bb-kiem-tra">Kết quả kiểm tra khi bàn giao — mỗi dòng một ý</Label>
              <textarea
                id="bb-kiem-tra"
                rows={3}
                className={O_VAN_BAN}
                value={inspection}
                onChange={(su) => datInspection(su.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bb-trach-nhiem">Trách nhiệm của các Bên — mỗi dòng một ý</Label>
              <textarea
                id="bb-trach-nhiem"
                rows={5}
                className={O_VAN_BAN}
                value={obligations}
                onChange={(su) => datObligations(su.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bb-cam-ket">Cam kết</Label>
              <textarea
                id="bb-cam-ket"
                rows={3}
                className={O_VAN_BAN}
                value={commitment}
                onChange={(su) => datCommitment(su.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bb-so-ban">Số bản được lập</Label>
                <Input
                  id="bb-so-ban"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={copies}
                  onChange={(su) => datCopies(Number(su.target.value))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bb-ghi-chu">Ghi chú khác — mỗi dòng một ý</Label>
                <textarea
                  id="bb-ghi-chu"
                  rows={2}
                  className={O_VAN_BAN}
                  value={note}
                  placeholder="Ví dụ: giao kèm 2 dây nguồn dự phòng."
                  onChange={(su) => datNote(su.target.value)}
                />
              </div>
            </div>
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
