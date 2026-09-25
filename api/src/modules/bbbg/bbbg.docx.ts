/**
 * SINH FILE WORD CHO BIÊN BẢN BÀN GIAO.
 *
 * Bám đúng mẫu .docx mà LtL đang dùng: quốc hiệu – tiêu ngữ, tên văn bản, số
 * biên bản, dòng V/v, các dòng "Căn cứ", hai bên đầy đủ địa chỉ/MST/điện thoại/
 * đại diện, bảng danh mục có ĐVT và dòng nhóm, dòng TỔNG CỘNG, địa điểm bàn
 * giao, kết quả kiểm tra, trách nhiệm các Bên, số bản, chỗ ký hai cột.
 *
 * Nhận một cấu trúc phẳng (`DuLieuInBBBG`) chứ không nhận thẳng bản ghi Prisma:
 * nhờ vậy in thử được mà không cần CSDL, và đổi cột trong CSDL không phải sửa
 * chỗ dựng văn bản.
 */
import { NHAN_TINH_TRANG, soVaChu, type TinhTrang } from '@ltl/taisan-shared';
import type { RequestType } from '@prisma/client';
import { bang, doan, dongTrang, mm, taoDocx, type O } from '../../lib/docx.js';
import { mauCuaLoai, vViecCuThe } from './mau-bbbg.js';

export interface DongInBBBG {
  ma: string;
  ten: string;
  donVi: string;
  soLuong: number;
  tinhTrang: TinhTrang;
  ghiChu: string | null;
  /** Tiêu đề nhóm in trên một dòng gộp hết bảng, vd "A. THIẾT BỊ AI – ROBOTICS". */
  nhom: string | null;
}

export interface DuLieuInBBBG {
  code: string;
  templateType: RequestType;
  subtitle: string | null;
  basis: string | null;
  issuedDate: Date | null;
  handoverPlace: string | null;
  inspection: string | null;
  obligations: string | null;
  commitment: string | null;
  note: string | null;
  copies: number;
  benGiao: {
    org: string;
    name: string;
    title: string | null;
    address: string | null;
    taxCode: string | null;
    phone: string | null;
  };
  benNhan: {
    org: string;
    name: string;
    title: string | null;
    address: string | null;
    phone: string | null;
  };
  /** Hạn phải trả (mẫu cho mượn). */
  hanTra: Date | null;
  yeuCauCode: string | null;
  muc: DongInBBBG[];
}

/** "18 tháng 9 năm 2026" — đọc theo UTC vì ngày lưu ở mốc 00:00 UTC. */
function ngayVanBan(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return '…… tháng …… năm ……';
  return `${d.getUTCDate()} tháng ${d.getUTCMonth() + 1} năm ${d.getUTCFullYear()}`;
}

