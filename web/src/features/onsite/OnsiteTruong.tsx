import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, ClipboardList, Trash2 } from 'lucide-react';
import { NHAN_TINH_TRANG } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useXacNhan } from '@/components/ui/hop-xac-nhan';
import { AnhBaoMat } from '@/components/AnhBaoMat';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ngayGio } from '@/lib/dinh-dang';
import type { LanOnsite, LanOnsiteTomTat, ThietBiTaiTruong } from '@/lib/kieu';

const TINH_TRANG_XAU = new Set(['HONG', 'MAT', 'CAN_BAO_TRI']);

interface DuLieuTruong {
  diem: { id: string; code: string; name: string; address: string | null; isActive: boolean };
  thietBi: ThietBiTaiTruong[];
  cacLan: LanOnsiteTomTat[];
}

/** Chi tiết một lần cập nhật — tải khi mở ra. */
function ChiTietLan({ id }: { id: string }) {
  const [lan, datLan] = useState<LanOnsite | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  useEffect(() => {
    let conDung = true;
    void (async () => {
      try {
        const kq = await goiApi<{ ok: true; lan: LanOnsite }>(`/api/onsite/${id}`);
        if (conDung) datLan(kq.lan);
      } catch (e) {
        if (conDung) datLoi(e instanceof LoiApi ? e.message : 'Không tải được.');
      }
    })();
    return () => {
      conDung = false;
    };
  }, [id]);

  if (loi) return <p className="text-sm text-destructive-dam">{loi}</p>;
  if (!lan) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  return (
    <div className="space-y-3">
      {lan.summary ? <p className="whitespace-pre-wrap text-sm">{lan.summary}</p> : null}
      <ul className="space-y-1 text-sm">
        {lan.items.map((m) => {
          const lech = m.seenQuantity !== null && m.seenQuantity !== m.systemQuantity;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{m.asset.code}</span>
              <span className="text-muted-foreground">{m.asset.name}</span>
              <Badge variant={TINH_TRANG_XAU.has(m.condition) ? 'destructive' : 'muted'}>
                {NHAN_TINH_TRANG[m.condition]}
              </Badge>
              {m.seenQuantity !== null ? (
                <span className={lech ? 'text-warning-dam' : 'text-muted-foreground'}>
                  thấy {m.seenQuantity} / sổ {m.systemQuantity}
                </span>
              ) : null}
              {m.note ? <span className="text-muted-foreground">— {m.note}</span> : null}
            </li>
          );
        })}
      </ul>
      {lan.anhIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {lan.anhIds.map((a) => (
            <AnhBaoMat key={a} id={a} alt="Ảnh onsite" className="h-24 w-24 rounded object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * MỘT ĐIỂM TRƯỜNG: thiết bị đang ở đó (theo sổ, tách bộ / hàng lẻ) kèm tình
 * trạng ghi nhận gần nhất, và lịch sử các lần cập nhật onsite.
 */
export function OnsiteTruong() {
  const hoi = useXacNhan();
  const { locationId } = useParams<{ locationId: string }>();
  const viTri = useLocation();
  const { nguoiDung } = useAuth();
  const duocXoa = nguoiDung?.role === 'ADMIN' || nguoiDung?.role === 'VAN_HANH';
  const [duLieu, datDuLieu] = useState<DuLieuTruong | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const [moLan, datMoLan] = useState<string | null>(null);
  const thongBao = (viTri.state as { thongBao?: string } | null)?.thongBao ?? null;

  const tai = useCallback(async () => {
    if (!locationId) return;
    datLoi(null);
    try {
      const kq = await goiApi<{ ok: true } & DuLieuTruong>(`/api/onsite/diem/${locationId}`);
      datDuLieu(kq);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được điểm trường.');
    }
  }, [locationId]);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function xoaLan(l: LanOnsiteTomTat): Promise<void> {
    if (
      !(await hoi({
        tieuDe: `Xoá lần cập nhật ${l.code}?`,
        noiDung: 'Dùng khi ghi nhầm. Sổ kho không đổi vì cập nhật onsite chỉ là ghi nhận.',
        nutCo: 'Có, xoá',
      }))
    ) {
      return;
    }
    try {
      await goiApi(`/api/onsite/${l.id}`, { method: 'DELETE' });
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá thất bại.');
    }
  }

  if (loi && !duLieu) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/onsite">
            <ArrowLeft aria-hidden />
            Về danh sách trường
          </Link>
        </Button>
        <Alert variant="destructive">{loi}</Alert>
      </div>
    );
  }
  if (!duLieu) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const bo = duLieu.thietBi.filter((t) => t.trackingType === 'DON_VI');
  const le = duLieu.thietBi.filter((t) => t.trackingType === 'SO_LUONG');
  const tongBo = bo.reduce((s, t) => s + t.tonTaiTruong, 0);
  const tongLe = le.reduce((s, t) => s + t.tonTaiTruong, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {nguoiDung?.role !== 'TRUONG' ? (
            <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
              <Link to="/onsite">
                <ArrowLeft aria-hidden />
                Về danh sách trường
              </Link>
            </Button>
          ) : null}
          <h1 className="text-xl font-semibold sm:text-2xl">{duLieu.diem.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{duLieu.diem.code}</span>
            {duLieu.diem.address ? ` · ${duLieu.diem.address}` : ''} ·{' '}
            <span className="tabular-nums">
              {tongBo} bộ · {tongLe} hàng lẻ
            </span>{' '}
            theo sổ
          </p>
        </div>
        <Button asChild>
          <Link to={`/onsite/${duLieu.diem.id}/moi`}>
            <ClipboardList aria-hidden />
            Cập nhật onsite mới
          </Link>
        </Button>
      </div>

      {thongBao ? <Alert variant="success">{thongBao}</Alert> : null}
      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Thiết bị đang ở trường ({duLieu.thietBi.length} mã)</CardTitle>
          <CardDescription>
            Theo sổ kho (đã xác nhận bàn giao). Cột cuối là lần ghi nhận onsite gần nhất của từng
            thiết bị.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {duLieu.thietBi.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">
              Theo sổ, trường chưa có thiết bị nào.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã / Tên</TableHead>
                  <TableHead>Kiểu</TableHead>
                  <TableHead className="text-right">SL tại trường</TableHead>
                  <TableHead>Ghi nhận gần nhất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...bo, ...le].map((t) => {
                  const g = t.ghiNhanGanNhat;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link
                          to={`/thiet-bi/${t.id}`}
                          className="font-mono text-sm text-primary-dam hover:underline"
                        >
                          {t.code}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {t.name} · {t.category.name}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.trackingType === 'DON_VI' ? 'default' : 'accent'}>
                          {t.trackingType === 'DON_VI' ? 'Bộ (từng cái)' : 'Hàng lẻ'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.tonTaiTruong}</TableCell>
                      <TableCell>
                        {g ? (
                          <span className="text-sm">
                            <Badge variant={TINH_TRANG_XAU.has(g.condition) ? 'destructive' : 'muted'}>
                              {NHAN_TINH_TRANG[g.condition]}
                            </Badge>
                            {g.seenQuantity !== null ? (
                              <span
                                className={
                                  g.seenQuantity !== t.tonTaiTruong
                                    ? 'ml-2 text-warning-dam'
                                    : 'ml-2 text-muted-foreground'
                                }
                              >
                                thấy {g.seenQuantity}
                              </span>
                            ) : null}
                            <span className="block text-xs text-muted-foreground">
                              {ngayGio(g.visitedAt)} · {g.code}
                              {g.note ? ` · ${g.note}` : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Chưa ghi nhận</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử cập nhật ({duLieu.cacLan.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {duLieu.cacLan.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có lần cập nhật nào.</p>
          ) : (
            <ul className="space-y-2">
              {duLieu.cacLan.map((l) => (
                <li key={l.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => datMoLan(moLan === l.id ? null : l.id)}
                      aria-expanded={moLan === l.id}
                    >
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="font-mono">{l.code}</span>
                        {ngayGio(l.visitedAt)}
                        {l.soVanDe > 0 ? (
                          <Badge variant="destructive">{l.soVanDe} cần để mắt</Badge>
                        ) : (
                          <Badge variant="success">Ổn</Badge>
                        )}
                        {moLan === l.id ? (
                          <ChevronUp className="size-4" aria-hidden />
                        ) : (
                          <ChevronDown className="size-4" aria-hidden />
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {l.nguoiGhi.fullName} · {l.soThietBi} thiết bị · {l.soAnh} ảnh
                      </span>
                    </button>
                    {duocXoa ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive-dam"
                        onClick={() => void xoaLan(l)}
                        aria-label={`Xoá ${l.code}`}
                        title="Xoá lần cập nhật ghi nhầm"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                  {moLan === l.id ? (
                    <div className="mt-3 border-t pt-3">
                      <ChiTietLan id={l.id} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
