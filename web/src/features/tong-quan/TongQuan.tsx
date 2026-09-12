import { useEffect, useState } from 'react';
import { CheckCircle2, Database, Layers, MapPin, ShieldCheck, XCircle } from 'lucide-react';
import {
  DS_LOAI_YEU_CAU,
  DS_TINH_TRANG,
  DS_TRANG_THAI_PHAN_BO,
  NHAN_LOAI_DIEM_LUU_TRU,
  NHAN_VAI_TRO,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { diaChiApi, goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { DiaDiem, TrangDuLieu } from '@/lib/kieu';

/**
 * Trang tổng quan tạm của giai đoạn 2: xác nhận phiên đăng nhập hoạt động và
 * phạm vi dữ liệu theo vai trò đúng như mong đợi. Dashboard thật làm ở giai đoạn 6.
 */
export function TongQuan() {
  const { nguoiDung } = useAuth();
  const [diaDiem, datDiaDiem] = useState<DiaDiem[] | null>(null);
  const [loiDiaDiem, datLoiDiaDiem] = useState<string | null>(null);

  useEffect(() => {
    async function tai(): Promise<void> {
      try {
        const kq = await goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem');
        datDiaDiem(kq.muc);
      } catch (e) {
        datLoiDiaDiem(e instanceof LoiApi ? e.message : 'Không tải được danh sách điểm.');
      }
    }
    void tai();
  }, []);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <Badge variant="accent">Giai đoạn 2 — Đăng nhập &amp; phân quyền</Badge>
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Xin chào, <span className="chu-xanh-chuyen">{nguoiDung?.fullName}</span>
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Các màn hình nghiệp vụ (thiết bị, yêu cầu, xuất/nhập kho, kiểm kê, KIOSK) sẽ bổ sung
          từ giai đoạn 3. Trang này để kiểm chứng phiên đăng nhập và phạm vi dữ liệu.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="text-primary" aria-hidden />
              Phiên của bạn
            </CardTitle>
            <CardDescription>Máy chủ đọc lại quyền từ CSDL ở mỗi lượt gọi API.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="break-all font-medium">{nguoiDung?.email}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vai trò</dt>
                <dd className="font-medium">{nguoiDung ? NHAN_VAI_TRO[nguoiDung.role] : '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phòng ban / đơn vị</dt>
                <dd className="font-medium">{nguoiDung?.department ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Điểm phụ trách</dt>
                <dd className="font-medium">{nguoiDung?.tenDiaDiem ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Máy chủ API</dt>
                <dd className="break-all font-mono text-xs">{diaChiApi}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="text-primary" aria-hidden />
              Điểm lưu trữ bạn xem được
            </CardTitle>
            <CardDescription>
              Danh sách này do máy chủ lọc theo vai trò — không phải do giao diện ẩn bớt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loiDiaDiem ? (
              <Alert variant="destructive">{loiDiaDiem}</Alert>
            ) : diaDiem === null ? (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="text-primary" aria-hidden />
              Nguyên tắc bất biến
            </CardTitle>
            <CardDescription>Đã cài vào lược đồ và tầng service</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[
                'Mã thiết bị duy nhất; giao dịch tham chiếu theo mã.',
                'Không có cột số tồn — tồn suy ra từ nhật ký di chuyển.',
                'Nhật ký thao tác chỉ ghi thêm, không có API sửa/xoá.',
                'Mọi kiểm tra quyền nằm ở middleware và service phía server.',
                'Không có API tự đăng ký — tài khoản do quản trị tạo.',
              ].map((d) => (
                <li key={d} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {d}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="text-primary" aria-hidden />
              Tình trạng thiết bị
            </CardTitle>
            <CardDescription>Ghi nhận mỗi lần xuất/nhập kho</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {DS_TINH_TRANG.map((m) => (
              <Badge key={m.ma} variant="muted" title={m.ma}>
                {m.nhan}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="text-primary" aria-hidden />
              Loại yêu cầu &amp; trạng thái phân bổ
            </CardTitle>
            <CardDescription>Chưa mở màn hình nghiệp vụ (giai đoạn 4)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {DS_LOAI_YEU_CAU.map((m) => (
                <Badge key={m.ma} variant="default" title={m.ma}>
                  {m.nhan}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {DS_TRANG_THAI_PHAN_BO.map((m) => (
                <Badge key={m.ma} variant="accent" title={m.ma}>
                  {m.nhan}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
