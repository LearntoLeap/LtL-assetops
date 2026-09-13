import { useCallback, useEffect, useRef, useState } from 'react';
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
import { mocTruc, ngayThang, so } from '@/lib/bieu-do';

export interface DongRaVao {
  ngay: string;
  vao: number;
  ra: number;
}

const CAO_TREN = 104;
const CAO_DUOI = 104;
const LE_TREN = 10;
const LE_TRAI = 40;
const LE_PHAI = 10;
const CAO_TRUC = 24;
const DAY_COT_TOI_DA = 24;

/** Đo bề rộng thật của khung để chữ trong SVG không bị co theo tỷ lệ. */
function useBeRong(): [React.RefObject<HTMLDivElement>, number] {
  const oRef = useRef<HTMLDivElement>(null);
  const [rong, datRong] = useState(0);
  useEffect(() => {
    const o = oRef.current;
    if (!o) return;
    const doLai = (): void => datRong(o.clientWidth);
    doLai();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', doLai);
      return () => window.removeEventListener('resize', doLai);
    }
    const theo = new ResizeObserver(doLai);
    theo.observe(o);
    return () => theo.disconnect();
  }, []);
  return [oRef, rong];
}

/**
 * Cột nằm hai phía một đường gốc: hàng VÀO kho vẽ lên, hàng RA kho vẽ xuống.
 * Đọc một lần thấy ngay chiều lưu chuyển của kho theo ngày, thay vì phải so hai
 * cụm cột cạnh nhau.
 *
 * Hai chuỗi dữ liệu nên LUÔN có khung chú giải; nhãn số chỉ đặt ở ngày cao nhất
 * mỗi chiều — ghi số trên mọi cột thì không ai đọc. Mọi giá trị còn lại đọc được
 * qua mốc trục, qua tooltip, và qua bảng số bên dưới.
 *
 * Đoạn giữa các cột là khoảng trống màu nền (không phải viền kẻ quanh cột).
 */
