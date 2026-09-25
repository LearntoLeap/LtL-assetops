import { useCallback, useEffect, useState } from 'react';
import { Building2, Loader2, Save } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { CaiDatChung as KieuCaiDat } from '@/lib/kieu';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const RONG: KieuCaiDat = {
  congTyTen: '',
  congTyDiaChi: '',
  congTyMaSoThue: '',
  congTyDienThoai: '',
  congTyEmail: '',
  congTyWebsite: '',
  daiDienTen: '',
  daiDienChucVu: '',
  canCu: '',
  soBan: 4,
};

/**
 * CÀI ĐẶT CHUNG — thông tin đơn vị in lên mọi biên bản bàn giao.
 *
 * Đặt ở một chỗ để không phải gõ lại tên công ty, địa chỉ, mã số thuế mỗi lần
 * lập biên bản (gõ lại là sớm muộn gõ sai, mà sai trên chứng từ đã ký thì phiền).
 * Chỉ ADMIN sửa; các vai trò khác vẫn xem được để biết biên bản sẽ in ra gì.
 */
export function CaiDatChung() {
  const { nguoiDung } = useAuth();
  const laAdmin = nguoiDung?.role === 'ADMIN';

  const [form, datForm] = useState<KieuCaiDat>(RONG);
  const [dangTai, datDangTai] = useState(true);
  const [dangLuu, datDangLuu] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [xong, datXong] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; caiDat: KieuCaiDat }>('/api/cai-dat');
      datForm(kq.caiDat);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được cài đặt.');
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  function doi<K extends keyof KieuCaiDat>(ten: K, giaTri: KieuCaiDat[K]): void {
    datForm((cu) => ({ ...cu, [ten]: giaTri }));
    datXong(null);
  }

  async function luu(su: React.FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    datXong(null);
    datDangLuu(true);
    try {
      const kq = await goiApi<{ ok: true; caiDat: KieuCaiDat }>('/api/cai-dat', {
        method: 'PUT',
        than: form,
      });
      datForm(kq.caiDat);
      datXong('Đã lưu. Các biên bản lập từ bây giờ sẽ dùng thông tin này.');
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Lưu cài đặt thất bại.');
    } finally {
      datDangLuu(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Cài đặt chung</h1>
        <p className="text-sm text-muted-foreground">
          Thông tin đơn vị in trên biên bản bàn giao. Điền một lần, mọi biên bản dùng chung.
        </p>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {xong ? <Alert variant="success">{xong}</Alert> : null}
      {!laAdmin ? (
        <Alert>
          Bạn đang xem ở chế độ chỉ đọc. Chỉ tài khoản quản trị mới sửa được thông tin này.
        </Alert>
      ) : null}

      {dangTai ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        <form onSubmit={(su) => void luu(su)} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-5" aria-hidden />
                Đơn vị bên giao
              </CardTitle>
              <CardDescription>
                In ở mục &quot;BÊN GIAO (BÊN A)&quot; của biên bản.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cd-ten">Tên đơn vị</Label>
                <Input
                  id="cd-ten"
                  required
                  minLength={2}
                  disabled={!laAdmin}
                  value={form.congTyTen}
                  onChange={(su) => doi('congTyTen', su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cd-dia-chi">Địa chỉ</Label>
                <Input
                  id="cd-dia-chi"
                  disabled={!laAdmin}
                  value={form.congTyDiaChi}
                  placeholder="Tầng 6, tòa nhà IPH, số 241 đường Xuân Thủy…"
                  onChange={(su) => doi('congTyDiaChi', su.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cd-mst">Mã số thuế</Label>
                  <Input
                    id="cd-mst"
                    disabled={!laAdmin}
                    value={form.congTyMaSoThue}
                    onChange={(su) => doi('congTyMaSoThue', su.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cd-dt">Điện thoại</Label>
                  <Input
                    id="cd-dt"
                    inputMode="tel"
                    disabled={!laAdmin}
                    value={form.congTyDienThoai}
                    onChange={(su) => doi('congTyDienThoai', su.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cd-email">Email (không bắt buộc)</Label>
                  <Input
                    id="cd-email"
                    type="email"
                    disabled={!laAdmin}
                    value={form.congTyEmail}
                    onChange={(su) => doi('congTyEmail', su.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cd-web">Website (không bắt buộc)</Label>
                  <Input
                    id="cd-web"
                    disabled={!laAdmin}
                    value={form.congTyWebsite}
                    onChange={(su) => doi('congTyWebsite', su.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Người đại diện ký biên bản</CardTitle>
              <CardDescription>
                Điền sẵn vào ô &quot;Đại diện&quot; và dòng ký tên; người lập vẫn sửa được từng biên bản.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cd-dd-ten">Họ tên</Label>
                <Input
                  id="cd-dd-ten"
                  disabled={!laAdmin}
                  value={form.daiDienTen}
                  placeholder="Lê Ngọc Giáp"
                  onChange={(su) => doi('daiDienTen', su.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cd-dd-cv">Chức vụ</Label>
                <Input
                  id="cd-dd-cv"
                  disabled={!laAdmin}
                  value={form.daiDienChucVu}
                  placeholder="Trưởng phòng Chuyên môn"
                  onChange={(su) => doi('daiDienChucVu', su.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nội dung mặc định của biên bản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cd-can-cu">Các dòng &quot;Căn cứ …&quot; — mỗi dòng một căn cứ</Label>
                <textarea
                  id="cd-can-cu"
                  rows={4}
                  className={O_VAN_BAN}
                  disabled={!laAdmin}
                  value={form.canCu}
                  placeholder={'Căn cứ hợp đồng đã ký giữa hai Bên;\nCăn cứ nhu cầu triển khai…'}
                  onChange={(su) => doi('canCu', su.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:max-w-[16rem]">
                <Label htmlFor="cd-so-ban">Số bản biên bản được lập</Label>
                <Input
                  id="cd-so-ban"
                  type="number"
                  min={1}
                  max={20}
                  disabled={!laAdmin}
                  value={form.soBan}
                  onChange={(su) => doi('soBan', Number(su.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Số chẵn thì mỗi bên giữ một nửa, in thành chữ ngay trên biên bản.
                </p>
              </div>
            </CardContent>
          </Card>

          {laAdmin ? (
            <Button type="submit" disabled={dangLuu}>
              {dangLuu ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
              Lưu cài đặt
            </Button>
          ) : null}
        </form>
      )}
    </div>
  );
}
