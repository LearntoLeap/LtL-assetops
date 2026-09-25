import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, FileSignature, Loader2, Plus, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import {
  DS_MAU_BBBG,
  DS_TRANG_THAI_BBBG,
  NHAN_LOAI_YEU_CAU,
  NHAN_MAU_BBBG,
  NHAN_TRANG_THAI_BBBG,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth, VAI_TRO_NHAP_LIEU } from '@/lib/auth';
import { ngay, ngayGio } from '@/lib/dinh-dang';
import { taiTep } from '@/lib/tep';
import type { BienBan, TrangDuLieu } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';
import { MAU_TRANG_THAI_BBBG } from './tien-ich';

const MOI_TRANG = 25;

export function BienBanList() {
  const { nguoiDung } = useAuth();
  const [muc, datMuc] = useState<BienBan[]>([]);
  const [tong, datTong] = useState(0);
  const [trang, datTrang] = useState(1);
  const [dangTai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);
  const [tuKhoa, datTuKhoa] = useState('');
  const [locTrangThai, datLocTrangThai] = useState('');
  const [locMau, datLocMau] = useState('');
  /** id biên bản đang tải file — để chỉ nút đó quay, không quay cả bảng. */
  const [dangTaiTep, datDangTaiTep] = useState<string | null>(null);

  const tai = useCallback(async () => {
    datDangTai(true);
    datLoi(null);
    try {
      const q = new URLSearchParams({ trang: String(trang), moiTrang: String(MOI_TRANG) });
      if (tuKhoa.trim()) q.set('tuKhoa', tuKhoa.trim());
      if (locTrangThai) q.set('status', locTrangThai);
      if (locMau) q.set('templateType', locMau);
      const kq = await goiApi<TrangDuLieu<BienBan>>(`/api/bbbg?${q.toString()}`);
      datMuc(kq.muc);
      datTong(kq.tong);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách biên bản.');
    } finally {
      datDangTai(false);
    }
  }, [trang, tuKhoa, locTrangThai, locMau]);

  /**
   * Tải file Word của một biên bản ngay từ danh sách.
   *
   * Endpoint đòi xác thực nên phải tải bằng fetch kèm token rồi mới lưu; dán
   * thẳng URL vào thẻ <a> sẽ ra 401.
   */
  async function taiWord(b: BienBan): Promise<void> {
    datLoi(null);
    datDangTaiTep(b.id);
    try {
      await taiTep(`/api/bbbg/${b.id}/tep`, b.fileName ?? `${b.code}.docx`);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được file biên bản.');
    } finally {
      datDangTaiTep(null);
    }
  }

  useEffect(() => {
    void tai();
  }, [tai]);

  const { dangNoi } = useRealtime([SU_KIEN.YEU_CAU_DOI], () => {
    void tai();
  });

  const soTrang = Math.max(1, Math.ceil(tong / MOI_TRANG));
  const duocLap = nguoiDung ? VAI_TRO_NHAP_LIEU.includes(nguoiDung.role) : false;
  const choToiXacNhan = muc.filter((b) => b.status === 'CHO_XAC_NHAN').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Biên bản bàn giao</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Thiết bị chỉ đổi vị trí sang trường sau khi bên nhận xác nhận biên bản.
            <span
              className={dangNoi ? 'text-success-dam' : 'text-muted-foreground'}
              title={dangNoi ? 'Đang đồng bộ realtime' : 'Mất kết nối realtime'}
            >
              {dangNoi ? (
                <Wifi className="size-3.5" aria-hidden />
              ) : (
                <WifiOff className="size-3.5" aria-hidden />
              )}
            </span>
          </p>
        </div>
        {duocLap ? (
          <Button asChild>
            <Link to="/bbbg/moi">
              <Plus aria-hidden />
              Lập biên bản
            </Link>
          </Button>
        ) : null}
      </div>

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {choToiXacNhan > 0 ? (
        <Alert variant="warning" tieuDe="Có biên bản đang chờ xác nhận">
          {choToiXacNhan} biên bản đang chờ bên nhận kiểm hàng và xác nhận. Chỉ khi xác nhận, thiết
          bị mới được ghi nhận là đã về đơn vị nhận.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({tong})</CardTitle>
          <CardDescription>
            Trang {trang}/{soTrang}
          </CardDescription>
          <div className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative lg:col-span-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                className="pl-9"
                placeholder="Tìm theo số biên bản, đơn vị nhận hoặc người nhận…"
                value={tuKhoa}
                onChange={(su) => {
                  datTuKhoa(su.target.value);
                  datTrang(1);
                }}
                aria-label="Tìm biên bản"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={locMau}
                onChange={(su) => {
                  datLocMau(su.target.value);
                  datTrang(1);
                }}
                aria-label="Lọc theo mẫu biên bản"
              >
                <option value="">Mọi mẫu biên bản</option>
                {DS_MAU_BBBG.map((m) => (
                  <option key={m.ma} value={m.ma}>
                    {m.nhan}
                  </option>
                ))}
              </Select>
              <Select
                value={locTrangThai}
                onChange={(su) => {
                  datLocTrangThai(su.target.value);
                  datTrang(1);
                }}
                aria-label="Lọc theo trạng thái biên bản"
              >
                <option value="">Mọi trạng thái</option>
                {DS_TRANG_THAI_BBBG.map((t) => (
                  <option key={t.ma} value={t.ma}>
                    {t.nhan}
                  </option>
                ))}
              </Select>
              <Button variant="outline" size="icon" onClick={() => void tai()} aria-label="Tải lại">
                <RefreshCw className={dangTai ? 'animate-spin' : ''} aria-hidden />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 sm:px-5">
          {dangTai && muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">Đang tải…</p>
          ) : muc.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground sm:px-0">
              Chưa có biên bản nào. Biên bản được lập từ một yêu cầu đã xuất kho.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Số biên bản</TableHead>
                    <TableHead>Yêu cầu</TableHead>
                    <TableHead>Đơn vị nhận</TableHead>
                    <TableHead>Người nhận</TableHead>
                    <TableHead className="text-right">Số dòng</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày lập</TableHead>
                    <TableHead className="text-right">File mềm</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {muc.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link
                          to={`/bbbg/${b.id}`}
                          className="flex items-center gap-1.5 font-mono text-sm font-medium text-primary-dam hover:underline"
                        >
                          <FileSignature className="size-3.5 shrink-0" aria-hidden />
                          {b.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.request ? (
                          <Link
                            to={`/yeu-cau/${b.request.id}`}
                            className="font-mono text-xs hover:underline"
                          >
                            {b.request.code}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <span className="block text-xs">
                          {b.request
                            ? NHAN_LOAI_YEU_CAU[b.request.type]
                            : NHAN_MAU_BBBG[b.templateType]}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.receiverLocation?.name ?? b.receiverOrg}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.receiverName}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.items.length}</TableCell>
                      <TableCell>
                        <Badge variant={MAU_TRANG_THAI_BBBG[b.status]}>
                          {NHAN_TRANG_THAI_BBBG[b.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {b.issuedDate ? ngay(b.issuedDate) : ngayGio(b.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={dangTaiTep === b.id}
                          onClick={() => void taiWord(b)}
                          aria-label={`Tải file Word của biên bản ${b.code}`}
                        >
                          {dangTaiTep === b.id ? (
                            <Loader2 className="animate-spin" aria-hidden />
                          ) : (
                            <FileDown aria-hidden />
                          )}
                          Word
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {soTrang > 1 ? (
                <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-0">
                  <Button
                    variant="outline"
                    disabled={trang <= 1}
                    onClick={() => datTrang((t) => t - 1)}
                  >
                    Trang trước
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Trang {trang} / {soTrang}
                  </span>
                  <Button
                    variant="outline"
                    disabled={trang >= soTrang}
                    onClick={() => datTrang((t) => t + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