export function CotRaVao({ dong }: { dong: readonly DongRaVao[] }) {
  const [oRef, rong] = useBeRong();
  const [chiSoHover, datChiSoHover] = useState<number | null>(null);
  const [dangBang, datDangBang] = useState(false);

  const dungHover = useCallback(() => datChiSoHover(null), []);

  if (dong.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có bút toán nào trong khoảng này.</p>;
  }

  const tongVao = dong.reduce((s, d) => s + d.vao, 0);
  const tongRa = dong.reduce((s, d) => s + d.ra, 0);

  const bang = (
    <div className="max-h-72 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày</TableHead>
            <TableHead className="text-right">Vào kho</TableHead>
            <TableHead className="text-right">Ra kho</TableHead>
            <TableHead className="text-right">Thuần</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...dong]
            .reverse()
            .filter((d) => d.vao !== 0 || d.ra !== 0)
            .map((d) => (
              <TableRow key={d.ngay}>
                <TableCell className="tabular-nums">{ngayThang(d.ngay)}</TableCell>
                <TableCell className="text-right tabular-nums">{so(d.vao)}</TableCell>
                <TableCell className="text-right tabular-nums">{so(d.ra)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {d.vao - d.ra > 0 ? `+${so(d.vao - d.ra)}` : so(d.vao - d.ra)}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );

  const chuThichVaBang = (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-2 text-sm">
          <span className="size-3 rounded-sm bg-[var(--viz-chuoi-1)]" aria-hidden />
          Vào kho
          <span className="tabular-nums text-muted-foreground">{so(tongVao)}</span>
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span className="size-3 rounded-sm bg-[var(--viz-chuoi-2)]" aria-hidden />
          Ra kho
          <span className="tabular-nums text-muted-foreground">{so(tongRa)}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => datDangBang((b) => !b)}
        >
          {dangBang ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
          {dangBang ? 'Xem biểu đồ' : 'Xem dạng bảng'}
        </Button>
      </div>
      {dangBang ? bang : null}
    </>
  );

  if (dangBang) return <div className="space-y-3">{chuThichVaBang}</div>;

  const cao = LE_TREN + CAO_TREN + CAO_DUOI + CAO_TRUC;
  const rongVe = Math.max(rong, 280);
  const rongVung = Math.max(40, rongVe - LE_TRAI - LE_PHAI);
  const beBang = rongVung / dong.length;
  const dayCot = Math.max(3, Math.min(DAY_COT_TOI_DA, beBang - 4));
  const yGoc = LE_TREN + CAO_TREN;

  const lonNhat = Math.max(...dong.map((d) => Math.max(d.vao, d.ra)), 1);
  const moc = mocTruc(lonNhat, 3).filter((m) => m > 0);
  const theoTyLe = (v: number): number => (v / lonNhat) * (CAO_TREN - 6);

  /** Cột bo 4px ở ĐẦU SỐ LIỆU, vuông ở đường gốc. */
  function duongCot(x: number, caoCot: number, len: boolean): string {
    const r = Math.min(4, dayCot / 2, caoCot);
    if (caoCot <= 0.5) return '';
    if (len) {
      const y = yGoc - caoCot;
      return `M${x} ${yGoc} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + dayCot - r} ${y} Q${x + dayCot} ${y} ${x + dayCot} ${y + r} L${x + dayCot} ${yGoc} Z`;
    }
    const y = yGoc + caoCot;
    return `M${x} ${yGoc} L${x} ${y - r} Q${x} ${y} ${x + r} ${y} L${x + dayCot - r} ${y} Q${x + dayCot} ${y} ${x + dayCot} ${y - r} L${x + dayCot} ${yGoc} Z`;
  }

  // Nhãn số chỉ đặt ở ngày cao nhất mỗi chiều.
  const iVaoMax = dong.reduce((tot, d, i) => (d.vao > (dong[tot]?.vao ?? 0) ? i : tot), 0);
  const iRaMax = dong.reduce((tot, d, i) => (d.ra > (dong[tot]?.ra ?? 0) ? i : tot), 0);

  // Nhãn ngày: chỉ hiện số nhãn vừa với bề rộng đang có.
  const buocNhan = Math.max(1, Math.ceil((dong.length * 34) / rongVung));
  const dHover = chiSoHover === null ? null : dong[chiSoHover];

  return (
    <div className="space-y-3">
      {chuThichVaBang}

      <div ref={oRef} className="relative" onMouseLeave={dungHover}>
        <svg
          width={rongVe}
          height={cao}
          role="img"
          aria-label={`Lưu chuyển kho ${dong.length} ngày: vào ${so(tongVao)}, ra ${so(tongRa)} đơn vị`}
          className="block max-w-full"
        >
          {/* Lưới: nét liền mảnh, lùi về sau dữ liệu */}
          {moc.map((m) => (
            <g key={m}>
              <line
                x1={LE_TRAI}
                x2={rongVe - LE_PHAI}
                y1={yGoc - theoTyLe(m)}
                y2={yGoc - theoTyLe(m)}
                stroke="hsl(var(--vien))"
                strokeWidth={1}
              />
              <line
                x1={LE_TRAI}
                x2={rongVe - LE_PHAI}
                y1={yGoc + theoTyLe(m)}
                y2={yGoc + theoTyLe(m)}
                stroke="hsl(var(--vien))"
                strokeWidth={1}
              />
              <text
                x={LE_TRAI - 6}
                y={yGoc - theoTyLe(m) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {so(m)}
              </text>
              <text
                x={LE_TRAI - 6}
                y={yGoc + theoTyLe(m) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {so(m)}
              </text>
            </g>
          ))}

          {dong.map((d, i) => {
            const x = LE_TRAI + i * beBang + (beBang - dayCot) / 2;
            return (
              <g key={d.ngay}>
                {d.vao > 0 ? (
                  <path d={duongCot(x, theoTyLe(d.vao), true)} fill="var(--viz-chuoi-1)" />
                ) : null}
                {d.ra > 0 ? (
                  <path d={duongCot(x, theoTyLe(d.ra), false)} fill="var(--viz-chuoi-2)" />
                ) : null}
              </g>
            );
          })}

          {/* Đường gốc đậm hơn lưới một bậc */}
          <line
            x1={LE_TRAI}
            x2={rongVe - LE_PHAI}
            y1={yGoc}
            y2={yGoc}
            stroke="hsl(var(--chu-nhat))"
            strokeWidth={1}
          />

          {/* Nhãn số ở ngày cao nhất mỗi chiều */}
          {(dong[iVaoMax]?.vao ?? 0) > 0 ? (
            <text
              x={LE_TRAI + iVaoMax * beBang + beBang / 2}
              y={yGoc - theoTyLe(dong[iVaoMax]?.vao ?? 0) - 4}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-medium tabular-nums"
            >
              {so(dong[iVaoMax]?.vao ?? 0)}
            </text>
          ) : null}
          {(dong[iRaMax]?.ra ?? 0) > 0 ? (
            <text
              x={LE_TRAI + iRaMax * beBang + beBang / 2}
              y={yGoc + theoTyLe(dong[iRaMax]?.ra ?? 0) + 11}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-medium tabular-nums"
            >
              {so(dong[iRaMax]?.ra ?? 0)}
            </text>
          ) : null}

          {/* Nhãn ngày */}
          {dong.map((d, i) =>
            i % buocNhan === 0 ? (
              <text
                key={`n-${d.ngay}`}
                x={LE_TRAI + i * beBang + beBang / 2}
                y={cao - 7}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {ngayThang(d.ngay)}
              </text>
            ) : null,
          )}

          {/* Vùng bắt chuột phủ trọn dải của từng ngày, rộng hơn cột */}
          {dong.map((d, i) => (
            <rect
              key={`h-${d.ngay}`}
              x={LE_TRAI + i * beBang}
              y={LE_TREN}
              width={beBang}
              height={CAO_TREN + CAO_DUOI}
              fill={chiSoHover === i ? 'hsl(var(--chu) / 0.05)' : 'transparent'}
              onMouseEnter={() => datChiSoHover(i)}
              onFocus={() => datChiSoHover(i)}
              tabIndex={0}
              role="button"
              aria-label={`${ngayThang(d.ngay)}: vào ${so(d.vao)}, ra ${so(d.ra)}`}
            />
          ))}
        </svg>

        {dHover ? (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(
                Math.max(0, LE_TRAI + (chiSoHover ?? 0) * beBang + beBang / 2 - 70),
                Math.max(0, rongVe - 140),
              ),
            }}
          >
            <p className="font-medium tabular-nums">{ngayThang(dHover.ngay)}</p>
            <p className="mt-1 flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-[var(--viz-chuoi-1)]" aria-hidden />
              Vào kho <span className="tabular-nums">{so(dHover.vao)}</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-[var(--viz-chuoi-2)]" aria-hidden />
              Ra kho <span className="tabular-nums">{so(dHover.ra)}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
