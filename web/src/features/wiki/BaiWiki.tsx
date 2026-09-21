import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FileText,
  History,
  Info,
  Package,
  Pencil,
  ShieldAlert,
  Trash2,
  Wrench,
} from 'lucide-react';
import {
  NHAN_LOAI_TAI_LIEU_WIKI,
  NHAN_MUC_DO_LUU_Y,
  NHAN_TRANG_THAI_WIKI,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AnhBaoMat } from '@/components/AnhBaoMat';
import { VanBanMarkdown } from '@/components/VanBanMarkdown';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ngayGio } from '@/lib/dinh-dang';
import { coTep, moTaiLieu, nhanDinhDang } from '@/lib/tai-lieu';
import type { ChiTietBaiWiki, MucWiki, TaiLieuWiki } from '@/lib/kieu';

const VAI_TRO_BIEN_TAP = ['ADMIN', 'VAN_HANH', 'KHO'];

const KIEU_LUU_Y = {
  NGUY_HIEM: { vien: 'border-destructive/40 bg-destructive/10', chu: 'text-destructive-dam', Icon: ShieldAlert },
  CAN_THAN: { vien: 'border-warning/40 bg-warning/10', chu: 'text-warning-dam', Icon: AlertTriangle },
  THONG_TIN: { vien: 'border-border bg-secondary/50', chu: 'text-muted-foreground', Icon: Info },
} as const;

/** Lưu ý: nguy hiểm trước, rồi cẩn thận, rồi cần biết. */
const HANG_MUC_DO = { NGUY_HIEM: 0, CAN_THAN: 1, THONG_TIN: 2 } as const;

