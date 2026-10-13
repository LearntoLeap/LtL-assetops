import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, ClipboardList, RefreshCw, School, Search } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ngayGio } from '@/lib/dinh-dang';
import type { DiemOnsite } from '@/lib/kieu';

/**
 * CẬP NHẬT ONSITE — danh sách điểm trường.
 *
 * Mỗi trường một thẻ: đang có bao nhiêu bộ / hàng lẻ theo sổ, lần cập nhật gần
 * nhất là khi nào, ai ghi, có bao nhiêu thiết bị cần để mắt. Tài khoản trường
 * chỉ có trường mình nên vào thẳng trang của trường đó.
 */
export function OnsiteTheoTruong() {
  const { nguoiDung } = useAuth();
  const [muc, datMuc] = useState<DiemOnsite[]>([]);
  const [tuKhoa, datTuKhoa] = useState('');
  const [chiCanXem, datChiCanXem] = useState(false);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true; muc: DiemOnsite[] }>('/api/onsite/diem');
      datMuc(kq.muc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách điểm trường.');
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  if (nguoiDung?.role === 'TRUONG' && nguoiDung.locationId) {
    return <Navigate to={`/onsite/${nguoiDung.locationId}`} replace />;
  }

  const tu = tuKhoa.trim().toLowerCase();
  const hien = muc.filter(
    (d) =>
      (!tu || d.name.toLowerCase().includes(tu) || d.code.toLowerCase().includes(tu)) &&
      (!chiCanXem || (d.lanCuoi?.soVanDe ?? 0) > 0 || !d.lanCuoi),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Cập nhật onsite</h1>
          <p className="text-sm text-muted-foreground">
            Ghi lại tình trạng thiết bị tận mắt tại từng điểm trường. Chỉ ghi nhận, không làm đổi
            sổ kho — thấy hỏng, thiếu thì quản trị được báo để xử lý.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
          <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Tìm trường theo tên hoặc mã"
            value={tuKhoa}
            onChange={(su) => datTuKhoa(su.target.value)}
            aria-label="Tìm trường"
          />
        </div>
        <label className="flex min-h-cham cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[hsl(var(--chinh))]"
            checked={chiCanXem}
            onChange={(su) => datChiCanXem(su.target.checked)}
          />
          Chỉ trường cần để mắt / chưa cập nhật
        </label>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {!dangTai && hien.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có điểm trường nào khớp.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {hien.map((d) => (
          <Card key={d.id} className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-start gap-2 text-base">
                <School className="mt-0.5 size-4 shrink-0 text-primary-dam" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate">{d.name}</span>
                  <span className="block font-mono text-xs font-normal text-muted-foreground">
                    {d.code}
                  </span>
                </span>
              </CardTitle>
              <CardDescription>
                <span className="tabular-nums">
                  {d.bo} bộ · {d.le} hàng lẻ
                </span>{' '}
                đang ở trường theo sổ
                {!d.isActive ? (
                  <Badge variant="warning" className="ml-2">
                    Ngừng dùng
                  </Badge>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {d.lanCuoi ? (
                <p className="text-sm">
                  Cập nhật gần nhất <strong>{ngayGio(d.lanCuoi.visitedAt)}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {d.lanCuoi.nguoiGhi} · {d.soLanCapNhat} lần
                  </span>
                  {d.lanCuoi.soVanDe > 0 ? (
                    <Badge variant="destructive" className="mt-1 gap-1">
                      <AlertTriangle className="size-3" aria-hidden />
                      {d.lanCuoi.soVanDe} thiết bị cần để mắt
                    </Badge>
                  ) : (
                    <Badge variant="success" className="mt-1">
                      Lần gần nhất không có vấn đề
                    </Badge>
                  )}
                </p>
              ) : (
                <p className="text-sm text-warning-dam">Chưa có lần cập nhật onsite nào.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link to={`/onsite/${d.id}/moi`}>
                    <ClipboardList aria-hidden />
                    Cập nhật
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/onsite/${d.id}`}>Xem thiết bị &amp; lịch sử</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
