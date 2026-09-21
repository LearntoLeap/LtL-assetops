import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import {
  DS_LOAI_TAI_LIEU_WIKI,
  DS_MUC_DO_LUU_Y,
  NHAN_LOAI_MUC_WIKI,
  type LoaiMucWiki,
  type LoaiTaiLieuWiki,
  type MucDoLuuY,
  type TrangThaiWiki,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { goiApi, LoiApi } from '@/lib/api';
import { taiTaiLieuLen } from '@/lib/tai-lieu';
import type { ChiTietBaiWiki, DanhMuc, ThietBi } from '@/lib/kieu';

/** Một mục đang soạn — chưa có id vì lưu là ghi đè toàn bộ danh sách. */
interface MucSoan {
  loai: LoaiMucWiki;
  tieuDe: string;
  noiDung: string;
  soLuong: string;
  donVi: string;
  mucDo: MucDoLuuY | '';
  assetId: string;
  maHienThi: string;
}

interface DichSoan {
  loai: 'THIET_BI' | 'LOAI_TAI_SAN' | 'DONG_GIAI_PHAP';
  id: string;
  nhan: string;
}

const mucRong = (loai: LoaiMucWiki): MucSoan => ({
  loai,
  tieuDe: '',
  noiDung: '',
  soLuong: '',
  donVi: '',
  mucDo: loai === 'LUU_Y' ? 'CAN_THAN' : '',
  assetId: '',
  maHienThi: '',
});

const GOI_Y_O_NHAP: Record<LoaiMucWiki, { tieuDe: string; noiDung: string }> = {
  LUU_Y: { tieuDe: 'Điều cần lưu ý, vd "Không cắm nguồn 24V"', noiDung: 'Giải thích thêm (không bắt buộc)' },
  THANH_PHAN: { tieuDe: 'Tên thành phần, vd "Động cơ servo MG996R"', noiDung: 'Ghi chú (không bắt buộc)' },
  LOI_THUONG_GAP: { tieuDe: 'Triệu chứng, vd "Robot không nhận lệnh"', noiDung: 'Cách xử lý (bắt buộc)' },
  THONG_SO: { tieuDe: 'Tên thông số, vd "Điện áp"', noiDung: 'Giá trị, vd "12V DC"' },
};

/** Vùng soạn văn bản nhiều dòng — dự án chưa có component Textarea dùng chung. */
function OSoan({
  id,
  value,
  onChange,
  rows = 6,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(su) => onChange(su.target.value)}
      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    />
  );
}

/**
 * SOẠN BÀI WIKI.
 *
 * Chia sẵn từng mục thay vì một ô soạn thảo tự do: bài nào cũng đủ phần, không
 * ai quên mất "lưu ý". Bốn nhóm mục dùng chung một bộ ô nhập, chỉ khác vài ô
 * phụ — nên thêm loại mục mới sau này không phải dựng thêm màn hình.
 */
