import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
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
import { LoiApi } from '@/lib/api';
import { guiTep, taiTep, type KetQuaXemTruoc } from '@/lib/tep';

type Loai = 'thiet-bi' | 'dia-diem';

const CAU_HINH: Record<Loai, { ten: string; moTa: string; cotXemTruoc: Array<{ khoa: string; nhan: string }> }> = {
  'thiet-bi': {
    ten: 'Thiết bị',
    moTa: 'Nhập nhiều thiết bị cùng lúc. Mỗi dòng là một mã thiết bị.',
    cotXemTruoc: [
      { khoa: 'code', nhan: 'Mã' },
      { khoa: 'name', nhan: 'Tên' },
      { khoa: 'categoryCode', nhan: 'Loại' },
      { khoa: 'nhapVeCode', nhan: 'Nhập về' },
      { khoa: 'soLuongNhap', nhan: 'SL' },
    ],
  },
  'dia-diem': {
    ten: 'Điểm lưu trữ',
    moTa: 'Nhập nhiều điểm trường, kho, đối tác cùng lúc.',
    cotXemTruoc: [
      { khoa: 'code', nhan: 'Mã' },
      { khoa: 'name', nhan: 'Tên' },
      { khoa: 'type', nhan: 'Loại' },
      { khoa: 'contactName', nhan: 'Người phụ trách' },
    ],
  },
};

interface PhanHoiGhi {
  ok: true;
  soDaGhi: number;
  thongDiep: string;
}

