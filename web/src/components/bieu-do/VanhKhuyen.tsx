import { useId, useState } from 'react';
import { PieChart, Table2 } from 'lucide-react';
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

export interface PhanVanhKhuyen {
  ma: string;
  nhan: string;
  so: number;
  /** Màu của phần — trang gọi truyền vào, để chọn đúng dải (trạng thái / thứ tự). */
  mau: string;
}

/** Bán kính và độ dày vành — đặt theo hệ toạ độ 0–100 để SVG tự co giãn. */
const R = 38;
const DAY = 17;
const TAM = 50;

/** Khe 2px màu nền giữa hai phần, quy ra độ trên đường tròn bán kính R. */
const KHE_DO = (2 / (2 * Math.PI * R)) * 360;

function toaDo(gocDo: number, banKinh: number): [number, number] {
  // Bắt đầu từ 12 giờ và chạy theo chiều kim đồng hồ — cách người ta đọc đồng hồ.
  const rad = ((gocDo - 90) * Math.PI) / 180;
  return [TAM + banKinh * Math.cos(rad), TAM + banKinh * Math.sin(rad)];
}

/** Đường bao của một cung vành khuyên. */
function cungVanh(tuDo: number, denDo: number): string {
  const ngoai = R + DAY / 2;
  const trong = R - DAY / 2;
  const cungLon = denDo - tuDo > 180 ? 1 : 0;
  const [x1, y1] = toaDo(tuDo, ngoai);
  const [x2, y2] = toaDo(denDo, ngoai);
  const [x3, y3] = toaDo(denDo, trong);
  const [x4, y4] = toaDo(tuDo, trong);
  return [
    `M ${x1} ${y1}`,
    `A ${ngoai} ${ngoai} 0 ${cungLon} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${trong} ${trong} 0 ${cungLon} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * VÀNH KHUYÊN (donut) — các phần CỘNG LẠI thành một tổng có nghĩa.
 *
 * Dùng cho thứ mà mỗi mã thuộc đúng MỘT nhóm: tình trạng thiết bị (một thiết bị
 * hoặc tốt, hoặc hỏng, không thể vừa tốt vừa hỏng). Không dùng để so sánh các
 * đại lượng rời rạc — so chiều dài thanh chính xác hơn so góc, việc đó để
 * `ThanhNgang` lo.
 *
 * Bốn điều bắt buộc, không phải trang trí:
 *   - KHE 2px MÀU NỀN giữa hai phần, không kẻ viền: viền làm phần nhỏ dày lên
 *     trông to hơn thực tế;
 *   - CHÚ GIẢI LUÔN CÓ kèm SỐ và TỶ LỆ ngay cạnh ô màu, nên không ai phải dò
 *     màu và không nhóm nào chỉ được nhận ra bằng màu;
 *   - TỔNG nằm giữa vành, vì đó là con số người đọc tìm đầu tiên;
 *   - có sẵn DẠNG BẢNG, nên mọi con số đọc được mà không cần trỏ chuột — cũng
 *     là đường đọc cho trình đọc màn hình.
 */
export function VanhKhuyen({
  phan,
  donVi,
  nhanTong,
}: {
  phan: readonly PhanVanhKhuyen[];
  donVi: string;
  /** Nhãn dưới con số tổng ở giữa vành, ví dụ "mã thiết bị". */
  nhanTong?: string;
}) {
  const [dangBang, datDangBang] = useState(false);
  const [dangChi, datDangChi] = useState<string | null>(null);
  const maBang = useId();

  const coSo = phan.filter((p) => p.so > 0);
  const tong = coSo.reduce((t, p) => t + p.so, 0);
  const tyLe = (n: number): string => (tong === 0 ? '0%' : `${Math.round((n / tong) * 100)}%`);

  if (tong === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chưa có số liệu.</p>;
  }

  // Một nhóm duy nhất thì vẽ nguyên vòng, không cắt khe — cắt khe một vòng tròn
  // liền tạo ra một vết nứt vô nghĩa.
  const motPhan = coSo.length === 1;
  let gocChay = 0;
  const cung = coSo.map((p) => {
    const gocPhan = (p.so / tong) * 360;
    const tu = gocChay;
    const den = gocChay + gocPhan;
    gocChay = den;
    const khe = motPhan ? 0 : Math.min(KHE_DO, gocPhan / 4);
    return { ...p, d: cungVanh(tu + khe / 2, Math.max(tu + khe / 2, den - khe / 2)) };
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => datDangBang((b) => !b)}
          aria-expanded={dangBang}
          aria-controls={maBang}
        >
          {dangBang ? <PieChart aria-hidden /> : <Table2 aria-hidden />}
          {dangBang ? 'Xem biểu đồ' : 'Xem bảng số'}
        </Button>
      </div>

      {dangBang ? (
        <div id={maBang} className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm</TableHead>
                <TableHead className="text-right">Số {donVi}</TableHead>
                <TableHead className="text-right">Tỷ lệ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coSo.map((p) => (
                <TableRow key={p.ma}>
                  <TableCell>{p.nhan}</TableCell>
                  <TableCell className="text-right tabular-nums">{so(p.so)}</TableCell>
                  <TableCell className="text-right tabular-nums">{tyLe(p.so)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-medium">Tổng</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{so(tong)}</TableCell>
                <TableCell className="text-right tabular-nums">100%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
          <div className="relative shrink-0">
            <svg
              viewBox="0 0 100 100"
              className="size-44"
              role="img"
              aria-label={`Vành khuyên: ${coSo
                .map((p) => `${p.nhan} ${so(p.so)} ${donVi}`)
                .join(', ')}. Tổng ${so(tong)}.`}
            >
              {cung.map((c) => (
                <path
                  key={c.ma}
                  d={c.d}
                  fill={c.mau}
                  opacity={dangChi === null || dangChi === c.ma ? 1 : 0.35}
                  onMouseEnter={() => datDangChi(c.ma)}
                  onMouseLeave={() => datDangChi(null)}
                />
              ))}
            </svg>
            {/* Tổng đặt giữa vành; khi trỏ vào một phần thì đổi sang số của phần đó. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums">
                {so(dangChi ? (coSo.find((p) => p.ma === dangChi)?.so ?? tong) : tong)}
              </span>
              <span className="max-w-[6.5rem] text-center text-xs leading-tight text-muted-foreground">
                {dangChi ? (coSo.find((p) => p.ma === dangChi)?.nhan ?? '') : (nhanTong ?? donVi)}
              </span>
            </div>
          </div>

          <ul className="w-full space-y-1 sm:w-auto sm:min-w-[13rem]">
            {coSo.map((p) => (
              <li
                key={p.ma}
                className="flex items-center gap-2 rounded px-1 py-0.5"
                onMouseEnter={() => datDangChi(p.ma)}
                onMouseLeave={() => datDangChi(null)}
              >
                <span
                  className="size-3 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: p.mau }}
                  aria-hidden
                />
                {/* Cho xuống dòng chứ KHÔNG cắt cụt: nhãn tiếng Việt dài, cắt
                    đi thì "Hàng lẻ theo số lượng" thành "Hàng lẻ theo …" — mất
                    đúng phần phân biệt nó với nhóm kia. */}
                <span className="min-w-0 flex-1 text-sm leading-tight">{p.nhan}</span>
                <span className="shrink-0 text-sm tabular-nums">{so(p.so)}</span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {tyLe(p.so)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