export function SuaBaiWiki() {
  const { slug } = useParams<{ slug?: string }>();
  const laTaoMoi = !slug;
  const dieuHuong = useNavigate();

  const [id, datId] = useState<string | null>(null);
  const [tieuDe, datTieuDe] = useState('');
  const [tomTat, datTomTat] = useState('');
  const [moTa, datMoTa] = useState('');
  const [huongDan, datHuongDan] = useState('');
  const [status, datStatus] = useState<TrangThaiWiki>('BAN_NHAP');
  const [lyDo, datLyDo] = useState('');
  const [muc, datMuc] = useState<MucSoan[]>([]);
  const [dich, datDich] = useState<DichSoan[]>([]);

  const [dong, datDong] = useState<DanhMuc[]>([]);
  const [loai, datLoai] = useState<DanhMuc[]>([]);
  const [timMa, datTimMa] = useState('');
  const [goiYMa, datGoiYMa] = useState<ThietBi[]>([]);

  const [dangLuu, datDangLuu] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [truongLoi, datTruongLoi] = useState<string[]>([]);

  // --- tài liệu (chỉ gắn được sau khi bài đã có id)
  const [tepChon, datTepChon] = useState<File | null>(null);
  const [tlTieuDe, datTlTieuDe] = useState('');
  const [tlMoTa, datTlMoTa] = useState('');
  const [tlLoai, datTlLoai] = useState<LoaiTaiLieuWiki>('HUONG_DAN_HANG');
  const [tlLink, datTlLink] = useState('');
  const [dangTaiTep, datDangTaiTep] = useState(false);
  const [soTaiLieu, datSoTaiLieu] = useState(0);

  const tai = useCallback(async () => {
    if (!slug) return;
    try {
      const kq = await goiApi<ChiTietBaiWiki>(`/api/wiki/bai/${encodeURIComponent(slug)}`);
      const b = kq.bai;
      datId(b.id);
      datTieuDe(b.tieuDe);
      datTomTat(b.tomTat ?? '');
      datMoTa(b.moTa ?? '');
      datHuongDan(b.huongDan ?? '');
      datStatus(b.status);
      datSoTaiLieu(b.docs.length);
      datMuc(
        b.items.map((m) => ({
          loai: m.loai,
          tieuDe: m.tieuDe,
          noiDung: m.noiDung ?? '',
          soLuong: m.soLuong === null ? '' : String(m.soLuong),
          donVi: m.donVi ?? '',
          mucDo: m.mucDo ?? '',
          assetId: m.assetId ?? '',
          maHienThi: m.asset?.code ?? '',
        })),
      );
      datDich(
        b.links.map((l) =>
          l.asset
            ? { loai: 'THIET_BI' as const, id: l.asset.id, nhan: l.asset.code }
            : l.category
              ? { loai: 'LOAI_TAI_SAN' as const, id: l.category.id, nhan: l.category.name }
              : { loai: 'DONG_GIAI_PHAP' as const, id: l.productLine?.id ?? '', nhan: l.productLine?.name ?? '' },
        ),
      );
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được bài viết.');
    }
  }, [slug]);

  useEffect(() => {
    void tai();
  }, [tai]);

  useEffect(() => {
    void Promise.all([
      goiApi<{ muc: DanhMuc[] }>('/api/danh-muc/dong-giai-phap').then((k) => datDong(k.muc)),
      goiApi<{ muc: DanhMuc[] }>('/api/danh-muc/loai-tai-san').then((k) => datLoai(k.muc)),
    ]).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (timMa.trim().length < 2) {
      datGoiYMa([]);
      return;
    }
    const h = setTimeout(() => {
      goiApi<{ muc: ThietBi[] }>(`/api/wiki/goi-y-ma?tuKhoa=${encodeURIComponent(timMa.trim())}`)
        .then((k) => datGoiYMa(k.muc))
        .catch(() => datGoiYMa([]));
    }, 300);
    return () => clearTimeout(h);
  }, [timMa]);

  function themDich(d: DichSoan): void {
    if (!d.id) return;
    datDich((cu) => (cu.some((x) => x.loai === d.loai && x.id === d.id) ? cu : [...cu, d]));
  }

  function doiMuc(i: number, thay: Partial<MucSoan>): void {
    datMuc((cu) => cu.map((m, j) => (j === i ? { ...m, ...thay } : m)));
  }

  async function luu(): Promise<void> {
    datDangLuu(true);
    datLoi(null);
    datTruongLoi([]);
    const than = {
      tieuDe: tieuDe.trim(),
      tomTat: tomTat.trim() || undefined,
      moTa: moTa.trim() || undefined,
      huongDan: huongDan.trim() || undefined,
      status,
      dich: dich.map((d) => ({ loai: d.loai, id: d.id })),
      muc: muc
        .filter((m) => m.tieuDe.trim())
        .map((m) => ({
          loai: m.loai,
          tieuDe: m.tieuDe.trim(),
          noiDung: m.noiDung.trim() || undefined,
          soLuong: m.loai === 'THANH_PHAN' && m.soLuong ? Number(m.soLuong) : undefined,
          donVi: m.loai === 'THANH_PHAN' && m.donVi.trim() ? m.donVi.trim() : undefined,
          mucDo: m.loai === 'LUU_Y' ? (m.mucDo || 'CAN_THAN') : undefined,
          assetId: m.loai === 'THANH_PHAN' && m.assetId ? m.assetId : undefined,
        })),
      ...(laTaoMoi ? {} : { lyDo: lyDo.trim() || undefined }),
    };
    try {
      const kq = laTaoMoi
        ? await goiApi<ChiTietBaiWiki>('/api/wiki', { method: 'POST', than })
        : await goiApi<ChiTietBaiWiki>(`/api/wiki/bai/${id}`, { method: 'PATCH', than });
      dieuHuong(`/wiki/${kq.bai.slug}`, { replace: true });
    } catch (e) {
      if (e instanceof LoiApi) {
        datLoi(e.message);
        // Máy chủ trả lỗi theo từng trường — hiện ra để biết sai ở dòng nào.
        const ct = e.chiTiet as { truong?: Array<{ duongDan: string; thongDiep: string }> } | undefined;
        datTruongLoi((ct?.truong ?? []).map((t) => `${t.duongDan}: ${t.thongDiep}`));
      } else datLoi('Lưu thất bại.');
    } finally {
      datDangLuu(false);
    }
  }

  async function themTaiLieu(): Promise<void> {
    if (!id) return;
    datDangTaiTep(true);
    datLoi(null);
    try {
      await taiTaiLieuLen(
        id,
        { loai: tlLoai, tieuDe: tlTieuDe.trim(), moTa: tlMoTa.trim() },
        tepChon,
        tlLink.trim() || undefined,
      );
      datSoTaiLieu((n) => n + 1);
      datTepChon(null);
      datTlTieuDe('');
      datTlMoTa('');
      datTlLink('');
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Tải tài liệu thất bại.');
    } finally {
      datDangTaiTep(false);
    }
  }

  const nhomMuc: LoaiMucWiki[] = ['LUU_Y', 'THANH_PHAN', 'LOI_THUONG_GAP', 'THONG_SO'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to={slug ? `/wiki/${slug}` : '/wiki'}>
            <ArrowLeft aria-hidden />
            {slug ? 'Về bài viết' : 'Về thư viện'}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Select
            value={status}
            onChange={(su) => datStatus(su.target.value as TrangThaiWiki)}
            aria-label="Trạng thái bài"
            className="w-36"
          >
            <option value="BAN_NHAP">Để nháp</option>
            <option value="DA_DANG">Đăng</option>
          </Select>
          <Button onClick={() => void luu()} disabled={dangLuu || tieuDe.trim().length < 3}>
            <Save aria-hidden />
            {dangLuu ? 'Đang lưu…' : 'Lưu bài'}
          </Button>
        </div>
      </div>

      {loi ? (
        <Alert variant="destructive">
          {loi}
          {truongLoi.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {truongLoi.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{laTaoMoi ? 'Bài viết mới' : 'Sửa bài viết'}</CardTitle>
          <CardDescription>
            Một bài mô tả một KIỂU thiết bị, dùng chung cho mọi mã cùng kiểu — viết một lần,
            không chép lại cho từng mã.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tieu-de">Tiêu đề</Label>
            <Input
              id="tieu-de"
              value={tieuDe}
              onChange={(su) => datTieuDe(su.target.value)}
              placeholder="vd: Robot UGOT Explorer Kit"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tom-tat">Tóm tắt</Label>
            <Input
              id="tom-tat"
              value={tomTat}
              onChange={(su) => datTomTat(su.target.value)}
              placeholder="Một hai câu, hiện ở thẻ thư viện và kết quả tìm kiếm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mo-ta">Mô tả</Label>
            <OSoan
              id="mo-ta"
              value={moTa}
              onChange={datMoTa}
              placeholder={'Thiết bị này là gì, dùng để làm gì.\n\nViết được ## tiêu đề, **đậm**, - gạch đầu dòng.'}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="huong-dan">Hướng dẫn sử dụng</Label>
            <OSoan
              id="huong-dan"
              value={huongDan}
              onChange={datHuongDan}
              placeholder={'1. Lắp pin\n2. Bật công tắc\n3. Kết nối app'}
            />
          </div>
          {!laTaoMoi ? (
            <div className="space-y-1.5">
              <Label htmlFor="ly-do">Sửa cái gì (ghi lại ở lịch sử phiên bản)</Label>
              <Input
                id="ly-do"
                value={lyDo}
                onChange={(su) => datLyDo(su.target.value)}
                placeholder="vd: Bổ sung cảnh báo điện áp"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Áp dụng cho</CardTitle>
          <CardDescription>
            Chọn cả dòng giải pháp hoặc cả loại thiết bị thì mọi mã thuộc nhóm đó đều thấy bài
            này. Không chọn gì thì đây là bài chung, hiện ở mọi thiết bị.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dich.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {dich.map((d) => (
                <li key={`${d.loai}:${d.id}`}>
                  <Badge variant="muted" className="gap-1 pr-1">
                    {d.nhan}
                    <button
                      type="button"
                      onClick={() =>
                        datDich((cu) => cu.filter((x) => !(x.loai === d.loai && x.id === d.id)))
                      }
                      aria-label={`Bỏ ${d.nhan}`}
                      className="rounded-full p-0.5 hover:bg-background/60"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa chọn — bài này sẽ là bài chung.</p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Select
              value=""
              onChange={(su) => {
                const d = dong.find((x) => x.id === su.target.value);
                if (d) themDich({ loai: 'DONG_GIAI_PHAP', id: d.id, nhan: d.name });
              }}
              aria-label="Thêm dòng giải pháp"
            >
              <option value="">+ Thêm dòng giải pháp…</option>
              {dong.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Select
              value=""
              onChange={(su) => {
                const l = loai.find((x) => x.id === su.target.value);
                if (l) themDich({ loai: 'LOAI_TAI_SAN', id: l.id, nhan: l.name });
              }}
              aria-label="Thêm loại thiết bị"
            >
              <option value="">+ Thêm loại thiết bị…</option>
              {loai.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tim-ma">Hoặc gắn từng mã thiết bị</Label>
            <Input
              id="tim-ma"
              value={timMa}
              onChange={(su) => datTimMa(su.target.value)}
              placeholder="Gõ mã hoặc tên thiết bị…"
            />
            {goiYMa.length > 0 ? (
              <ul className="max-h-40 overflow-y-auto rounded-md border">
                {goiYMa.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-secondary/60"
                      onClick={() => {
                        themDich({ loai: 'THIET_BI', id: t.id, nhan: t.code });
                        datTimMa('');
                      }}
                    >
                      <span className="font-mono text-xs">{t.code}</span>
                      <span className="truncate text-muted-foreground">{t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {nhomMuc.map((nhom) => {
        const chiSo = muc.flatMap((m, i) => (m.loai === nhom ? [i] : []));
        return (
          <Card key={nhom}>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>{NHAN_LOAI_MUC_WIKI[nhom]}</CardTitle>
                {nhom === 'LUU_Y' ? (
                  <CardDescription>
                    Lưu ý mức Nguy hiểm luôn hiện trên cùng trang bài viết và trên trang thiết bị.
                  </CardDescription>
                ) : nhom === 'THANH_PHAN' ? (
                  <CardDescription>
                    Gắn mã trong kho để sau này chọn linh kiện từ danh sách, khỏi gõ tay.
                  </CardDescription>
                ) : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => datMuc((cu) => [...cu, mucRong(nhom)])}
              >
                <Plus aria-hidden />
                Thêm
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {chiSo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có dòng nào.</p>
              ) : (
                chiSo.map((i) => {
                  const m = muc[i];
                  if (!m) return null;
                  return (
                    <div key={i} className="space-y-2 rounded-lg border p-3">
                      <div className="flex gap-2">
                        <Input
                          value={m.tieuDe}
                          onChange={(su) => doiMuc(i, { tieuDe: su.target.value })}
                          placeholder={GOI_Y_O_NHAP[nhom].tieuDe}
                          aria-label={`${NHAN_LOAI_MUC_WIKI[nhom]} dòng ${i + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-none text-destructive-dam hover:bg-destructive/10"
                          onClick={() => datMuc((cu) => cu.filter((_, j) => j !== i))}
                          aria-label="Bỏ dòng này"
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                      <Input
                        value={m.noiDung}
                        onChange={(su) => doiMuc(i, { noiDung: su.target.value })}
                        placeholder={GOI_Y_O_NHAP[nhom].noiDung}
                        aria-label="Nội dung"
                      />
                      {nhom === 'LUU_Y' ? (
                        <Select
                          value={m.mucDo || 'CAN_THAN'}
                          onChange={(su) => doiMuc(i, { mucDo: su.target.value as MucDoLuuY })}
                          aria-label="Mức độ"
                          className="sm:w-48"
                        >
                          {DS_MUC_DO_LUU_Y.map((o) => (
                            <option key={o.ma} value={o.ma}>
                              {o.nhan}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                      {nhom === 'THANH_PHAN' ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            value={m.soLuong}
                            inputMode="numeric"
                            onChange={(su) =>
                              doiMuc(i, { soLuong: su.target.value.replace(/\D/g, '') })
                            }
                            placeholder="Số lượng"
                            aria-label="Số lượng"
                          />
                          <Input
                            value={m.donVi}
                            onChange={(su) => doiMuc(i, { donVi: su.target.value })}
                            placeholder="Đơn vị, vd cái"
                            aria-label="Đơn vị"
                          />
                          <Input
                            value={m.maHienThi}
                            onChange={(su) => doiMuc(i, { maHienThi: su.target.value })}
                            onBlur={() => {
                              const ma = m.maHienThi.trim().toUpperCase();
                              if (!ma) {
                                doiMuc(i, { assetId: '' });
                                return;
                              }
                              void goiApi<{ muc: ThietBi[] }>(
                                `/api/wiki/goi-y-ma?tuKhoa=${encodeURIComponent(ma)}`,
                              )
                                .then((k) => {
                                  const khop = k.muc.find((t) => t.code.toUpperCase() === ma);
                                  doiMuc(i, {
                                    assetId: khop?.id ?? '',
                                    maHienThi: khop?.code ?? m.maHienThi,
                                  });
                                })
                                .catch(() => undefined);
                            }}
                            placeholder="Mã trong kho (nếu có)"
                            aria-label="Mã trong kho"
                            className="font-mono"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Tài liệu đính kèm ({soTaiLieu})</CardTitle>
          <CardDescription>
            {laTaoMoi
              ? 'Lưu bài trước đã, rồi mới đính kèm được tài liệu.'
              : 'File Word, PDF, bảng tính… tối đa 25MB. File lớn hơn thì để trên Drive rồi dán liên kết.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {laTaoMoi ? null : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={tlTieuDe}
                  onChange={(su) => datTlTieuDe(su.target.value)}
                  placeholder="Tên tài liệu"
                  aria-label="Tên tài liệu"
                />
                <Select
                  value={tlLoai}
                  onChange={(su) => datTlLoai(su.target.value as LoaiTaiLieuWiki)}
                  aria-label="Loại tài liệu"
                >
                  {DS_LOAI_TAI_LIEU_WIKI.map((o) => (
                    <option key={o.ma} value={o.ma}>
                      {o.nhan}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                value={tlMoTa}
                onChange={(su) => datTlMoTa(su.target.value)}
                placeholder="Nói về cái gì — để người sau biết có đáng mở file 40 trang không"
                aria-label="Mô tả tài liệu"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tep">Chọn file</Label>
                  <input
                    id="tep"
                    type="file"
                    onChange={(su) => datTepChon(su.target.files?.[0] ?? null)}
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="link">Hoặc dán liên kết ngoài</Label>
                  <Input
                    id="link"
                    value={tlLink}
                    onChange={(su) => datTlLink(su.target.value)}
                    placeholder="https://drive.google.com/…"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => void themTaiLieu()}
                disabled={dangTaiTep || !tlTieuDe.trim() || (!tepChon && !tlLink.trim())}
              >
                <Upload aria-hidden />
                {dangTaiTep ? 'Đang tải…' : 'Thêm tài liệu'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
