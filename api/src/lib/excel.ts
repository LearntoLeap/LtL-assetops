/**
 * Tiện ích Excel dùng chung cho nhập/xuất dữ liệu hàng loạt.
 *
 * File mẫu và file người dùng tải lên đều dùng NHÃN TIẾNG VIỆT cho các cột
 * enum ("Nhập từ IPP", "Tốt"…) cho dễ điền. Hàm `doiNhanSangMa` dựng bảng tra
 * ngược từ nhãn về mã ASCII lưu trong CSDL, đồng thời vẫn chấp nhận người dùng
 * gõ thẳng mã.
 */
import ExcelJS from 'exceljs';

/** Bỏ dấu, gộp khoảng trắng, về chữ thường — để so nhãn khoan dung hơn. */
export function chuanHoaDeSo(chu: string): string {
  return chu
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Dựng hàm đổi "nhãn tiếng Việt hoặc mã" → mã enum.
 * Trả về null nếu không khớp giá trị nào.
 */
export function doiNhanSangMa<T extends string>(
  ma: readonly T[],
  nhan: Record<T, string>,
): (giaTri: string) => T | null {
  const bang = new Map<string, T>();
  for (const m of ma) {
    bang.set(chuanHoaDeSo(m), m);
    bang.set(chuanHoaDeSo(nhan[m]), m);
  }
  return (giaTri: string) => bang.get(chuanHoaDeSo(giaTri)) ?? null;
}

/** Danh sách nhãn hợp lệ, để nhét vào thông điệp lỗi cho người dùng biết gõ gì. */
export function nhanHopLe<T extends string>(ma: readonly T[], nhan: Record<T, string>): string {
  return ma.map((m) => nhan[m]).join(' / ');
}

export type OMotDong = Record<string, string>;

/** Đọc một ô của exceljs về chuỗi đã trim, kể cả ô công thức hay ô ngày. */
export function docO(o: ExcelJS.CellValue): string {
  if (o === null || o === undefined) return '';
  if (o instanceof Date) {
    const nam = o.getUTCFullYear();
    const thang = String(o.getUTCMonth() + 1).padStart(2, '0');
    const ngay = String(o.getUTCDate()).padStart(2, '0');
    return `${nam}-${thang}-${ngay}`;
  }
  if (typeof o === 'object') {
    if ('text' in o && typeof o.text === 'string') return o.text.trim();
    if ('result' in o) return docO(o.result as ExcelJS.CellValue);
    if ('richText' in o && Array.isArray(o.richText)) {
      return o.richText.map((r) => r.text).join('').trim();
    }
    if ('hyperlink' in o && 'text' in o) return String(o.text).trim();
    return '';
  }
  return String(o).trim();
}

export interface KetQuaDoc {
  /** Mỗi phần tử là một dòng dữ liệu: { 'Tên cột': 'giá trị' }. */
  dong: OMotDong[];
  /** Tiêu đề cột đọc được ở dòng đầu. */
  tieuDe: string[];
  /** Số dòng đầu tiên chứa dữ liệu trong file (để báo lỗi đúng số dòng Excel). */
  dongDauTien: number;
}

/**
 * @types/node đời mới khai báo `Buffer` là kiểu tổng quát (`Buffer<ArrayBufferLike>`),
 * còn khai báo đi kèm exceljs vẫn dùng `Buffer<ArrayBuffer>`. Hai kiểu này giống
 * nhau lúc chạy, chỉ lệch ở tầng khai báo — ép kiểu đúng MỘT chỗ tại đây thay vì
 * rải `any` khắp nơi.
 */
type BufferExcel = Parameters<ExcelJS.Xlsx['load']>[0];

const DONG_TIEU_DE = 1;
const DONG_DU_LIEU_DAU = 2;

/** Đọc sheet đầu tiên của file .xlsx hoặc .csv thành mảng bản ghi theo tiêu đề cột. */
export async function docFileBang(tep: Buffer, tenTep: string): Promise<KetQuaDoc> {
  const wb = new ExcelJS.Workbook();
  if (tenTep.toLowerCase().endsWith('.csv')) {
    const { Readable } = await import('node:stream');
    await wb.csv.read(Readable.from(tep));
  } else {
    await wb.xlsx.load(tep as unknown as BufferExcel);
  }

  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error('File không có sheet nào.');

  const hangTieuDe = sheet.getRow(DONG_TIEU_DE);
  const tieuDe: string[] = [];
  hangTieuDe.eachCell({ includeEmpty: true }, (o, cot) => {
    tieuDe[cot - 1] = docO(o.value);
  });

  const dong: OMotDong[] = [];
  for (let i = DONG_DU_LIEU_DAU; i <= sheet.rowCount; i += 1) {
    const hang = sheet.getRow(i);
    const banGhi: OMotDong = {};
    let coDuLieu = false;
    for (let c = 0; c < tieuDe.length; c += 1) {
      const ten = tieuDe[c];
      if (!ten) continue;
      const giaTri = docO(hang.getCell(c + 1).value);
      banGhi[ten] = giaTri;
      if (giaTri !== '') coDuLieu = true;
    }
    // Bỏ qua dòng trống hoàn toàn (người dùng hay để lại dòng trống cuối file).
    if (coDuLieu) dong.push(banGhi);
    else dong.push({});
  }

  // Cắt các dòng trống ở cuối
  while (dong.length > 0 && Object.keys(dong[dong.length - 1] ?? {}).length === 0) dong.pop();

  return { dong, tieuDe: tieuDe.filter(Boolean), dongDauTien: DONG_DU_LIEU_DAU };
}

export interface CotXuat {
  tieuDe: string;
  rong: number;
}

/** Tạo workbook có định dạng tiêu đề thống nhất cho mọi file xuất/mẫu. */
export function taoWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LtL Quản lý Tài sản';
  wb.created = new Date();
  return wb;
}

export function themSheet(
  wb: ExcelJS.Workbook,
  ten: string,
  cot: readonly CotXuat[],
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(ten, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = cot.map((c) => ({ header: c.tieuDe, width: c.rong }));

  const hang = sheet.getRow(1);
  hang.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hang.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  hang.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  hang.height = 30;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cot.length } };
  return sheet;
}

export async function xuatBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const duLieu = await wb.xlsx.writeBuffer();
  return Buffer.from(duLieu);
}

export const KIEU_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
