import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Loader2, ScanLine } from 'lucide-react';
import {
  DS_TINH_TRANG,
  NHAN_LOAI_YEU_CAU,
  NHAN_TINH_TRANG,
  type TinhTrang,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ChupAnh } from '@/components/ChupAnh';
import { NutQuetQR } from '@/components/QuetQR';
import { goiApi, LoiApi } from '@/lib/api';
import type { AnhDaTai } from '@/lib/anh';
import type { DiaDiem, DongYeuCau, TrangDuLieu, YeuCau } from '@/lib/kieu';

/**
 * Màn hình XUẤT / NHẬP KHO — nơi hai chốt chặn gặp nhau.
 *
 * Mỗi dòng thiết bị chỉ "xong" khi có ĐỦ HAI thứ:
 *   1. MÃ ĐÃ QUÉT khớp mã thiết bị trong yêu cầu (quét QR hoặc gõ tay);
 *   2. ÍT NHẤT MỘT ẢNH chụp thực tế thiết bị.
 * Nút hoàn tất chỉ bật khi mọi dòng đều xong — và dù có cố gọi thẳng API thì
 * máy chủ vẫn kiểm lại y hệt rồi từ chối.
 */
interface TrangThaiDong {
  maDaQuet: string;
  anh: AnhDaTai[];
  tinhTrang: TinhTrang;
  ghiChu: string;
}

