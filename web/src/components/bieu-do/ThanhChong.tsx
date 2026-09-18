import { useId, useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
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

export interface DoanChong {
  ma: string;
  nhan: string;
  so: number;
  /** Màu nền của đoạn — truyền vào chứ không tự sinh, để trang gọi chịu trách
   *  nhiệm chọn đúng loại dải màu (thứ tự / trạng thái). */
  mau: string;
}

const CAO = 22;

/**
 * Một thanh ngang duy nhất chia thành nhiều đoạn — dùng khi các phần CỘNG LẠI
 * thành một tổng có nghĩa (yêu cầu đang nằm ở bước nào: mỗi phiếu ở đúng một
 * bước, cộng lại là tổng số phiếu).
 *
 * Chọn thanh chồng thay vì hình tròn / vành khuyên: mắt so sánh chiều dài chính
 * xác hơn so sánh góc, và nhãn tiếng Việt dài nằm được thành hàng bên dưới.
 *
 * Ba chi tiết theo đúng quy ước biểu đồ của hệ thống:
 *   - hai đoạn cạnh nhau cách nhau 2px MÀU NỀN, không kẻ viền quanh đoạn;
 *   - luôn có khung chú giải kèm SỐ ngay cạnh ô màu, nên không ai phải dò màu
 *     và mọi đoạn đều có nhãn trực tiếp; không viết số vào TRONG đoạn vì đoạn
 *     giữa không có đầu thanh nào để chữ tràn ra, hẹp một chút là cắt mất chữ;
 *   - có sẵn dạng bảng, nên mọi con số đọc được không cần trỏ chuột.
 */
export function ThanhChong({
  doan,
  donVi,
  nhanTong,
}: {
  doan: readonly DoanChong[];
  donVi: string;
  /** Nhãn của con số tổng, ví dụ "phiếu đang chạy". */
  nhanTong?: string;
}) {
  const [dangBang, datDangBang] = useState(false);
  const [hover, datHover] = useState<string | null>(null);
  const idBang = useId();

  const tong = doan.reduce((s, d) => s + d.so, 0);
  if (tong === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có dữ liệu trong khoảng này.</p>;
  }

  const coSo = doan.filter((d) => d.so > 0);

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
              {doan.map((d) => (
                <TableRow key={d.ma}>
                  <TableCell>{d.nhan}</TableCell>
                  <TableCell className="text-right tabular-nums">{so(d.so)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Math.round((d.so / tong) * 100)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <div
            className="flex w-full overflow-hidden rounded-md"
            style={{ height: CAO, gap: 2 }}
            role="img"
            aria-label={`${doan.map((d) => `${d.nhan}: ${so(d.so)}`).join('; ')}. Tổng ${so(tong)} ${donVi}.`}
          >
            {coSo.map((d) => {
              const phanTram = (d.so / tong) * 100;
              return (
                <span
                  key={d.ma}
                  className="min-w-[3px] transition-opacity"
                  style={{
                    width: `${phanTram}%`,
                    background: d.mau,
                    opacity: hover === null || hover === d.ma ? 1 : 0.55,
                  }}
                  onPointerEnter={() => datHover(d.ma)}
                  onPointerLeave={() => datHover(null)}
                  title={`${d.nhan}: ${so(d.so)} ${donVi} (${Math.round(phanTram)}%)`}
                />
              );
            })}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {doan.map((d) => (
              <li
                key={d.ma}
                className="flex items-center gap-1.5 text-xs"
                onPointerEnter={() => datHover(d.ma)}
                onPointerLeave={() => datHover(null)}
              >
                <span
                  className="size-2.5 flex-none rounded-sm"
                  style={{ background: d.mau }}
                  aria-hidden
                />
                <span className="text-muted-foreground">{d.nhan}</span>
                <span className="font-medium tabular-nums">{so(d.so)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-2">
        <p className="text-xs text-muted-foreground">
          Tổng {so(tong)} {nhanTong ?? donVi}
        </p>
        <Button variant="ghost" size="sm" onClick={() => datDangBang((b) => !b)}>
          {dangBang ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
          {dangBang ? 'Xem biểu đồ' : 'Xem dạng bảng'}
        </Button>
      </div>
    </div>
  );
}
