import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DauHieuAssetOpsDay } from '@/components/DauHieuAssetOps';
import { NutDoiGiaoDien } from '@/components/NutDoiGiaoDien';
import { LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Trang đăng nhập. KHÔNG có liên kết "đăng ký" — mọi tài khoản do quản trị tạo.
 *
 * KHÔNG xin quyền định vị. Xác nhận bằng GPS đã bỏ hẳn theo quyết định của
 * LtL, nên trang này không còn gọi navigator.geolocation, không còn ô mã vượt
 * quyền, và tài khoản kho đăng nhập hệt như mọi vai trò khác.
 */
export function DangNhap() {
  const { dangNhap } = useAuth();
  const dieuHuong = useNavigate();

  const [email, datEmail] = useState('');
  const [matKhau, datMatKhau] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);

  async function guiForm(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datDangGui(true);
    try {
      const nguoiDung = await dangNhap({ email, matKhau });
      // Tài khoản kho vào thẳng MÀN HÌNH KHO, không qua trang quản trị: đây là
      // máy đặt cố định tại kho, người dùng nó cả ngày chỉ cần màn hình đó.
      const dich = nguoiDung.mustChangePassword
        ? '/doi-mat-khau'
        : nguoiDung.role === 'KHO'
          ? '/kiosk'
          : '/';
      dieuHuong(dich, { replace: true });
    } catch (e) {
      if (e instanceof LoiApi && e.maLoi === 'THIEU_VI_TRI') {
        // Máy chủ trên VPS chưa cập nhật: nó vẫn còn chốt GPS cũ. Nói đúng
        // nguyên nhân thay vì bắt người dùng đi bật quyền định vị vô ích.
        datLoi(
          'Máy chủ còn bản cũ đang đòi vị trí. Cần chạy cập nhật trên VPS ' +
            '(bash trien-khai/cap-nhat-vps.sh) rồi đăng nhập lại.',
        );
      } else if (e instanceof LoiApi) {
        datLoi(e.message);
      } else {
        datLoi('Có lỗi không xác định khi đăng nhập.');
      }
    } finally {
      datDangGui(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DauHieuAssetOpsDay canh={52} className="shrink-0 rounded-xl" />
            <div>
              <p className="text-lg font-semibold leading-tight">
                Asset<span className="text-primary">Ops</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Learn to Leap · Vận hành thiết bị
              </p>
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
