import { useCallback, useEffect, useState } from 'react';
import { Boxes, CheckCircle2, Database, Layers, MapPin, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import {
  DS_LOAI_YEU_CAU,
  DS_TINH_TRANG,
  DS_TRANG_THAI_PHAN_BO,
  DS_VAI_TRO,
} from '@ltl/taisan-shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NutDoiGiaoDien } from '@/components/NutDoiGiaoDien';
import { diaChiApi, goiApi, LoiApi } from '@/lib/api';

interface PhanHoiHealth {
  ok: boolean;
  ungDung: string;
  moiTruong: string;
  thoiDiem: string;
}

type TrangThaiKetNoi =
  | { loai: 'dang-kiem' }
  | { loai: 'duoc'; duLieu: PhanHoiHealth }
  | { loai: 'loi'; thongDiep: string };

function TheKetNoi() {
  const [trangThai, datTrangThai] = useState<TrangThaiKetNoi>({ loai: 'dang-kiem' });

  const kiemTra = useCallback(async () => {
    datTrangThai({ loai: 'dang-kiem' });
    try {
      const duLieu = await goiApi<PhanHoiHealth>('/api/health');
      datTrangThai({ loai: 'duoc', duLieu });
    } catch (loi) {
      datTrangThai({
        loai: 'loi',
        thongDiep: loi instanceof LoiApi ? loi.message : 'Lỗi không xác định khi gọi API.',
      });
    }
  }, []);

  useEffect(() => {
    void kiemTra();
  }, [kiemTra]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Database className="text-primary" aria-hidden />
            Kết nối API
          </CardTitle>
          <CardDescription className="break-all">{diaChiApi}</CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={() => void kiemTra()} aria-label="Kiểm tra lại">
          <RefreshCw className={trangThai.loai === 'dang-kiem' ? 'animate-spin' : ''} aria-hidden />
        </Button>
      </CardHeader>
      <CardContent>
        {trangThai.loai === 'dang-kiem' && (
          <p className="text-sm text-muted-foreground">Đang kiểm tra…</p>
        )}
        {trangThai.loai === 'duoc' && (
          <div className="space-y-2">
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden />
              API phản hồi bình thường
            </Badge>
            <dl className="grid gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Ứng dụng:</dt>
                <dd>{trangThai.duLieu.ungDung}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Môi trường:</dt>
                <dd>{trangThai.duLieu.moiTruong}</dd>
              </div>
            </dl>
          </div>
        )}
        {trangThai.loai === 'loi' && (
          <div className="space-y-2">
            <Badge variant="destructive" className="gap-1">
              <XCircle className="size-3.5" aria-hidden />
              Chưa gọi được API
            </Badge>
            <p className="text-sm text-muted-foreground">{trangThai.thongDiep}</p>
            <p className="text-sm text-muted-foreground">
              Kiểm tra: API đã chạy chưa (<code>npm run dev:api</code>), và{' '}
              <code>VITE_API_URL</code> trong <code>web/.env</code> đã trỏ đúng chưa.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TheDanhMuc({
  tieuDe,
  moTa,
  icon,
  muc,
}: {
  tieuDe: string;
  moTa: string;
  icon: React.ReactNode;
  muc: ReadonlyArray<{ ma: string; nhan: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {tieuDe}
        </CardTitle>
        <CardDescription>{moTa}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {muc.map((m) => (
          <Badge key={m.ma} variant="muted" title={m.ma}>
            {m.nhan}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}

export default function App() {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <div className="container flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <span className="nen-xanh-chuyen grid size-11 place-items-center rounded-lg text-primary-foreground">
              <Boxes aria-hidden />
            </span>
            <div>
              <p className="text-lg font-semibold leading-tight">Quản lý Tài sản &amp; Kho thiết bị</p>
              <p className="text-sm text-muted-foreground">Công ty CP Công nghệ Giáo dục Learn to Leap</p>
            </div>
          </div>
          <NutDoiGiaoDien />
        </div>
      </header>

      <main className="container space-y-6 py-8">
        <section className="animate-hien-len space-y-2">
          <Badge variant="accent">Giai đoạn 1 — Khởi tạo</Badge>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Nền móng đã dựng: <span className="chu-xanh-chuyen">CSDL, danh mục, tài khoản mẫu</span>
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Trang này là bộ khung để kiểm chứng giai đoạn 1: web build được, gọi được API, và dùng
            đúng bộ nhãn tiếng Việt dùng chung với server. Các màn hình nghiệp vụ sẽ được bổ sung
            từ giai đoạn 2 trở đi.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <TheKetNoi />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="text-primary" aria-hidden />
                Nguyên tắc đã cài vào lược đồ
              </CardTitle>
              <CardDescription>Những điều CSDL tự bảo đảm, không phụ thuộc giao diện</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  Mã thiết bị là duy nhất; mọi giao dịch tham chiếu theo mã, không nhập tên tự do.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  Không có cột &ldquo;số tồn&rdquo;: tồn kho luôn suy ra từ bảng nhật ký di chuyển.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  Nhật ký thao tác là bảng chỉ ghi thêm, không có API sửa/xoá.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  Hỗ trợ cả thiết bị theo từng đơn vị và vật tư theo số lượng.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TheDanhMuc
            tieuDe="Vai trò"
            moTa="Kiểm tra quyền đặt ở middleware phía server"
            icon={<ShieldCheck className="text-primary" aria-hidden />}
            muc={DS_VAI_TRO}
          />
          <TheDanhMuc
            tieuDe="Tình trạng thiết bị"
            moTa="Ghi nhận mỗi lần xuất/nhập kho"
            icon={<Layers className="text-primary" aria-hidden />}
            muc={DS_TINH_TRANG}
          />
          <TheDanhMuc
            tieuDe="Trạng thái phân bổ"
            moTa="Thiết bị đang ở đâu trong vòng luân chuyển"
            icon={<MapPin className="text-primary" aria-hidden />}
            muc={DS_TRANG_THAI_PHAN_BO}
          />
          <TheDanhMuc
            tieuDe="Loại yêu cầu"
            moTa="Mọi thiết bị ra khỏi kho đều phải qua yêu cầu được duyệt"
            icon={<Boxes className="text-primary" aria-hidden />}
            muc={DS_LOAI_YEU_CAU}
          />
        </div>
      </main>

      <footer className="border-t py-6">
        <p className="container text-sm text-muted-foreground">
          Learn to Leap — Hệ thống quản lý tài sản nội bộ. Tài khoản do quản trị viên tạo; không có
          đăng ký công khai.
        </p>
      </footer>
    </div>
  );
}
