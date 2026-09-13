import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Wrench } from 'lucide-react';
import {
  DS_TINH_TRANG,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_YEU_CAU,
  type TinhTrang,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { AnhBaoMat } from '@/components/AnhBaoMat';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth, VAI_TRO_QUAN_LY } from '@/lib/auth';
import { ngayGio } from '@/lib/dinh-dang';
import type { PhieuBaoHong } from '@/lib/kieu';
import { MAU_TRANG_THAI } from '@/features/yeu-cau/tien-ich';

const O_VAN_BAN =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function Muc({ nhan, children }: { nhan: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export function BaoHongChiTiet() {
  const { id } = useParams<{ id: string }>();
  const { nguoiDung } = useAuth();

  const [phieu, datPhieu] = useState<PhieuBaoHong | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [thongBao, datThongBao] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);

  const [tinhTrangMoi, datTinhTrangMoi] = useState<TinhTrang>('CAN_BAO_TRI');
  const [ketLuan, datKetLuan] = useState('');
  const [dong, datDong] = useState(true);

  const tai = useCallback(async () => {
    if (!id) return;
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; phieu: PhieuBaoHong }>(`/api/bao-hong/${id}`);
      datPhieu(kq.phieu);
      const tb = kq.phieu.items[0]?.asset;
      if (tb) datTinhTrangMoi(tb.condition);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được phiếu báo hỏng.');
    }
  }, [id]);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function xuLy(): Promise<void> {
    datLoi(null);
    datThongBao(null);
    datDangChay(true);
    try {
      await goiApi(`/api/bao-hong/${id}/xu-ly`, {
        method: 'POST',
        than: { tinhTrangMoi, ketLuan: ketLuan.trim(), dong },
      });
      datThongBao(dong ? 'Đã xử lý và đóng phiếu.' : 'Đã ghi kết luận, phiếu vẫn để mở theo dõi.');
      datKetLuan('');
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xử lý phiếu thất bại.');
    } finally {
      datDangChay(false);
    }
  }

  if (loi && !phieu) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/bao-hong">
            <ArrowLeft aria-hidden />
            Về danh sách
          </Link>
        </Button>
        <Alert variant="destructive" tieuDe="Không mở được phiếu báo hỏng">
          {loi}
        </Alert>
      </div>
    );
  }
  if (!phieu) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const tb = phieu.items[0]?.asset;
  const laQuanLy = nguoiDung ? VAI_TRO_QUAN_LY.includes(nguoiDung.role) : false;
  const duocXuLy = laQuanLy && phieu.status !== 'DA_HOAN_TAT' && phieu.status !== 'TU_CHOI';

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to="/bao-hong">
            <ArrowLeft aria-hidden />
            Về danh sách
          </Link>
        </Button>
        <h1 className="font-mono text-xl font-semibold sm:text-2xl">{phieu.code}</h1>
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          Phiếu báo hỏng
          <Badge variant={MAU_TRANG_THAI[phieu.status]}>
            {NHAN_TRANG_THAI_YEU_CAU[phieu.status]}
          </Badge>
        </p>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}
      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin phiếu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Muc nhan="Thiết bị">
              {tb ? (
                <Link to={`/thiet-bi/${tb.id}`} className="font-mono text-primary-dam hover:underline">
                  {tb.code}
                </Link>
              ) : (
                '—'
              )}
              {tb ? (
                <span className="block text-xs font-normal text-muted-foreground">{tb.name}</span>
              ) : null}
            </Muc>
            <Muc nhan="Tình trạng hiện tại">
              {tb ? NHAN_TINH_TRANG[tb.condition] : '—'}
            </Muc>
            <Muc nhan="Nơi đặt">{tb?.currentLocation?.name ?? '—'}</Muc>
            <Muc nhan="Người báo">
              {phieu.createdBy.fullName}
              <span className="block text-xs font-normal text-muted-foreground">
                {ngayGio(phieu.createdAt)}
              </span>
            </Muc>
          </dl>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mô tả hỏng hóc</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{phieu.reason}</p>
          </div>

          {phieu.completedAt ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Muc nhan="Người xử lý">{phieu.approvedBy?.fullName ?? '—'}</Muc>
              <Muc nhan="Đóng lúc">{ngayGio(phieu.completedAt)}</Muc>
            </dl>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ảnh chỗ hỏng ({phieu.photos.length})</CardTitle>
          <CardDescription>Ảnh do người báo chụp lúc lập phiếu.</CardDescription>
        </CardHeader>
        <CardContent>
          {phieu.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có ảnh.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {phieu.photos.map((a) => (
                <li key={a.id}>
                  <AnhBaoMat
                    id={a.id}
                    alt={`Ảnh báo hỏng ${phieu.code}`}
                    className="size-40 rounded-md border object-cover"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{ngayGio(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {duocXuLy ? (
        <Card>
          <CardHeader>
            <CardTitle>Xử lý phiếu</CardTitle>
            <CardDescription>
              Kết luận tình trạng cuối cùng của thiết bị. Cập nhật này được ghi vào nhật ký thao tác
              và đóng cảnh báo tương ứng.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="bh-tt-moi">Tình trạng sau xử lý</Label>
              <Select
                id="bh-tt-moi"
                value={tinhTrangMoi}
                onChange={(su) => datTinhTrangMoi(su.target.value as TinhTrang)}
              >
                {DS_TINH_TRANG.map((t) => (
                  <option key={t.ma} value={t.ma}>
                    {t.nhan}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bh-ket-luan">Kết luận xử lý (ít nhất 5 ký tự)</Label>
              <textarea
                id="bh-ket-luan"
                rows={3}
                className={O_VAN_BAN}
                value={ketLuan}
                placeholder="Ví dụ: đã thay pin, thiết bị hoạt động bình thường."
                onChange={(su) => datKetLuan(su.target.value)}
              />
            </div>
            <label className="flex min-h-cham cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--chinh))]"
                checked={dong}
                onChange={(su) => datDong(su.target.checked)}
              />
              Đóng phiếu sau khi ghi kết luận
            </label>
            <Button
              size="cham"
              disabled={dangChay || ketLuan.trim().length < 5}
              onClick={() => void xuLy()}
            >
              {dangChay ? <Loader2 className="animate-spin" aria-hidden /> : <Wrench aria-hidden />}
              Ghi kết luận
            </Button>
          </CardContent>
        </Card>
      ) : phieu.status === 'DA_HOAN_TAT' ? (
        <Alert variant="success" tieuDe="Phiếu đã đóng">
          <Check className="inline size-4" aria-hidden />{' '}
          {phieu.approvedBy?.fullName ?? 'Quản trị'} đã xử lý xong lúc {ngayGio(phieu.completedAt)}.
          Kết luận xử lý được lưu trong nhật ký thao tác và trong cảnh báo tương ứng.
        </Alert>
      ) : phieu.status === 'TU_CHOI' && phieu.rejectionNote ? (
        <Alert variant="destructive" tieuDe="Phiếu bị từ chối">
          {phieu.rejectionNote}
        </Alert>
      ) : null}
    </div>
  );
}