function KhoiLuuY({ muc }: { muc: MucWiki[] }) {
  if (muc.length === 0) return null;
  const sapXep = [...muc].sort(
    (a, b) =>
      (HANG_MUC_DO[a.mucDo ?? 'THONG_TIN'] ?? 9) - (HANG_MUC_DO[b.mucDo ?? 'THONG_TIN'] ?? 9),
  );
  return (
    <div className="space-y-2">
      {sapXep.map((m) => {
        const kieu = KIEU_LUU_Y[m.mucDo ?? 'THONG_TIN'];
        return (
          <div key={m.id} className={`flex gap-2.5 rounded-lg border p-3 ${kieu.vien}`}>
            <kieu.Icon className={`mt-0.5 size-4 flex-none ${kieu.chu}`} aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                {/* Màu KHÔNG phải kênh duy nhất: luôn có chữ và biểu tượng đi kèm. */}
                <span className={`mr-1.5 text-xs uppercase tracking-wide ${kieu.chu}`}>
                  {NHAN_MUC_DO_LUU_Y[m.mucDo ?? 'THONG_TIN']}
                </span>
                {m.tieuDe}
              </p>
              {m.noiDung ? <VanBanMarkdown noiDung={m.noiDung} /> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HangTaiLieu({
  doc,
  duocSua,
  khiXoa,
}: {
  doc: TaiLieuWiki;
  duocSua: boolean;
  khiXoa: (id: string) => void;
}) {
  const [dangMo, datDangMo] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  async function mo(): Promise<void> {
    datDangMo(true);
    datLoi(null);
    try {
      await moTaiLieu(doc);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không mở được tài liệu.');
    } finally {
      datDangMo(false);
    }
  }

  return (
    <li className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
      <FileText className="mt-0.5 size-4 flex-none text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {doc.tieuDe}
          <Badge variant="muted">{NHAN_LOAI_TAI_LIEU_WIKI[doc.loai]}</Badge>
        </p>
        {doc.moTa ? <p className="text-sm text-muted-foreground">{doc.moTa}</p> : null}
        <p className="text-xs text-muted-foreground">
          {nhanDinhDang(doc)}
          {doc.byteSize ? ` · ${coTep(doc.byteSize)}` : ''}
          {doc.uploadedBy ? ` · ${doc.uploadedBy.fullName}` : ''} · {ngayGio(doc.createdAt)}
        </p>
        {loi ? <p className="text-xs text-destructive-dam">{loi}</p> : null}
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => void mo()} disabled={dangMo}>
          {doc.lienKetNgoai ? <ExternalLink aria-hidden /> : null}
          {doc.lienKetNgoai ? 'Mở link' : nhanDinhDang(doc) === 'PDF' ? 'Xem' : 'Tải về'}
        </Button>
        {duocSua ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive-dam hover:bg-destructive/10"
            onClick={() => khiXoa(doc.id)}
            aria-label={`Xoá tài liệu ${doc.tieuDe}`}
            title="Xoá tài liệu"
          >
            <Trash2 aria-hidden />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * TRANG BÀI WIKI.
 *
 * Thứ tự khối là cố ý: LƯU Ý NGUY HIỂM nằm trên cùng, trước cả mô tả. Người mở
 * trang này thường đang đứng trước cái máy có vấn đề — thứ làm cháy thiết bị
 * phải đập vào mắt trước, không nằm cuối trang.
 */
export function BaiWiki() {
  const { slug } = useParams<{ slug: string }>();
  const dieuHuong = useNavigate();
  const { nguoiDung } = useAuth();
  const duocSua = nguoiDung ? VAI_TRO_BIEN_TAP.includes(nguoiDung.role) : false;

  const [dl, datDl] = useState<ChiTietBaiWiki | null>(null);
  const [loi, datLoi] = useState<string | null>(null);

  const tai = useCallback(async () => {
    try {
      datDl(await goiApi<ChiTietBaiWiki>(`/api/wiki/bai/${encodeURIComponent(slug ?? '')}`));
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được bài viết.');
    }
  }, [slug]);

  useEffect(() => {
    void tai();
  }, [tai]);

  async function xoaBai(): Promise<void> {
    if (!dl) return;
    if (!window.confirm(`Xoá hẳn bài "${dl.bai.tieuDe}" và mọi tài liệu đính kèm?`)) return;
    try {
      await goiApi(`/api/wiki/bai/${dl.bai.id}`, { method: 'DELETE' });
      dieuHuong('/wiki', { replace: true });
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá thất bại.');
    }
  }

  async function xoaTaiLieu(id: string): Promise<void> {
    if (!window.confirm('Xoá tài liệu này?')) return;
    try {
      await goiApi(`/api/wiki/tai-lieu/${id}`, { method: 'DELETE' });
      await tai();
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Xoá tài liệu thất bại.');
    }
  }

  if (loi && !dl) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/wiki">
            <ArrowLeft aria-hidden />
            Về thư viện
          </Link>
        </Button>
        <Alert variant="destructive">{loi}</Alert>
      </div>
    );
  }
  if (!dl) return <p className="text-sm text-muted-foreground">Đang tải…</p>;

  const b = dl.bai;
  const luuY = b.items.filter((m) => m.loai === 'LUU_Y');
  const thanhPhan = b.items.filter((m) => m.loai === 'THANH_PHAN');
  const loiHay = b.items.filter((m) => m.loai === 'LOI_THUONG_GAP');
  const thongSo = b.items.filter((m) => m.loai === 'THONG_SO');
  const maRieng = b.links.flatMap((l) => (l.asset ? [l.asset] : []));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link to="/wiki">
            <ArrowLeft aria-hidden />
            Về thư viện
          </Link>
        </Button>
        {duocSua ? (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/wiki/${b.slug}/sua`}>
                <Pencil aria-hidden />
                Sửa bài
              </Link>
            </Button>
            <Button
              variant="outline"
              className="text-destructive-dam"
              onClick={() => void xoaBai()}
            >
              <Trash2 aria-hidden />
              Xoá
            </Button>
          </div>
        ) : null}
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <Card className="min-w-0 overflow-hidden">
            {b.coverPhotoId ? (
              <AnhBaoMat id={b.coverPhotoId} alt="" className="h-48 w-full object-cover" />
            ) : null}
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold sm:text-2xl">{b.tieuDe}</h1>
                {b.status === 'BAN_NHAP' ? (
                  <Badge variant="warning">{NHAN_TRANG_THAI_WIKI.BAN_NHAP}</Badge>
                ) : null}
              </div>
              {b.tomTat ? <p className="text-muted-foreground">{b.tomTat}</p> : null}

              {/* Lưu ý lên ĐẦU trang, trước cả mô tả — xem chú thích ở đầu file. */}
              <KhoiLuuY muc={luuY} />
            </CardContent>
          </Card>

          {b.moTa ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Mô tả</CardTitle>
              </CardHeader>
              <CardContent>
                <VanBanMarkdown noiDung={b.moTa} />
              </CardContent>
            </Card>
          ) : null}

          {thanhPhan.length > 0 ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-4" aria-hidden />
                  Thành phần thiết bị
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thành phần</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                      <TableHead>Mã trong kho</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {thanhPhan.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <span className="block">{m.tieuDe}</span>
                          {m.noiDung ? (
                            <span className="text-xs text-muted-foreground">{m.noiDung}</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.soLuong ?? '—'}
                          {m.donVi ? ` ${m.donVi}` : ''}
                        </TableCell>
                        <TableCell>
                          {m.asset ? (
                            <Link
                              to={`/thiet-bi/${m.asset.id}`}
                              className="font-mono text-xs text-primary-dam hover:underline"
                            >
                              {m.asset.code}
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">chưa gắn mã</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {b.huongDan ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Hướng dẫn sử dụng</CardTitle>
              </CardHeader>
              <CardContent>
                <VanBanMarkdown noiDung={b.huongDan} />
              </CardContent>
            </Card>
          ) : null}

          {loiHay.length > 0 ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="size-4" aria-hidden />
                  Lỗi thường gặp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {loiHay.map((m) => (
                    <div key={m.id} className="rounded-lg border p-3">
                      <dt className="font-medium">{m.tieuDe}</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{m.noiDung}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {thongSo.length > 0 ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Thông số kỹ thuật</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {thongSo.map((m) => (
                    <div key={m.id} className="flex justify-between gap-3 border-b py-1.5 text-sm">
                      <dt className="text-muted-foreground">{m.tieuDe}</dt>
                      <dd className="text-right font-medium">{m.noiDung}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" aria-hidden />
                Tài liệu ({b.docs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {b.docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có tài liệu nào. File của hãng (Word, PDF…) đính kèm ở đây; file quá lớn
                  thì để trên Drive rồi dán liên kết.
                </p>
              ) : (
                <ul className="space-y-2">
                  {b.docs.map((d) => (
                    <HangTaiLieu
                      key={d.id}
                      doc={d}
                      duocSua={duocSua}
                      khiXoa={(id) => void xoaTaiLieu(id)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">Áp dụng cho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {b.links.length === 0 ? (
                <p className="text-muted-foreground">
                  Bài chung — hiện ở mọi thiết bị.
                </p>
              ) : (
                <>
                  <p className="text-2xl font-semibold">
                    {dl.soMa}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      mã thiết bị
                    </span>
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {b.links.map((l) => (
                      <li key={l.id}>
                        <Badge variant="muted">
                          {l.productLine?.name ?? l.category?.name ?? l.asset?.code ?? '—'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  {maRieng.length > 0 ? (
                    <ul className="space-y-1 border-t pt-2">
                      {maRieng.slice(0, 8).map((a) => (
                        <li key={a.id}>
                          <Link
                            to={`/thiet-bi/${a.id}`}
                            className="font-mono text-xs text-primary-dam hover:underline"
                          >
                            {a.code}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground">{a.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardContent className="space-y-2 pt-5 text-xs text-muted-foreground">
              <p>
                Sửa lần cuối {ngayGio(b.updatedAt)}
                {b.updatedBy ? ` · ${b.updatedBy.fullName}` : ''}
              </p>
              {b._count.revisions > 0 ? (
                <p className="flex items-center gap-1.5">
                  <History className="size-3.5" aria-hidden />
                  {b._count.revisions} phiên bản trước đã lưu
                </p>
              ) : null}
              <p className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" aria-hidden />
                Tạo {ngayGio(b.createdAt)}
                {b.createdBy ? ` · ${b.createdBy.fullName}` : ''}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
