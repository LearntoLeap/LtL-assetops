import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { docAnh } from '@/lib/anh';

/**
 * Hiển thị ảnh nằm sau lớp xác thực: tải blob kèm token rồi mới gắn vào <img>.
 * Dùng thay cho <img src="/api/anh/..."> ở mọi nơi.
 */
export function AnhBaoMat({
  id,
  alt,
  className,
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  const [url, datUrl] = useState<string | null>(null);
  const [loi, datLoi] = useState(false);

  useEffect(() => {
    let conHieuLuc = true;
    datLoi(false);
    datUrl(null);
    docAnh(id)
      .then((u) => {
        if (conHieuLuc) datUrl(u);
      })
      .catch(() => {
        if (conHieuLuc) datLoi(true);
      });
    return () => {
      conHieuLuc = false;
    };
  }, [id]);

  if (loi) {
    return (
      <span
        className={cn('grid place-items-center rounded-md border bg-muted text-muted-foreground', className)}
        title="Không xem được ảnh này"
      >
        <ImageOff className="size-5" aria-hidden />
      </span>
    );
  }
  if (!url) {
    return <span className={cn('block animate-pulse rounded-md bg-muted', className)} aria-hidden />;
  }
  return <img src={url} alt={alt} className={className} />;
}
