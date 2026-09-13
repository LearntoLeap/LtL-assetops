import { useId, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { so } from '@/lib/bieu-do';

export interface DongThanh {
  ma: string;
  nhan: string;
  so: number;
}

/**
 * Biểu đồ thanh ngang so sánh độ lớn giữa các hạng mục KHÔNG có thứ tự tự nhiên
 * (loại thiết bị, dòng giải pháp, điểm lưu trữ).
 *
 * Vì các hạng mục không có thứ tự, mọi thanh dùng CÙNG MỘT MÀU: tô màu đậm dần
 * theo giá trị sẽ mã hoá hai lần cùng một thông tin mà độ dài thanh đã nói rồi.
 * Chỉ một chuỗi dữ liệu nên không cần khung chú giải — tiêu đề thẻ đã nói rõ.
 *
 * Vẽ bằng HTML thay vì SVG để tên hạng mục tiếng Việt tự xuống dòng / cắt bớt
 * theo CSS, và để vùng chạm đủ rộng trên tablet.
 */
export function ThanhNgang({
  dong,
  donVi,
  toiDaDong = 8,
}: {
  dong: readonly DongThanh[];
  /** Đơn vị của con số, ví dụ "mã" hoặc "đơn vị". */
  donVi: string;
  toiDaDong?: number;
}) {
  const [dangBang, datDangBang] = useState(false);
  const idBang = useId();

  if (dong.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>;
  }

  // Quá nhiều hạng mục thì gộp phần đuôi lại — thêm màu hay thêm thanh đều
  // không giúp đọc nhanh hơn.
  const sapXep = [...dong].sort((a, b) => b.so - a.so);
  const hien = sapXep.slice(0, toiDaDong);
  const duoi = sapXep.slice(toiDaDong);
  const dsHien =
    duoi.length > 0
      ? [...hien, { ma: '__khac__', nhan: `${duoi.length} hạng mục khác`, so: duoi.reduce((s, d) => s + d.so, 0) }]
      : hien;

  const lonNhat = Math.max(...dsHien.map((d) => d.so), 1);
  const tong = sapXep.reduce((s, d) => s + d.so, 0);

  return (
    <div className="space-y-3">
      {dangBang ? (
        <div className="overflow-x-auto">
          <Table id={idBang}>
            <TableHeader>
              <TableRow>
                <TableHead>Hạng mục</TableHead>
                <TableHead className="text-right">Số {donVi}</TableHead>
                <TableHead className="text-right">Tỷ lệ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sapXep.map((d) => (
                <TableRow key={d.ma}>
                  <TableCell>{d.nhan}</TableCell>
                  <TableCell className="text-right tabular-nums">{so(d.so)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {tong > 0 ? `${Math.round((d.so / tong) * 100)}%` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {dsHien.map((d) => (
            <li key={d.ma} className="grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-sm text-muted-foreground" title={d.nhan}>
                {d.nhan}
              </span>
              <span className="flex h-[18px] items-center" aria-hidden>
                <span
                  className="h-[18px] rounded-r bg-[var(--viz-chuoi-1)]"
                  style={{ width: `${Math.max(2, (d.so / lonNhat) * 100)}%` }}
                />
              </span>
              <span className="w-12 text-right text-sm font-medium tabular-nums">{so(d.so)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-2">
        <p className="text-xs text-muted-foreground">
          Tổng {so(tong)} {donVi}
          {duoi.length > 0 && !dangBang ? ` · ${duoi.length} hạng mục nhỏ đã gộp` : ''}
        </p>
        <Button variant="ghost" size="sm" onClick={() => datDangBang((b) => !b)}>
          {dangBang ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
          {dangBang ? 'Xem biểu đồ' : 'Xem dạng bảng'}
        </Button>
      </div>
    </div>
  );
}
