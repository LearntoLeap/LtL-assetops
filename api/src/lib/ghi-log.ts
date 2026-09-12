/**
 * Ghi log dạng JSON một dòng ra stdout/stderr — pm2 gom vào file log.
 * Cố tình KHÔNG dùng console.* để log có cấu trúc và lọc được bằng jq.
 */
type MucDo = 'debug' | 'info' | 'warn' | 'error';

const THU_TU: Record<MucDo, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function mucDoToiThieu(): number {
  const dat = process.env['LOG_LEVEL'];
  if (dat && dat in THU_TU) return THU_TU[dat as MucDo];
  return process.env['NODE_ENV'] === 'production' ? THU_TU.info : THU_TU.debug;
}

function viet(mucDo: MucDo, thongDiep: string, chiTiet?: Record<string, unknown>): void {
  if (THU_TU[mucDo] < mucDoToiThieu()) return;
  const dong = JSON.stringify({
    thoiDiem: new Date().toISOString(),
    mucDo,
    thongDiep,
    ...chiTiet,
  });
  const luong = mucDo === 'error' || mucDo === 'warn' ? process.stderr : process.stdout;
  luong.write(`${dong}\n`);
}

export const log = {
  debug: (thongDiep: string, chiTiet?: Record<string, unknown>) => viet('debug', thongDiep, chiTiet),
  info: (thongDiep: string, chiTiet?: Record<string, unknown>) => viet('info', thongDiep, chiTiet),
  warn: (thongDiep: string, chiTiet?: Record<string, unknown>) => viet('warn', thongDiep, chiTiet),
  error: (thongDiep: string, chiTiet?: Record<string, unknown>) => viet('error', thongDiep, chiTiet),
};

/** Rút thông tin an toàn từ một lỗi bất kỳ để đưa vào log. */
export function moTaLoi(loi: unknown): Record<string, unknown> {
  if (loi instanceof Error) {
    return { loi: loi.message, ten: loi.name, vetLoi: loi.stack };
  }
  return { loi: String(loi) };
}