function KhoiNhap({ loai }: { loai: Loai }) {
  const cauHinh = CAU_HINH[loai];
  const oTep = useRef<HTMLInputElement>(null);

  const [tep, datTep] = useState<File | null>(null);
  const [xemTruoc, datXemTruoc] = useState<KetQuaXemTruoc | null>(null);
  const [dangChay, datDangChay] = useState<'khong' | 'xem' | 'ghi'>('khong');
  const [loi, datLoi] = useState<string | null>(null);
  const [xong, datXong] = useState<string | null>(null);

  const datLai = useCallback(() => {
    datTep(null);
    datXemTruoc(null);
    datLoi(null);
    datXong(null);
    if (oTep.current) oTep.current.value = '';
  }, []);

  async function chonTep(f: File | null): Promise<void> {
    datTep(f);
    datXemTruoc(null);
    datLoi(null);
    datXong(null);
    if (!f) return;

    datDangChay('xem');
    try {
      datXemTruoc(await guiTep<KetQuaXemTruoc>(`/api/nhap-xuat/xem-truoc/${loai}`, f));
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không đọc được file.');
    } finally {
      datDangChay('khong');
    }
  }

  async function ghi(): Promise<void> {
    if (!tep) return;
    datLoi(null);
    datDangChay('ghi');
    try {
      const kq = await guiTep<PhanHoiGhi>(`/api/nhap-xuat/ghi/${loai}`, tep);
      datXong(kq.thongDiep);
      datXemTruoc(null);
      datTep(null);
      if (oTep.current) oTep.current.value = '';
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Ghi dữ liệu thất bại.');
    } finally {
      datDangChay('khong');
    }
  }

  const sachSe = xemTruoc !== null && xemTruoc.soLoi === 0 && xemTruoc.soHopLe > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="text-primary-dam" aria-hidden />
          {cauHinh.ten}
        </CardTitle>
        <CardDescription>{cauHinh.moTa}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void taiTep(`/api/nhap-xuat/mau/${loai}`, `mau-${loai}.xlsx`).catch((e: unknown) =>
                datLoi(e instanceof LoiApi ? e.message : 'Tải file mẫu thất bại.'),
              )
            }
          >
            <Download aria-hidden />
            Tải file mẫu
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void taiTep(`/api/nhap-xuat/xuat/${loai}`, `${loai}.xlsx`).catch((e: unknown) =>
                datLoi(e instanceof LoiApi ? e.message : 'Xuất Excel thất bại.'),
              )
            }
          >
            <Download aria-hidden />
            Xuất dữ liệu hiện có
          </Button>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`tep-${loai}`}
            className="text-sm font-medium leading-none text-foreground"
          >
            Chọn file (.xlsx, .xls hoặc .csv)
          </label>
          <input
            id={`tep-${loai}`}
            ref={oTep}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(su) => void chonTep(su.target.files?.[0] ?? null)}
            className="block w-full cursor-pointer rounded-md border border-input bg-background text-sm file:mr-3 file:cursor-pointer file:border-0 file:bg-secondary file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-secondary-foreground"
          />
        </div>

        {dangChay === 'xem' ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Đang đọc và kiểm tra file…
          </p>
        ) : null}

        {loi ? <Alert variant="destructive">{loi}</Alert> : null}
        {xong ? (
          <Alert variant="success" tieuDe="Đã ghi xong">
            {xong}
          </Alert>
        ) : null}

        {xemTruoc ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{xemTruoc.tongDong} dòng trong file</Badge>
              <Badge variant="success">{xemTruoc.soHopLe} dòng hợp lệ</Badge>
              {xemTruoc.soLoi > 0 ? (
                <Badge variant="destructive">{xemTruoc.soLoi} lỗi</Badge>
              ) : (
                <Badge variant="success">Không có lỗi</Badge>
              )}
            </div>

            {xemTruoc.soLoi > 0 ? (
              <>
                <Alert variant="destructive" tieuDe={`File còn ${xemTruoc.soLoi} lỗi`}>
                  Hệ thống sẽ <strong>không ghi dòng nào</strong> chừng nào còn lỗi — kể cả những
                  dòng đã đúng. Sửa file rồi chọn lại.
                </Alert>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Dòng</TableHead>
                      <TableHead>Cột</TableHead>
                      <TableHead>Lỗi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {xemTruoc.loi.map((l, i) => (
                      <TableRow key={`${l.dong}-${l.cot}-${i}`}>
                        <TableCell className="tabular-nums font-medium">{l.dong}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {l.cot}
                        </TableCell>
                        <TableCell>{l.thongDiep}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </>
            ) : null}

            {xemTruoc.xemTruoc.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">
                  Xem trước {xemTruoc.xemTruoc.length} dòng đầu
                </p>
                <div className="max-h-72 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Dòng</TableHead>
                      {cauHinh.cotXemTruoc.map((c) => (
                        <TableHead key={c.khoa}>{c.nhan}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {xemTruoc.xemTruoc.map((d, i) => (
                      <TableRow key={`${String(d['code'])}-${i}`}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {String(d['dong'] ?? '')}
                        </TableCell>
                        {cauHinh.cotXemTruoc.map((c) => (
                          <TableCell key={c.khoa}>{String(d[c.khoa] ?? '')}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button disabled={!sachSe || dangChay !== 'khong'} onClick={() => void ghi()}>
                {dangChay === 'ghi' ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : sachSe ? (
                  <CheckCircle2 aria-hidden />
                ) : (
                  <AlertTriangle aria-hidden />
                )}
                {sachSe ? `Ghi ${xemTruoc.soHopLe} dòng vào hệ thống` : 'Còn lỗi — chưa ghi được'}
              </Button>
              <Button variant="outline" onClick={datLai}>
                Chọn file khác
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function NhapLieuHangLoat() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Nhập liệu hàng loạt</h1>
        <p className="text-sm text-muted-foreground">
          Tải file mẫu, điền dữ liệu, xem trước rồi mới ghi.
        </p>
      </div>

      <Alert variant="info" tieuDe="Cách hệ thống bảo vệ dữ liệu">
        <ol className="ml-4 list-decimal space-y-1">
          <li>
            Bước <strong>xem trước</strong> chỉ đọc file và báo lỗi theo từng dòng —{' '}
            <strong>không ghi gì</strong> vào cơ sở dữ liệu.
          </li>
          <li>
            Bước <strong>ghi</strong> kiểm lại từ đầu rồi chạy trong một giao dịch:{' '}
            <strong>ghi tất cả hoặc không ghi gì</strong>. Còn một lỗi là không dòng nào được ghi.
          </li>
          <li>Mã trùng — dù trùng trong chính file hay trùng với dữ liệu đã có — đều bị chặn.</li>
        </ol>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        <KhoiNhap loai="thiet-bi" />
        <KhoiNhap loai="dia-diem" />
      </div>
    </div>
  );
}
