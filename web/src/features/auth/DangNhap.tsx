import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, KeyRound, Loader2, MapPin } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NutDoiGiaoDien } from '@/components/NutDoiGiaoDien';
import { LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { layViTri, LoiViTri, type ViTri } from '@/lib/vi-tri';

/**
 * Trang đăng nhập. KHÔNG có liên kết "đăng ký" — mọi tài khoản do quản trị tạo.
 *
 * Với tài khoản kho, server trả 422 THIEU_VI_TRI khi chưa có toạ độ. Lúc đó
 * trang mới xin quyền định vị và gửi lại: nhờ vậy các vai trò khác không bị hỏi
 * vị trí vô ích, và web không phải tự đoán tài khoản nào là tài khoản kho.
 */
export function DangNhap() {
  const { dangNhap } = useAuth();
  const dieuHuong = useNavigate();

  const [email, datEmail] = useState('');
  const [matKhau, datMatKhau] = useState('');
  const [maVuotQuyen, datMaVuotQuyen] = useState('');
  const [canViTri, datCanViTri] = useState(false);
  const [canMaVuotQuyen, datCanMaVuotQuyen] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);
  const [trangThaiViTri, datTrangThaiViTri] = useState<string | null>(null);

  async function thu(viTri?: ViTri): Promise<void> {
    const nguoiDung = await dangNhap({
      email,
      matKhau,
      ...(viTri ? { viTri } : {}),
      ...(maVuotQuyen.trim() ? { maVuotQuyen: maVuotQuyen.trim() } : {}),
    });
    dieuHuong(nguoiDung.mustChangePassword ? '/doi-mat-khau' : '/', { replace: true });
  }

  async function guiForm(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datCanMaVuotQuyen('');
    datDangGui(true);
    try {
      if (canViTri) {
        datTrangThaiViTri('Đang lấy vị trí…');
        const viTri = await layViTri();
        datTrangThaiViTri(
          `Đã lấy vị trí (độ chính xác ±${viTri.doChinhXacM ?? '?'}m). Đang gửi cho máy chủ kiểm tra…`,
        );
        await thu(viTri);
        return;
      }
      await thu();
    } catch (e) {
      if (e instanceof LoiApi && e.maLoi === 'THIEU_VI_TRI') {
        // Server xác định đây là tài khoản kho → bật chế độ gửi kèm vị trí.
        datCanViTri(true);
        datLoi(
          'Tài khoản kho phải gửi vị trí. Hãy bấm Đăng nhập lại và cho phép trình duyệt truy cập vị trí.',
        );
      } else if (e instanceof LoiViTri) {
        datLoi(e.message);
      } else if (e instanceof LoiApi) {
        datLoi(e.message);
        // Ngoài vùng kho: mở ô nhập mã vượt quyền do quản trị cấp.
        if (e.maHttp === 403 && canViTri) {
          datCanMaVuotQuyen(
            'Nếu GPS trong nhà bị lệch, xin quản trị viên cấp mã vượt quyền rồi nhập vào đây.',
          );
        }
      } else {
        datLoi('Có lỗi không xác định khi đăng nhập.');
      }
    } finally {
      datDangGui(false);
      datTrangThaiViTri(null);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="nen-xanh-chuyen grid size-11 place-items-center rounded-lg text-primary-foreground">
              <Boxes aria-hidden />
            </span>
            <div>
              <p className="font-semibold leading-tight">Quản lý Tài sản</p>
              <p className="text-sm text-muted-foreground">Learn to Leap</p>
            </div>
          </div>
          <NutDoiGiaoDien />
        </div>

        <Card className="animate-hien-len">
          <CardHeader>
            <CardTitle>Đăng nhập</CardTitle>
            <CardDescription>
              Tài khoản do quản trị viên cấp. Hệ thống không có đăng ký công khai.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(su) => void guiForm(su)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(su) => datEmail(su.target.value)}
                  placeholder="ten@learntoleap.vn"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mat-khau">Mật khẩu</Label>
                <Input
                  id="mat-khau"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={matKhau}
                  onChange={(su) => datMatKhau(su.target.value)}
                />
              </div>

              {canViTri ? (
                <Alert variant="info" tieuDe="Tài khoản kho — kiểm tra vị trí">
                  Máy chủ sẽ tính khoảng cách từ vị trí của bạn tới kho và tự quyết định.
                  {trangThaiViTri ? (
                    <p className="mt-1 flex items-center gap-1.5 text-foreground">
                      <MapPin className="size-3.5" aria-hidden />
                      {trangThaiViTri}
                    </p>
                  ) : null}
                </Alert>
              ) : null}

              {canMaVuotQuyen ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ma-vuot-quyen">Mã vượt quyền (dùng một lần)</Label>
                  <Input
                    id="ma-vuot-quyen"
                    value={maVuotQuyen}
                    onChange={(su) => datMaVuotQuyen(su.target.value)}
                    placeholder="VD: K7M2-Q9XR"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">{canMaVuotQuyen}</p>
                </div>
              ) : null}

              {loi ? <Alert variant="destructive">{loi}</Alert> : null}

              <Button type="submit" variant="accent" className="w-full" disabled={dangGui}>
                {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
                {dangGui ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Quên mật khẩu? Liên hệ quản trị viên để được đặt lại.
        </p>
      </div>
    </div>
  );
}
