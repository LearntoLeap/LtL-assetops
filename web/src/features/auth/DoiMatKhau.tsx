import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function DoiMatKhau() {
  const { nguoiDung, capNhatHoSo } = useAuth();
  const dieuHuong = useNavigate();
  const batBuoc = nguoiDung?.mustChangePassword === true;

  const [matKhauCu, datMatKhauCu] = useState('');
  const [matKhauMoi, datMatKhauMoi] = useState('');
  const [nhapLai, datNhapLai] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const [xong, datXong] = useState(false);
  const [dangGui, datDangGui] = useState(false);

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    if (matKhauMoi !== nhapLai) {
      datLoi('Hai lần nhập mật khẩu mới không giống nhau.');
      return;
    }
    datDangGui(true);
    try {
      await goiApi('/api/auth/doi-mat-khau', {
        method: 'POST',
        than: { matKhauCu, matKhauMoi },
      });
      capNhatHoSo({ mustChangePassword: false });
      datXong(true);
      setTimeout(() => dieuHuong('/', { replace: true }), 1200);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Có lỗi không xác định.');
    } finally {
      datDangGui(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary" aria-hidden />
            Đổi mật khẩu
          </CardTitle>
          <CardDescription>
            Mật khẩu tối thiểu 8 ký tự, phải có cả chữ và số. Đổi xong, mọi phiên đăng nhập
            khác của bạn sẽ bị thu hồi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batBuoc ? (
            <Alert variant="warning" className="mb-4" tieuDe="Bắt buộc đổi mật khẩu">
              Quản trị viên vừa cấp hoặc đặt lại mật khẩu cho bạn. Bạn phải đổi mật khẩu trước
              khi dùng các chức năng khác.
            </Alert>
          ) : null}

          {xong ? (
            <Alert variant="success" tieuDe="Đã đổi mật khẩu">
              Đang chuyển về trang chính…
            </Alert>
          ) : (
            <form onSubmit={(su) => void gui(su)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mk-cu">Mật khẩu hiện tại</Label>
                <Input
                  id="mk-cu"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={matKhauCu}
                  onChange={(su) => datMatKhauCu(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mk-moi">Mật khẩu mới</Label>
                <Input
                  id="mk-moi"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={matKhauMoi}
                  onChange={(su) => datMatKhauMoi(su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mk-lai">Nhập lại mật khẩu mới</Label>
                <Input
                  id="mk-lai"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={nhapLai}
                  onChange={(su) => datNhapLai(su.target.value)}
                />
              </div>
              {loi ? <Alert variant="destructive">{loi}</Alert> : null}
              <Button type="submit" disabled={dangGui} className="w-full">
                {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {dangGui ? 'Đang lưu…' : 'Đổi mật khẩu'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