function dong(tho: string | null | undefined): string[] {
  if (!tho) return [];
  return tho
    .split('\n')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

/** Bề rộng vùng in với lề 15mm hai bên trên khổ A4. */
const RONG_IN = mm(210) - mm(15) * 2;

/** STT | Tên hàng hóa | ĐVT | SL | Tình trạng | Ghi chú. */
const COT = [mm(12), mm(66), mm(16), mm(12), mm(31), mm(43)];

const CO_CHU_BANG = 11.5;

/** Gạch đầu dòng treo: dòng gãy thụt thẳng hàng với chữ, không thẳng dấu gạch. */
const THUT_GACH_DAU = { thutTrai: 6, thutDongDau: -3.5 } as const;

function dongTieuDeBang(): O[] {
  const o = (chu: string): O => ({
    noiDung: chu,
    dam: true,
    canLe: 'giua',
    canDoc: 'giua',
    mauNen: 'E7E6E6',
  });
  return [o('STT'), o('Tên hàng hóa'), o('ĐVT'), o('SL'), o('Tình trạng'), o('Ghi chú')];
}

function bangDanhMuc(muc: DongInBBBG[]): string {
  const hang: O[][] = [dongTieuDeBang()];
  let nhomTruoc: string | null = null;
  let stt = 0;

  for (const m of muc) {
    if (m.nhom && m.nhom !== nhomTruoc) {
      hang.push([{ noiDung: m.nhom, gopCot: COT.length, dam: true, mauNen: 'F2F2F2' }]);
      nhomTruoc = m.nhom;
    }
    stt += 1;
    hang.push([
      { noiDung: String(stt), canLe: 'giua' },
      {
        // Mã thiết bị in dưới tên, chữ nhỏ hơn — người nhận đối chiếu được với tem dán.
        noiDung: [
          doan(m.ten, { coChu: CO_CHU_BANG }),
          doan(`Mã: ${m.ma}`, { coChu: 9.5, nghieng: true }),
        ],
      },
      { noiDung: m.donVi, canLe: 'giua' },
      { noiDung: String(m.soLuong), canLe: 'giua' },
      { noiDung: NHAN_TINH_TRANG[m.tinhTrang] ?? m.tinhTrang, canLe: 'giua' },
      { noiDung: m.ghiChu ?? '' },
    ]);
  }

  const tongSL = muc.reduce((a, m) => a + m.soLuong, 0);
  hang.push([
    {
      noiDung:
        `TỔNG CỘNG: ${soVaChu(muc.length)} danh mục — ${soVaChu(tongSL)} thiết bị.`,
      gopCot: COT.length,
      dam: true,
    },
  ]);

  return bang(hang, { doRongCot: COT, coChu: CO_CHU_BANG, lapDongDau: true });
}

/** Một mục "n. Tiêu đề" kèm các dòng gạch đầu dòng. */
function mucCoGachDau(so: number, tieuDe: string, cacY: string[]): string[] {
  if (cacY.length === 0) return [];
  return [
    doan(`${so}. ${tieuDe}`, { dam: true, cachTren: 6, cachDuoi: 2, dinhVoiSau: true }),
    ...cacY.map((y) =>
      doan(`- ${y}`, { canLe: 'deu', ...THUT_GACH_DAU, cachDuoi: 1 }),
    ),
  ];
}

function khoiBenGiao(d: DuLieuInBBBG, nhan: string): string[] {
  const ra: string[] = [
    doan(
      [
        { chu: `${nhan}: `, dam: true },
        { chu: d.benGiao.org, dam: true },
      ],
      { cachTren: 4, cachDuoi: 1 },
    ),
  ];
  const chiTiet: Array<[string, string | null]> = [
    ['Địa chỉ', d.benGiao.address],
    ['Mã số thuế', d.benGiao.taxCode],
    ['Điện thoại', d.benGiao.phone],
  ];
  for (const [ten, giaTri] of chiTiet) {
    if (giaTri) ra.push(doan(`- ${ten}: ${giaTri}`, { ...THUT_GACH_DAU, cachDuoi: 0 }));
  }
  ra.push(
    doan(
      `- Đại diện: ${d.benGiao.name}${d.benGiao.title ? ` – Chức vụ: ${d.benGiao.title}` : ''}`,
      { ...THUT_GACH_DAU, cachDuoi: 0 },
    ),
  );
  return ra;
}

function khoiBenNhan(d: DuLieuInBBBG, nhan: string): string[] {
  const ra: string[] = [
    doan(
      [
        { chu: `${nhan}: `, dam: true },
        { chu: d.benNhan.org, dam: true },
      ],
      { cachTren: 4, cachDuoi: 1 },
    ),
  ];
  if (d.benNhan.address) ra.push(doan(`- Địa chỉ: ${d.benNhan.address}`, { ...THUT_GACH_DAU, cachDuoi: 0 }));
  if (d.benNhan.phone) ra.push(doan(`- Điện thoại: ${d.benNhan.phone}`, { ...THUT_GACH_DAU, cachDuoi: 0 }));
  ra.push(
    doan(
      `- Đại diện: ${d.benNhan.name}${d.benNhan.title ? ` – Chức vụ: ${d.benNhan.title}` : ''}`,
      { ...THUT_GACH_DAU, cachDuoi: 0 },
    ),
  );
  return ra;
}

function khoiChoKy(d: DuLieuInBBBG): string {
  const coTen = (ten: string, chuc: string | null): string[] => [
    doan(ten.toUpperCase(), { canLe: 'giua', dam: true, cachTren: 50 }),
    ...(chuc ? [doan(chuc, { canLe: 'giua', nghieng: true, coChu: 11.5 })] : []),
  ];
  return bang(
    [
      [
        { noiDung: 'ĐẠI DIỆN BÊN GIAO (BÊN A)', canLe: 'giua', dam: true },
        { noiDung: 'ĐẠI DIỆN BÊN NHẬN (BÊN B)', canLe: 'giua', dam: true },
      ],
      [
        { noiDung: '(Ký, ghi rõ họ tên)', canLe: 'giua', nghieng: true },
        { noiDung: '(Ký, ghi rõ họ tên)', canLe: 'giua', nghieng: true },
      ],
      [
        { noiDung: coTen(d.benGiao.name, d.benGiao.title), canDoc: 'duoi' },
        { noiDung: coTen(d.benNhan.name, d.benNhan.title), canDoc: 'duoi' },
      ],
    ],
    { doRongCot: [Math.round(RONG_IN / 2), Math.round(RONG_IN / 2)], khongVien: true },
  );
}

/** Câu "Biên bản được lập thành 04 (bốn) bản…" — chia đôi khi số bản là số chẵn. */
function cauSoBan(soBan: number): string {
  const n = Math.max(1, Math.trunc(soBan));
  if (n === 1) return 'Biên bản được lập thành 01 (một) bản, lưu tại Bên giao.';
  if (n % 2 === 0) {
    return `Biên bản được lập thành ${soVaChu(n)} bản có giá trị pháp lý như nhau, mỗi Bên giữ ${soVaChu(n / 2)} bản.`;
  }
  const giao = Math.ceil(n / 2);
  return `Biên bản được lập thành ${soVaChu(n)} bản có giá trị pháp lý như nhau, Bên giao giữ ${soVaChu(giao)} bản, Bên nhận giữ ${soVaChu(n - giao)} bản.`;
}

export async function taoFileBBBG(d: DuLieuInBBBG): Promise<Buffer> {
  const mau = mauCuaLoai(d.templateType);
  const vViec = d.subtitle?.trim() || vViecCuThe(mau, d.benGiao.org, d.benNhan.org);
  const canCu = dong(d.basis);
  const kiemTra = dong(d.inspection).length > 0 ? dong(d.inspection) : mau.ketQuaKiemTra;
  const trachNhiem = dong(d.obligations).length > 0 ? dong(d.obligations) : mau.trachNhiem;
  const noiLap = d.handoverPlace?.trim() || d.benNhan.address?.trim() || '…………';

  const khoi: string[] = [
    // ------------------------------------------------ quốc hiệu, tiêu ngữ
    doan('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { canLe: 'giua', dam: true, cachDuoi: 0 }),
    doan('Độc lập – Tự do – Hạnh phúc', { canLe: 'giua', dam: true, cachDuoi: 0 }),
    doan('--------***--------', { canLe: 'giua', cachDuoi: 10 }),

    // ------------------------------------------------------- tên văn bản
    doan(mau.tenVanBan.toUpperCase(), {
      canLe: 'giua',
      dam: true,
      coChu: 15,
      cachDuoi: 2,
    }),
    doan(`Số: ${d.code}`, { canLe: 'giua', nghieng: true, cachDuoi: 1 }),
    doan(`(${vViec})`, { canLe: 'giua', nghieng: true, cachDuoi: 8 }),
  ];

  for (const c of canCu) {
    khoi.push(doan(c, { canLe: 'deu', nghieng: true, cachDuoi: 1 }));
  }

  khoi.push(
    doan(
      `Hôm nay, ngày ${ngayVanBan(d.issuedDate)}, tại ${noiLap}, chúng tôi gồm:`,
      { canLe: 'deu', cachTren: 6, cachDuoi: 2 },
    ),
  );

  // Thứ tự hai bên luôn là GIAO trước, NHẬN sau — kể cả mẫu nhập kho, vì bên
  // giao mới là người lập và ký đầu tiên theo thể thức.
  khoi.push(...khoiBenGiao(d, mau.nhanBenGiao));
  khoi.push(...khoiBenNhan(d, mau.nhanBenNhan));

  khoi.push(
    doan('Hai Bên cùng thống nhất lập biên bản với nội dung như sau:', {
      canLe: 'deu',
      cachTren: 6,
      cachDuoi: 3,
    }),
  );

  // ------------------------------------------------------- 1. danh mục
  let so = 1;
  khoi.push(
    doan(`${so}. ${mau.tieuDeDanhMuc}`, { dam: true, cachDuoi: 2, dinhVoiSau: true }),
    bangDanhMuc(d.muc),
  );

  // ------------------------------------------------- 2. địa điểm bàn giao
  so += 1;
  khoi.push(
    doan(`${so}. Địa điểm bàn giao`, { dam: true, cachTren: 6, cachDuoi: 2, dinhVoiSau: true }),
    doan(noiLap, { canLe: 'deu', thutTrai: 6 }),
  );

  if (mau.coHanTra) {
    so += 1;
    khoi.push(
      doan(`${so}. Thời hạn mượn`, { dam: true, cachTren: 6, cachDuoi: 2, dinhVoiSau: true }),
      doan(
        d.hanTra
          ? `Bên mượn hoàn trả thiết bị cho Bên cho mượn trước hết ngày ${ngayVanBan(d.hanTra)}.`
          : 'Hai Bên thống nhất thời hạn hoàn trả bằng văn bản riêng.',
        { canLe: 'deu', thutTrai: 6 },
      ),
    );
  }

  so += 1;
  khoi.push(...mucCoGachDau(so, 'Kết quả kiểm tra khi bàn giao', kiemTra));
  so += 1;
  khoi.push(...mucCoGachDau(so, 'Trách nhiệm của các Bên', trachNhiem));

  const ghiChu = dong(d.note);
  if (ghiChu.length > 0) {
    so += 1;
    khoi.push(...mucCoGachDau(so, 'Ghi chú khác', ghiChu));
  }

  // ------------------------------------------------------ cam kết, số bản
  khoi.push(
    doan(d.commitment?.trim() || mau.camKet, { canLe: 'deu', cachTren: 6, cachDuoi: 2 }),
    doan(cauSoBan(d.copies), { canLe: 'deu', cachDuoi: 2 }),
  );
  if (d.yeuCauCode) {
    khoi.push(
      doan(`Biên bản lập theo yêu cầu số ${d.yeuCauCode} trên hệ thống quản lý tài sản AssetOps.`, {
        canLe: 'deu',
        nghieng: true,
        coChu: 11.5,
        cachDuoi: 2,
      }),
    );
  }

  khoi.push(dongTrang(1), khoiChoKy(d));

  return taoDocx(khoi, { tieuDe: `${mau.tenVanBan} ${d.code}` });
}

/** Tên file tải về — chỉ chữ, số, gạch; dấu tiếng Việt bỏ đi cho an toàn. */
export function tenFileBBBG(d: Pick<DuLieuInBBBG, 'code' | 'templateType'>, benNhan: string): string {
  const khongDau = benNhan
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${d.code}${khongDau ? `_${khongDau}` : ''}.docx`;
}
