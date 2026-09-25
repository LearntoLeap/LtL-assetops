import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import {
  DS_KIEU_QUAN_LY,
  DS_TINH_TRANG,
  type KieuQuanLy,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { OChonThemNhanh } from '@/components/OChonThemNhanh';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ChiTietThietBi, DanhMuc, DiaDiem, TrangDuLieu } from '@/lib/kieu';

interface Bieu {
  code: string;
  name: string;
  categoryId: string;
  productLineId: string;
  serialNumber: string;
  originId: string;
  originNote: string;
  receivedDate: string;
  value: string;
  purposeId: string;
  trackingType: KieuQuanLy;
  condition: string;
  nhapVeLocationId: string;
  soLuongNhap: string;
  dueReturnAt: string;
  note: string;
}

const BIEU_RONG: Bieu = {
  code: '',
  name: '',
  categoryId: '',
  productLineId: '',
  serialNumber: '',
  originId: '',
  originNote: '',
  receivedDate: new Date().toISOString().slice(0, 10),
  value: '',
  purposeId: '',
  trackingType: 'DON_VI',
  condition: 'TOT',
  nhapVeLocationId: '',
  soLuongNhap: '1',
  dueReturnAt: '',
  note: '',
};

export function FormThietBi() {
  const { id } = useParams<{ id: string }>();
  const dangSua = Boolean(id);
  const dieuHuong = useNavigate();
  const { nguoiDung } = useAuth();
  // Ai vào được form này thì cũng thêm được nguồn gốc / mục đích ngay tại chỗ —
  // khớp với `yeuCauVaiTro('ADMIN','VAN_HANH','KHO')` ở tuyến POST của API.
  // Ẩn nút chỉ cho gọn mắt, chặn thật vẫn nằm ở server.
  const duocThemDanhMuc =
    nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH' || nguoiDung?.role === 'KHO';

  const [bieu, datBieu] = useState<Bieu>(BIEU_RONG);
  const [loaiTaiSan, datLoaiTaiSan] = useState<DanhMuc[]>([]);
  const [dongGiaiPhap, datDongGiaiPhap] = useState<DanhMuc[]>([]);
  const [diaDiem, datDiaDiem] = useState<DiaDiem[]>([]);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);
  const [dangTai, datDangTai] = useState(true);

  useEffect(() => {
    async function tai(): Promise<void> {
      datDangTai(true);
      try {
        const [loai, dong, diem] = await Promise.all([
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/loai-tai-san'),
          goiApi<TrangDuLieu<DanhMuc>>('/api/danh-muc/dong-giai-phap'),
          goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true'),
        ]);
        datLoaiTaiSan(loai.muc.filter((l) => l.isActive));
        datDongGiaiPhap(dong.muc.filter((d) => d.isActive));
        datDiaDiem(diem.muc);

        if (id) {
          const ct = await goiApi<ChiTietThietBi>(`/api/thiet-bi/${id}`);
          const t = ct.thietBi;
          datBieu({
            code: t.code,
            name: t.name,
            categoryId: t.category.id,
            productLineId: t.productLine?.id ?? '',
            serialNumber: t.serialNumber ?? '',
            originId: t.origin.id,
            originNote: t.originNote ?? '',
            receivedDate: t.receivedDate ? t.receivedDate.slice(0, 10) : '',
            value: t.value === null ? '' : String(t.value),
            purposeId: t.purpose.id,
            trackingType: t.trackingType,
            condition: t.condition,
            nhapVeLocationId: t.currentLocation?.id ?? '',
            soLuongNhap: '1',
            dueReturnAt: t.dueReturnAt ? t.dueReturnAt.slice(0, 10) : '',
            note: t.note ?? '',
          });
        } else {
          datBieu((b) => ({
            ...b,
            categoryId: loai.muc[0]?.id ?? '',
            nhapVeLocationId:
              diem.muc.find((d) => d.type === 'KHO_VAN_PHONG')?.id ?? diem.muc[0]?.id ?? '',
          }));
        }
      } catch (e) {
        datLoi(e instanceof LoiApi ? e.message : 'Không tải được dữ liệu nền.');
      } finally {
        datDangTai(false);
      }
    }
    void tai();
  }, [id]);

  // Chọn loại tài sản thì gợi ý kiểu quản lý mặc định của loại đó (chỉ khi tạo mới).
  const loaiDangChon = useMemo(
    () => loaiTaiSan.find((l) => l.id === bieu.categoryId),
    [loaiTaiSan, bieu.categoryId],
  );
  useEffect(() => {
    if (dangSua || !loaiDangChon?.defaultTrackingType) return;
    datBieu((b) => ({ ...b, trackingType: loaiDangChon.defaultTrackingType as KieuQuanLy }));
  }, [dangSua, loaiDangChon]);

  const theoDonVi = bieu.trackingType === 'DON_VI';
  useEffect(() => {
    if (theoDonVi) datBieu((b) => (b.soLuongNhap === '1' ? b : { ...b, soLuongNhap: '1' }));
  }, [theoDonVi]);

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datDangGui(true);
    try {
      if (dangSua && id) {
        await goiApi(`/api/thiet-bi/${id}`, {
          method: 'PATCH',
          than: {
            name: bieu.name,
            categoryId: bieu.categoryId,
            productLineId: bieu.productLineId || null,
            serialNumber: bieu.serialNumber || null,
            originId: bieu.originId,
            originNote: bieu.originNote || null,
            receivedDate: bieu.receivedDate || null,
            value: bieu.value === '' ? null : Number(bieu.value),
            purposeId: bieu.purposeId,
            dueReturnAt: bieu.dueReturnAt || null,
            note: bieu.note || null,
          },
        });
        dieuHuong(`/thiet-bi/${id}`);
      } else {
        const kq = await goiApi<{ ok: true; thietBi: { id: string } }>('/api/thiet-bi', {
          method: 'POST',
          than: {
            code: bieu.code,
            name: bieu.name,
            categoryId: bieu.categoryId,
            ...(bieu.productLineId ? { productLineId: bieu.productLineId } : {}),
            ...(bieu.serialNumber ? { serialNumber: bieu.serialNumber } : {}),
            originId: bieu.originId,
            ...(bieu.originNote ? { originNote: bieu.originNote } : {}),
            ...(bieu.receivedDate ? { receivedDate: bieu.receivedDate } : {}),
            ...(bieu.value === '' ? {} : { value: Number(bieu.value) }),
            purposeId: bieu.purposeId,
            trackingType: bieu.trackingType,
            condition: bieu.condition,
            nhapVeLocationId: bieu.nhapVeLocationId,
            soLuongNhap: Number(bieu.soLuongNhap || '1'),
            ...(bieu.dueReturnAt ? { dueReturnAt: bieu.dueReturnAt } : {}),
            ...(bieu.note ? { note: bieu.note } : {}),
          },
        });
        dieuHuong(`/thiet-bi/${kq.thietBi.id}`);
      }
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Lưu thất bại.');
    } finally {
      datDangGui(false);
    }
  }

  const dat = (khoa: keyof Bieu) => (v: string) => datBieu((b) => ({ ...b, [khoa]: v }));

  if (dangTai) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to={dangSua && id ? `/thiet-bi/${id}` : '/thiet-bi'}>
            <ArrowLeft aria-hidden />
            Quay lại
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">
          {dangSua ? 'Sửa thiết bị' : 'Thêm thiết bị'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin</CardTitle>
          <CardDescription>
            {dangSua
              ? 'Vị trí, tình trạng và trạng thái phân bổ KHÔNG sửa ở đây — chúng chỉ đổi qua luồng yêu cầu đã duyệt hoặc điều chỉnh sau kiểm kê.'
              : 'Tạo thiết bị sẽ tự ghi một dòng nhập ban đầu vào nhật ký di chuyển, để tồn kho luôn suy ra được.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(su) => void gui(su)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-ma">Mã thiết bị *</Label>
              <Input
                id="f-ma"
                required
                disabled={dangSua}
                value={bieu.code}
                onChange={(su) => dat('code')(su.target.value)}
                placeholder="LTL-RB-0001"
                className="font-mono"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {dangSua
                  ? 'Mã không đổi được — mọi giao dịch đã tham chiếu theo mã này.'
                  : 'Chữ in hoa, số và các dấu . _ - Hệ thống tự chuyển thành chữ hoa.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-ten">Tên thiết bị *</Label>
              <Input
                id="f-ten"
                required
                minLength={2}
                value={bieu.name}
                onChange={(su) => dat('name')(su.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-loai">Loại tài sản *</Label>
              <Select
                id="f-loai"
                required
                value={bieu.categoryId}
                onChange={(su) => dat('categoryId')(su.target.value)}
              >
                {loaiTaiSan.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-dong">Dòng giải pháp</Label>
              <Select
                id="f-dong"
                value={bieu.productLineId}
                onChange={(su) => dat('productLineId')(su.target.value)}
              >
                <option value="">— Không thuộc dòng nào —</option>
                {dongGiaiPhap.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-serial">Serial nhà sản xuất</Label>
              <Input
                id="f-serial"
                value={bieu.serialNumber}
                onChange={(su) => dat('serialNumber')(su.target.value)}
              />
            </div>

            <OChonThemNhanh
              id="f-nguon"
              nhan="Nguồn gốc"
              required
              duongApi="/api/danh-muc/nguon-goc"
              giaTri={bieu.originId}
              onDoi={dat('originId')}
              duocThem={duocThemDanhMuc}
              goiY="VD: Phụ huynh tặng"
            />

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-nguon-ghi">Ghi chú nguồn gốc</Label>
              <Input
                id="f-nguon-ghi"
                value={bieu.originNote}
                onChange={(su) => dat('originNote')(su.target.value)}
                placeholder="VD: mượn của ADC để demo tuyển sinh"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-ngay">Ngày nhập</Label>
              <Input
                id="f-ngay"
                type="date"
                value={bieu.receivedDate}
                onChange={(su) => dat('receivedDate')(su.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-gia">Giá trị (VND)</Label>
              <Input
                id="f-gia"
                type="number"
                min={0}
                step={1000}
                value={bieu.value}
                onChange={(su) => dat('value')(su.target.value)}
              />
            </div>

            <OChonThemNhanh
              id="f-muc-dich"
              nhan="Mục đích sử dụng"
              required
              duongApi="/api/danh-muc/muc-dich"
              giaTri={bieu.purposeId}
              onDoi={dat('purposeId')}
              duocThem={duocThemDanhMuc}
              goiY="VD: Trưng bày hội chợ"
            />

            <div className="space-y-1.5">
              <Label htmlFor="f-han-tra">Hạn trả (nếu là hàng mượn)</Label>
              <Input
                id="f-han-tra"
                type="date"
                value={bieu.dueReturnAt}
                onChange={(su) => dat('dueReturnAt')(su.target.value)}
              />
            </div>

            {dangSua ? null : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="f-kieu">Kiểu quản lý *</Label>
                  <Select
                    id="f-kieu"
                    required
                    value={bieu.trackingType}
                    onChange={(su) => dat('trackingType')(su.target.value)}
                  >
                    {DS_KIEU_QUAN_LY.map((k) => (
                      <option key={k.ma} value={k.ma}>
                        {k.nhan}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {theoDonVi
                      ? 'Mỗi cái một mã (robot, laptop…). Không đổi được sau khi tạo.'
                      : 'Một mã dùng cho nhiều cái (ấn phẩm, phụ kiện…).'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="f-tinh-trang">Tình trạng lúc nhập *</Label>
                  <Select
                    id="f-tinh-trang"
                    required
                    value={bieu.condition}
                    onChange={(su) => dat('condition')(su.target.value)}
                  >
                    {DS_TINH_TRANG.map((t) => (
                      <option key={t.ma} value={t.ma}>
                        {t.nhan}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="f-diem">Nhập về điểm *</Label>
                  <Select
                    id="f-diem"
                    required
                    value={bieu.nhapVeLocationId}
                    onChange={(su) => dat('nhapVeLocationId')(su.target.value)}
                  >
                    {diaDiem.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="f-sl">Số lượng nhập *</Label>
                  <Input
                    id="f-sl"
                    type="number"
                    min={1}
                    required
                    readOnly={theoDonVi}
                    value={bieu.soLuongNhap}
                    onChange={(su) => dat('soLuongNhap')(su.target.value)}
                  />
                  {theoDonVi ? (
                    <p className="text-xs text-muted-foreground">
                      Quản lý theo đơn vị nên luôn bằng 1.
                    </p>
                  ) : null}
                </div>
              </>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-ghi-chu">Ghi chú chi tiết theo bộ</Label>
              <textarea
                id="f-ghi-chu"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                value={bieu.note}
                onChange={(su) => dat('note')(su.target.value)}
                placeholder="VD: Bộ gồm 1 thân robot, 6 cảm biến, 1 tay gắp, 1 sạc, 1 hộp đựng."
              />
            </div>

            {loi ? (
              <div className="sm:col-span-2">
                <Alert variant="destructive">{loi}</Alert>
              </div>
            ) : null}

            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={dangGui}>
                {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                {dangSua ? 'Lưu thay đổi' : 'Tạo thiết bị'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to={dangSua && id ? `/thiet-bi/${id}` : '/thiet-bi'}>Huỷ</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
