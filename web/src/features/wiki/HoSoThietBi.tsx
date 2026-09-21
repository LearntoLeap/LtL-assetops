import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, ShieldAlert } from 'lucide-react';
import { NHAN_MUC_DO_LUU_Y } from '@ltl/taisan-shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { goiApi } from '@/lib/api';
import type { BaiWikiTomTat, WikiTheoThietBi } from '@/lib/kieu';

const NHOM: Array<{ khoa: 'rieng' | 'theoDong' | 'theoLoai' | 'chung'; nhan: string }> = [
  { khoa: 'rieng', nhan: 'Riêng máy này' },
  { khoa: 'theoDong', nhan: 'Cả dòng' },
  { khoa: 'theoLoai', nhan: 'Cả loại' },
  { khoa: 'chung', nhan: 'Áp dụng chung' },
];

/**
 * Khối "Hồ sơ thiết bị" trên trang chi tiết một mã.
 *
 * Đây là điểm chạm quan trọng nhất của thư viện: không ai nhớ vào /wiki, nhưng
 * ai cũng mở trang thiết bị. Cảnh báo NGUY HIỂM hiện ngay ở đây, không bắt
 * người dùng bấm thêm một lần nữa mới thấy.
 *
 * Không tải được (chưa có bài, mạng lỗi) thì khối này biến mất chứ không báo
 * lỗi — thiếu wiki không phải là sự cố của trang thiết bị.
 */
export function HoSoThietBi({ assetId }: { assetId: string }) {
  const [dl, datDl] = useState<WikiTheoThietBi | null>(null);

  useEffect(() => {
    let conHieuLuc = true;
    goiApi<WikiTheoThietBi>(`/api/wiki/theo-thiet-bi/${assetId}`)
      .then((kq) => {
        if (conHieuLuc) datDl(kq);
      })
      .catch(() => undefined);
    return () => {
      conHieuLuc = false;
    };
  }, [assetId]);

  if (!dl) return null;
  const tongBai =
    dl.rieng.length + dl.theoDong.length + dl.theoLoai.length + dl.chung.length;
  if (tongBai === 0 && dl.canhBao.length === 0) return null;

  const hang = (b: BaiWikiTomTat) => (
    <li key={b.id}>
      <Link
        to={`/wiki/${b.slug}`}
        className="text-sm text-primary-dam hover:underline"
      >
        {b.tieuDe}
      </Link>
      {b.tomTat ? (
        <span className="ml-2 text-xs text-muted-foreground">{b.tomTat}</span>
      ) : null}
    </li>
  );

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden />
          Hồ sơ thiết bị
        </CardTitle>
        <CardDescription>
          Mô tả, thành phần và lưu ý dùng chung cho mọi mã cùng kiểu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {dl.canhBao.map((c) => {
          const nguy = c.mucDo === 'NGUY_HIEM';
          const Icon = nguy ? ShieldAlert : AlertTriangle;
          return (
            <Link
              key={c.id}
              to={`/wiki/${c.article.slug}`}
              className={`flex gap-2.5 rounded-lg border p-3 transition-colors ${
                nguy
                  ? 'border-destructive/40 bg-destructive/10 hover:bg-destructive/15'
                  : 'border-warning/40 bg-warning/10 hover:bg-warning/15'
              }`}
            >
              <Icon
                className={`mt-0.5 size-4 flex-none ${nguy ? 'text-destructive-dam' : 'text-warning-dam'}`}
                aria-hidden
              />
              <p className="text-sm">
                <span
                  className={`mr-1.5 text-xs uppercase tracking-wide ${nguy ? 'text-destructive-dam' : 'text-warning-dam'}`}
                >
                  {NHAN_MUC_DO_LUU_Y[c.mucDo]}
                </span>
                {c.tieuDe}
              </p>
            </Link>
          );
        })}

        {NHOM.map(({ khoa, nhan }) => {
          const ds = dl[khoa];
          if (ds.length === 0) return null;
          return (
            <div key={khoa}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{nhan}</p>
              <ul className="mt-1 space-y-1">{ds.map(hang)}</ul>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
