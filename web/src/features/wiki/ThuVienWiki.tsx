import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileText, Plus, Search, Tag } from 'lucide-react';
import { NHAN_TRANG_THAI_WIKI } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { AnhBaoMat } from '@/components/AnhBaoMat';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { BaiWikiTomTat, DanhMuc } from '@/lib/kieu';

interface TrangWiki {
  ok: true;
  muc: BaiWikiTomTat[];
  tong: number;
  trang: number;
  moiTrang: number;
}

/** Vai trò được thêm và sửa bài. Máy chủ kiểm lại; ẩn nút chỉ cho gọn mắt. */
const VAI_TRO_BIEN_TAP = ['ADMIN', 'VAN_HANH', 'KHO'];

/**
 * THƯ VIỆN WIKI — trang tra cứu thiết bị.
 *
 * Ô tìm kiếm đặt trên cùng và to: wiki dùng bằng cách TÌM, không phải bằng cách
 * duyệt hết danh sách. Tìm kiếm chạy trên bản không dấu ở máy chủ nên gõ "luu y
 * ugot" vẫn ra "Lưu ý UGOT".
 */
export function ThuVienWiki() {
  const { nguoiDung } = useAuth();
  const duocSua = nguoiDung ? VAI_TRO_BIEN_TAP.includes(nguoiDung.role) : false;

  const [muc, datMuc] = useState<BaiWikiTomTat[]>([]);
  const [tong, datTong] = useState(0);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  const [tuKhoa, datTuKhoa] = useState('');
  const [goTim, datGoTim] = useState('');
  const [locDong, datLocDong] = useState('');
  const [locLoai, datLocLoai] = useState('');

  const [dong, datDong] = useState<DanhMuc[]>([]);
  const [loai, datLoai] = useState<DanhMuc[]>([]);

  // Gõ tới đâu tìm tới đó, nhưng chờ một nhịp để không bắn request mỗi phím.
  useEffect(() => {
    const h = setTimeout(() => datTuKhoa(goTim), 300);
    return () => clearTimeout(h);
  }, [goTim]);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const q = new URLSearchParams({ moiTrang: '48' });
      if (tuKhoa) q.set('tuKhoa', tuKhoa);
      if (locDong) q.set('dongGiaiPhapId', locDong);
      if (locLoai) q.set('loaiTaiSanId', locLoai);
      const kq = await goiApi<TrangWiki>(`/api/wiki?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được thư viện.');
    } finally {
      datDangTai(false);
    }
  }, [tuKhoa, locDong, locLoai]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useEffect(() => {
    void Promise.all([
      goiApi<{ muc: DanhMuc[] }>('/api/danh-muc/dong-giai-phap').then((k) => datDong(k.muc)),
      goiApi<{ muc: DanhMuc[] }>('/api/danh-muc/loai-tai-san').then((k) => datLoai(k.muc)),
    ]).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <BookOpen className="size-6 text-primary-dam" aria-hidden />
            Thư viện thiết bị
          </h1>
          <p className="text-sm text-muted-foreground">
            Mô tả, thành phần và lưu ý sử dụng của từng kiểu thiết bị. Gõ không dấu cũng tìm được.
          </p>
        </div>
        {duocSua ? (
          <Button asChild>
            <Link to="/wiki/moi">
              <Plus aria-hidden />
              Viết bài mới
            </Link>
          </Button>
        ) : null}
      </div>

      {/* Một hàng điều khiển duy nhất, đặt trên toàn bộ nội dung. */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={goTim}
            onChange={(su) => datGoTim(su.target.value)}
            placeholder="Tìm thiết bị, lưu ý, linh kiện… (gõ có dấu hay không đều được)"
            aria-label="Tìm trong thư viện"
            className="pl-9"
          />
        </div>
        <Select
          value={locDong}
          onChange={(su) => datLocDong(su.target.value)}
          aria-label="Lọc theo dòng giải pháp"
        >
          <option value="">Mọi dòng giải pháp</option>
          {dong.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          value={locLoai}
          onChange={(su) => datLocLoai(su.target.value)}
          aria-label="Lọc theo loại thiết bị"
        >
          <option value="">Mọi loại thiết bị</option>
          {loai.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {dangTai && muc.length === 0 ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : muc.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <BookOpen className="mx-auto size-10 text-muted-foreground/40" aria-hidden />
            <p className="font-medium">
              {tuKhoa || locDong || locLoai
                ? 'Không có bài nào khớp điều kiện.'
                : 'Thư viện còn trống.'}
            </p>
            <p className="text-sm text-muted-foreground">
              {duocSua
                ? 'Bắt đầu bằng một bài cho dòng thiết bị hay hỏng nhất — viết một lần, mọi mã cùng kiểu dùng chung.'
                : 'Quản trị viên sẽ bổ sung nội dung.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{tong} bài</p>
          <div
            className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${dangTai ? 'opacity-60' : ''}`}
          >
            {muc.map((b) => (
              <Link
                key={b.id}
                to={`/wiki/${b.slug}`}
                className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40"
              >
                <div className="flex h-32 items-center justify-center overflow-hidden bg-secondary/60">
                  {b.coverPhotoId ? (
                    <AnhBaoMat
                      id={b.coverPhotoId}
                      alt=""
                      className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                    />
                  ) : (
                    <BookOpen className="size-10 text-muted-foreground/30" aria-hidden />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-snug">{b.tieuDe}</p>
                    {b.status === 'BAN_NHAP' ? (
                      <Badge variant="warning">{NHAN_TRANG_THAI_WIKI.BAN_NHAP}</Badge>
                    ) : null}
                  </div>
                  {b.tomTat ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{b.tomTat}</p>
                  ) : null}
                  <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Tag className="size-3" aria-hidden />
                      {b._count.links > 0 ? `${b._count.links} nhóm áp dụng` : 'Áp dụng chung'}
                    </span>
                    {b._count.docs > 0 ? (
                      <span className="flex items-center gap-1">
                        <FileText className="size-3" aria-hidden />
                        {b._count.docs} tài liệu
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