export function ManHinhKho({ che_do }: { che_do: 'xuat' | 'nhap' }) {
  const { id } = useParams<{ id: string }>();
  const dieuHuong = useNavigate();
  const laXuat = che_do === 'xuat';

  const [yeuCau, datYeuCau] = useState<YeuCau | null>(null);
  const [dong, datDong] = useState<Record<string, TrangThaiDong>>({});
  const [diaDiem, datDiaDiem] = useState<DiaDiem[]>([]);
  const [veLocationId, datVeLocationId] = useState('');
  const [ghiChuChung, datGhiChuChung] = useState('');
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);

  useEffect(() => {
    async function tai(): Promise<void> {
      if (!id) return;
      try {
        const kq = await goiApi<{ ok: true; yeuCau: YeuCau }>(`/api/yeu-cau/${id}`);
        datYeuCau(kq.yeuCau);
        datDong(
          Object.fromEntries(
            kq.yeuCau.items.map((m) => [
              m.asset.id,
              { maDaQuet: '', anh: [], tinhTrang: m.asset.condition, ghiChu: '' },
            ]),
          ),
        );
        if (!laXuat) {
          const ds = await goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true');
          datDiaDiem(ds.muc);
          datVeLocationId(ds.muc.find((d) => d.type === 'KHO_VAN_PHONG')?.id ?? '');
        }
      } catch (e) {
        datLoi(e instanceof LoiApi ? e.message : 'Không tải được yêu cầu.');
      }
    }
    void tai();
  }, [id, laXuat]);

  const dat = useCallback((assetId: string, thay: Partial<TrangThaiDong>) => {
    datDong((cu) => {
      const truoc = cu[assetId];
      if (!truoc) return cu;
      return { ...cu, [assetId]: { ...truoc, ...thay } };
    });
  }, []);

  /** Một dòng xong khi mã khớp VÀ có ảnh. */
  const dongXong = useCallback(
    (m: DongYeuCau): boolean => {
      const t = dong[m.asset.id];
      if (!t) return false;
      return t.maDaQuet.trim().toUpperCase() === m.asset.code && t.anh.length > 0;
    },
    [dong],
  );

  const soXong = useMemo(
    () => (yeuCau ? yeuCau.items.filter(dongXong).length : 0),
    [yeuCau, dongXong],
  );
  const tatCaXong = Boolean(yeuCau) && soXong === (yeuCau?.items.length ?? 0);

  async function hoanTat(): Promise<void> {
    if (!yeuCau) return;
    datLoi(null);
    datDangGui(true);
    try {
      const muc = yeuCau.items.map((m) => {
        const t = dong[m.asset.id];
        return {
          assetId: m.asset.id,
          maDaQuet: (t?.maDaQuet ?? '').trim().toUpperCase(),
          anhIds: (t?.anh ?? []).map((a) => a.id),
          quantity: m.quantity,
          ...(t?.ghiChu ? { ghiChu: t.ghiChu } : {}),
          ...(laXuat ? {} : { tinhTrang: t?.tinhTrang ?? m.asset.condition }),
        };
      });
      await goiApi(`/api/yeu-cau/${yeuCau.id}/${laXuat ? 'xuat-kho' : 'nhap-kho'}`, {
        method: 'POST',
        than: {
          muc,
          ...(laXuat ? {} : { veLocationId }),
          ...(ghiChuChung ? { ghiChu: ghiChuChung } : {}),
        },
      });
      dieuHuong(`/yeu-cau/${yeuCau.id}`, { replace: true });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Hoàn tất thất bại.');
    } finally {
      datDangGui(false);
    }
  }

  if (loi && !yeuCau) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/yeu-cau">
            <ArrowLeft aria-hidden />
            Về danh sách yêu cầu
          </Link>
        </Button>
        <Alert variant="destructive">{loi}</Alert>
      </div>
    );
  }
  if (!yeuCau) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  if (yeuCau.status !== 'DA_DUYET') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to={`/yeu-cau/${yeuCau.id}`}>
            <ArrowLeft aria-hidden />
            Về chi tiết yêu cầu
          </Link>
        </Button>
        <Alert variant="warning" tieuDe="Yêu cầu chưa ở trạng thái Đã duyệt">
          Không thứ gì rời kho khi yêu cầu chưa được duyệt. Yêu cầu này đang ở trạng thái khác nên
          màn hình kho không mở được.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to={`/yeu-cau/${yeuCau.id}`}>
            <ArrowLeft aria-hidden />
            Về chi tiết yêu cầu
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">
          {laXuat ? 'Xuất kho' : 'Nhập kho'} — <span className="font-mono">{yeuCau.code}</span>
        </h1>
        <p className="text-muted-foreground">
          {NHAN_LOAI_YEU_CAU[yeuCau.type]} · {yeuCau.toLocation?.name ?? yeuCau.destinationNote ?? 'Không có nơi đến'}
        </p>
      </div>

      <Alert variant="info" tieuDe="Mỗi thiết bị cần đủ hai bước">
        <span className="inline-flex items-center gap-1">
          <ScanLine className="size-4" aria-hidden /> Quét (hoặc gõ) mã trên nhãn
        </span>{' '}
        và{' '}
        <span className="inline-flex items-center gap-1">
          <Camera className="size-4" aria-hidden /> chụp ảnh thực tế thiết bị
        </span>
        . Ảnh nên thấy rõ nhãn mã — đó là bằng chứng của lần {laXuat ? 'xuất' : 'nhập'} này.
      </Alert>

      {!laXuat ? (
        <Card>
          <CardHeader>
            <CardTitle>Nhận hàng về kho</CardTitle>
          </CardHeader>
          <CardContent className="max-w-sm space-y-1.5">
            <Label htmlFor="k-ve-kho">Kho nhận *</Label>
            <Select
              id="k-ve-kho"
              required
              value={veLocationId}
              onChange={(su) => datVeLocationId(su.target.value)}
            >
              <option value="">— Chọn kho —</option>
              {diaDiem
                .filter((d) => d.type === 'KHO_VAN_PHONG' || d.type === 'KHO_SU_KIEN')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </CardContent>
        </Card>
      ) : null}

      <ul className="space-y-4">
        {yeuCau.items.map((m) => {
          const t = dong[m.asset.id];
          const xong = dongXong(m);
          const maLech =
            (t?.maDaQuet ?? '').trim() !== '' &&
            (t?.maDaQuet ?? '').trim().toUpperCase() !== m.asset.code;

          return (
            <li key={m.id}>
              <Card className={xong ? 'border-success/50' : undefined}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-mono">{m.asset.code}</CardTitle>
                    <CardDescription>
                      {m.asset.name} · SL {m.quantity} ·{' '}
                      {m.asset.currentLocation?.name ?? 'chưa rõ vị trí'}
                    </CardDescription>
                  </div>
                  {xong ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      Đã đủ
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      Chưa đủ
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`ma-${m.id}`}>Bước 1 — Mã trên nhãn *</Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        id={`ma-${m.id}`}
                        className="min-w-44 flex-1 font-mono"
                        placeholder="Quét QR hoặc gõ mã"
                        spellCheck={false}
                        value={t?.maDaQuet ?? ''}
                        onChange={(su) => dat(m.asset.id, { maDaQuet: su.target.value })}
                        aria-label={`Mã đã quét cho ${m.asset.code}`}
                      />
                      <NutQuetQR
                        nhan="Quét QR"
                        onQuetDuoc={(ma) => dat(m.asset.id, { maDaQuet: ma })}
                      />
                    </div>
                    {maLech ? (
                      <p className="text-sm text-destructive-dam">
                        Mã quét được không khớp. Yêu cầu này là <strong>{m.asset.code}</strong> —
                        kiểm tra lại xem có cầm nhầm thiết bị không.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Bước 2 — Ảnh chụp thực tế *</Label>
                    <ChupAnh
                      kind={laXuat ? 'ANH_XUAT' : 'ANH_NHAN'}
                      assetId={m.asset.id}
                      anh={t?.anh ?? []}
                      onDoiAnh={(anh) => dat(m.asset.id, { anh })}
                      moTa="Chụp sao cho thấy rõ thiết bị và nhãn mã dán trên đó."
                    />
                  </div>

                  {!laXuat ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`tt-${m.id}`}>Tình trạng khi nhận *</Label>
                        <Select
                          id={`tt-${m.id}`}
                          value={t?.tinhTrang ?? m.asset.condition}
                          onChange={(su) =>
                            dat(m.asset.id, { tinhTrang: su.target.value as TinhTrang })
                          }
                        >
                          {DS_TINH_TRANG.map((x) => (
                            <option key={x.ma} value={x.ma}>
                              {x.nhan}
                            </option>
                          ))}
                        </Select>
                        {t && t.tinhTrang !== m.asset.condition ? (
                          <p className="text-sm text-warning-dam">
                            Khác lúc xuất ({NHAN_TINH_TRANG[m.asset.condition]}) — hệ thống sẽ tự
                            sinh cảnh báo cho quản trị.
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`gc-${m.id}`}>Ghi chú</Label>
                        <Input
                          id={`gc-${m.id}`}
                          value={t?.ghiChu ?? ''}
                          onChange={(su) => dat(m.asset.id, { ghiChu: su.target.value })}
                          placeholder="VD: servo kêu lạ"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor={`gc-${m.id}`}>Ghi chú</Label>
                      <Input
                        id={`gc-${m.id}`}
                        value={t?.ghiChu ?? ''}
                        onChange={(su) => dat(m.asset.id, { ghiChu: su.target.value })}
                        placeholder="VD: bàn giao tận tay, kèm 1 sạc"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="k-ghi-chu">Ghi chú chung cho lần {laXuat ? 'xuất' : 'nhập'} này</Label>
            <Input
              id="k-ghi-chu"
              value={ghiChuChung}
              onChange={(su) => datGhiChuChung(su.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="cham"
              disabled={!tatCaXong || dangGui || (!laXuat && !veLocationId)}
              onClick={() => void hoanTat()}
            >
              {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
              {tatCaXong
                ? `Hoàn tất ${laXuat ? 'xuất' : 'nhập'} kho`
                : `Còn ${yeuCau.items.length - soXong} thiết bị chưa đủ mã/ảnh`}
            </Button>
            <span className="text-sm text-muted-foreground">
              {soXong}/{yeuCau.items.length} thiết bị đã đủ mã và ảnh
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
