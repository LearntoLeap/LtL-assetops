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

export interface DongHaiChuoi {
  /** NĂM-THÁNG-NGÀY; client tự định dạng sang tiếng Việt. */
  ngay: string;
  a: number;
  b: number;
}

const CAO_VE = 132;
const LE_TREN = 14;
const LE_TRAI = 38;
const LE_PHAI = 10;
const CAO_TRUC = 22;
const DAY_CAP_TOI_DA = 22;
const KHE = 2;

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
 * Hai chuỗi dữ liệu vẽ thành từng CẶP CỘT theo ngày, cùng một trục dọc.
 *
 * Dùng cho những cặp số cùng đơn vị và cần so với nhau theo thời gian — ví dụ
 * báo hỏng "mở mới" so với "đã đóng": nhìn một lượt biết guồng xử lý có theo kịp
 * lượng việc phát sinh hay không.
 *
 * MỘT trục duy nhất, không bao giờ hai trục dọc: hai thang đo cạnh nhau tự sinh
 * ra mối tương quan không có trong dữ liệu.
 *
 * Nhãn số chỉ đặt ở ngày cao nhất của mỗi chuỗi — ghi số trên mọi cột thì không
 * ai đọc. Các giá trị còn lại đọc qua mốc trục, qua tooltip khi trỏ vào, và qua
 * bảng số bên dưới (nên không cần chuột cũng đọc được).
 */
