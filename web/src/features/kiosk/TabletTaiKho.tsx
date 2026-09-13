import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Search, Tablet } from 'lucide-react';
import {
  NHAN_LOAI_DI_CHUYEN,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_PHAN_BO,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { goiApi, LoiApi } from '@/lib/api';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import type { TabletTaiKho as Thiet } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';

const MAU_TINH_TRANG = {
  TOT: 'success',
  DANG_SU_DUNG: 'default',
  CAN_BAO_TRI: 'warning',
  HONG: 'destructive',
  DANG_BAO_HANH: 'accent',
  MAT: 'destructive',
} as const;

/**
 * MÀN HÌNH TABLET TẠI KHO — danh sách riêng cho nhóm thiết bị "Cố định tại kho".
 *
 * Dựng cho tablet: mỗi thẻ là một thiết bị, chữ to, vùng chạm rộng, không có bảng
 * cuộn ngang. Mỗi thẻ trả lời đúng ba câu người ở kho hay hỏi: máy nào, tình
 * trạng thế nào, ai đang giữ — kèm mấy lần mượn / trả gần nhất.
 */
export function TabletTaiKho() {
  const [muc, datMuc] = useState<Thiet[]>([]);
  const [tuKhoa, datTuKhoa] = useState('');
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    try {
      const kq = await goiApi<{ ok: true; muc: Thiet[] }>('/api/kiosk/tablet');
      datMuc(kq.muc);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách thiết bị cố định tại kho.');
    } finally {
      datDangTai(false);
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  useRealtime([SU_KIEN.KHO_DOI, SU_KIEN.YEU_CAU_DOI], () => {
    void tai();
  });

  const tim = tuKhoa.trim().toUpperCase();
  const hien = tim
    ? muc.filter(
        (t) =>
          t.code.toUpperCase().includes(tim) ||
          t.name.toUpperCase().includes(tim) ||
          (t.holder?.fullName ?? '').toUpperCase().includes(tim),
      )
    : muc;

  const dangGiu = muc.filter((t) => t.holder !== null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <Tablet className="text-primary" aria-hidden />
            Thiết bị cố định tại kho
          </h1>
          <p className="text-sm text-muted-foreground">
            Nhóm mục đích sử dụng “Cố định tại kho” — tablet và máy dùng ngay trong kho, không phân
            bổ về trường.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
          <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
        </Button>
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="min-h-cham pl-9 text-base"
            placeholder="Tìm theo mã, tên hoặc người đang giữ…"
            value={tuKhoa}
            onChange={(su) => datTuKhoa(su.target.value)}
            aria-label="Tìm thiết bị cố định tại kho"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {muc.length} thiết bị · {dangGiu} đang có người giữ
        </p>
      </div>

      {dangTai && muc.length === 0 ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : hien.length === 0 ? (
        <Alert variant="info">
          {muc.length === 0
            ? 'Chưa có thiết bị nào được đặt mục đích sử dụng “Cố định tại kho”.'
            : 'Không có thiết bị nào khớp từ khoá.'}
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hien.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/thiet-bi/${t.id}`}
                    className="font-mono text-lg text-primary-dam hover:underline"
                  >
                    {t.code}
                  </Link>
                  <Badge variant={MAU_TINH_TRANG[t.condition]}>
                    {NHAN_TINH_TRANG[t.condition]}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-base text-foreground">{t.name}</CardDescription>
                <CardDescription>
                  {t.category.name}
                  {t.serialNumber ? ` · S/N ${t.serialNumber}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Người đang giữ
                    </dt>
                    <dd className="font-medium">
                      {t.holder ? (
                        <>
                          {t.holder.fullName}
                          {t.holder.department ? (
                            <span className="block text-xs font-normal text-muted-foreground">
                              {t.holder.department}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Đang ở kho</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      Trạng thái
                    </dt>
                    <dd className="font-medium">
                      {NHAN_TRANG_THAI_PHAN_BO[t.allocationStatus]}
                      {t.dueReturnAt ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          Hẹn trả {ngay(t.dueReturnAt)}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                <div className="border-t pt-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Lịch sử mượn gần nhất
                  </p>
                  {t.movements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có lần mượn nào.</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {t.movements.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{NHAN_LOAI_DI_CHUYEN[m.type]}</span>
                          <span className="text-muted-foreground">{ngayGio(m.performedAt)}</span>
                          {m.request ? (
                            <Link
                              to={`/yeu-cau/${m.request.id}`}
                              className="font-mono text-xs text-primary-dam hover:underline"
                            >
                              {m.request.code}
                            </Link>
                          ) : null}
                          {m.request?.createdBy.fullName ? (
                            <span className="text-xs text-muted-foreground">
                              · {m.request.createdBy.fullName}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