export function CotHaiChuoi({
  dong,
  nhanA,
  nhanB,
  donVi,
}: {
  dong: readonly DongHaiChuoi[];
  nhanA: string;
  nhanB: string;
  donVi: string;
}) {
  const [oRef, rong] = useBeRong();
  const [chiSoHover, datChiSoHover] = useState<number | null>(null);
  const [dangBang, datDangBang] = useState(false);

  const dungHover = useCallback(() => datChiSoHover(null), []);

  const tongA = dong.reduce((s, d) => s + d.a, 0);
  const tongB = dong.reduce((s, d) => s + d.b, 0);

  const bang = (
    <div className="max-h-72 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ngày</TableHead>
            <TableHead className="text-right">{nhanA}</TableHead>
            <TableHead className="text-right">{nhanB}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...dong].reverse().map((d) => (
            <TableRow key={d.ngay}>
              <TableCell className="tabular-nums">{ngayThang(d.ngay)}</TableCell>
              <TableCell className="text-right tabular-nums">{so(d.a)}</TableCell>
              <TableCell className="text-right tabular-nums">{so(d.b)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const chanTrang = (
    <div className="flex items-center justify-between gap-3 border-t pt-2">
      <p className="text-xs text-muted-foreground">
        {nhanA} {so(tongA)} · {nhanB} {so(tongB)} {donVi} trong khoảng
      </p>
      <Button variant="ghost" size="sm" onClick={() => datDangBang((x) => !x)}>
        {dangBang ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
        {dangBang ? 'Xem biểu đồ' : 'Xem dạng bảng'}
      </Button>
    </div>
  );

  if (dong.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có số liệu trong khoảng này.</p>;
  }

  const lonNhat = Math.max(...dong.map((d) => Math.max(d.a, d.b)), 1);
  const moc = mocTruc(lonNhat);
  const dinhTruc = moc[moc.length - 1] ?? lonNhat;

  const caoTong = LE_TREN + CAO_VE + CAO_TRUC;
  const rongVe = Math.max(rong, 320);
  const oVe = Math.max(1, rongVe - LE_TRAI - LE_PHAI);
  const buocX = oVe / dong.length;
  const dayCap = Math.min(DAY_CAP_TOI_DA, Math.max(6, buocX * 0.7));
  const dayCot = Math.max(2, (dayCap - KHE) / 2);
  const yGoc = LE_TREN + CAO_VE;
  const caoCua = (v: number): number => (dinhTruc === 0 ? 0 : (v / dinhTruc) * CAO_VE);

  // Chỉ ghi số ở ngày cao nhất của mỗi chuỗi.
  const dinhA = dong.reduce((g, d, i) => (d.a > (dong[g]?.a ?? -1) ? i : g), 0);
  const dinhB = dong.reduce((g, d, i) => (d.b > (dong[g]?.b ?? -1) ? i : g), 0);

  // Nhãn ngày: thưa dần khi nhiều ngày, để chữ không chồng nhau.
  const buocNhan = Math.max(1, Math.ceil(dong.length / Math.max(4, Math.floor(oVe / 52))));
  const dHover = chiSoHover === null ? null : dong[chiSoHover];

  return (
    <div className="space-y-3">
      {dangBang ? (
        bang
      ) : (
        <div className="relative" ref={oRef}>
          <svg
            width="100%"
            height={caoTong}
            viewBox={`0 0 ${rongVe} ${caoTong}`}
            role="img"
            aria-label={`${nhanA} và ${nhanB} theo ngày. ${nhanA} tổng ${so(tongA)}, ${nhanB} tổng ${so(tongB)} ${donVi}.`}
            onPointerLeave={dungHover}
          >
            {/* Lưới: nét liền một bậc lệch nền, không dùng nét đứt. */}
            {moc.map((m) => {
              const y = yGoc - caoCua(m);
              return (
                <g key={m}>
                  <line
                    x1={LE_TRAI}
                    x2={rongVe - LE_PHAI}
                    y1={y}
                    y2={y}
                    stroke="hsl(var(--vien))"
                    strokeWidth={1}
                  />
                  <text
                    x={LE_TRAI - 6}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {so(m)}
                  </text>
                </g>
              );
            })}

            {dong.map((d, i) => {
              const xCap = LE_TRAI + i * buocX + (buocX - dayCap) / 2;
              const cA = caoCua(d.a);
              const cB = caoCua(d.b);
              return (
                <g
                  key={d.ngay}
                  onPointerEnter={() => datChiSoHover(i)}
                  onFocus={() => datChiSoHover(i)}
                  onBlur={dungHover}
                  tabIndex={0}
                  role="button"
                  aria-label={`${ngayThang(d.ngay)}: ${nhanA} ${so(d.a)}, ${nhanB} ${so(d.b)}`}
                >
                  {/* Vùng chạm rộng hơn cột thật, để trỏ trên tablet không bị lỡ. */}
                  <rect
                    x={LE_TRAI + i * buocX}
                    y={LE_TREN}
                    width={buocX}
                    height={CAO_VE}
                    fill={chiSoHover === i ? 'hsl(var(--nhat))' : 'transparent'}
                    opacity={chiSoHover === i ? 0.7 : 1}
                  />
                  {d.a > 0 ? (
                    <rect
                      x={xCap}
                      y={yGoc - cA}
                      width={dayCot}
                      height={cA}
                      rx={Math.min(4, dayCot / 2)}
                      fill="var(--viz-chuoi-1)"
                    />
                  ) : null}
                  {d.b > 0 ? (
                    <rect
                      x={xCap + dayCot + KHE}
                      y={yGoc - cB}
                      width={dayCot}
                      height={cB}
                      rx={Math.min(4, dayCot / 2)}
                      fill="var(--viz-chuoi-2)"
                    />
                  ) : null}
                  {i === dinhA && d.a > 0 ? (
                    <text
                      x={xCap + dayCot / 2}
                      y={yGoc - cA - 4}
                      textAnchor="middle"
                      className="fill-foreground text-[10px] font-semibold tabular-nums"
                    >
                      {so(d.a)}
                    </text>
                  ) : null}
                  {i === dinhB && d.b > 0 && dinhB !== dinhA ? (
                    <text
                      x={xCap + dayCot + KHE + dayCot / 2}
                      y={yGoc - cB - 4}
                      textAnchor="middle"
                      className="fill-foreground text-[10px] font-semibold tabular-nums"
                    >
                      {so(d.b)}
                    </text>
                  ) : null}
                  {i % buocNhan === 0 ? (
                    <text
                      x={LE_TRAI + i * buocX + buocX / 2}
                      y={yGoc + 14}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px] tabular-nums"
                    >
                      {ngayThang(d.ngay)}
                    </text>
                  ) : null}
                </g>
              );
            })}

            <line
              x1={LE_TRAI}
              x2={rongVe - LE_PHAI}
              y1={yGoc}
              y2={yGoc}
              stroke="hsl(var(--vien))"
              strokeWidth={1}
            />
          </svg>

          {dHover ? (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
              style={{
                left: `${Math.min(Math.max(((chiSoHover ?? 0) + 0.5) * (100 / dong.length), 12), 88)}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <p className="mb-1 font-medium tabular-nums">{ngayThang(dHover.ngay)}</p>
              <p className="flex items-center gap-1.5">
                <span
                  className="h-[2px] w-3 flex-none rounded-full bg-[var(--viz-chuoi-1)]"
                  aria-hidden
                />
                <span className="font-semibold tabular-nums">{so(dHover.a)}</span>
                <span className="text-muted-foreground">{nhanA}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <span
                  className="h-[2px] w-3 flex-none rounded-full bg-[var(--viz-chuoi-2)]"
                  aria-hidden
                />
                <span className="font-semibold tabular-nums">{so(dHover.b)}</span>
                <span className="text-muted-foreground">{nhanB}</span>
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Hai chuỗi thì LUÔN có khung chú giải — không để ai phải dò màu. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--viz-chuoi-1)]" aria-hidden />
          <span className="text-muted-foreground">{nhanA}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[var(--viz-chuoi-2)]" aria-hidden />
          <span className="text-muted-foreground">{nhanB}</span>
        </li>
      </ul>

      {chanTrang}
    </div>
  );
}
