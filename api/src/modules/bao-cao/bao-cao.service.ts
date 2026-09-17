/**
 * BÁO CÁO TỔNG HỢP — số liệu cho dashboard (giai đoạn 6).
 *
 * Mọi con số ở đây là số ĐỌC RA, không có bảng tổng hợp nào được lưu:
 *   - số lượng theo địa điểm suy từ `movements` (nguyên tắc bất biến #5);
 *   - số mã theo loại / dòng giải pháp / tình trạng đếm trên `assets`.
 *
 * Toàn bộ đều lọc theo PHẠM VI VAI TRÒ: điểm trường chỉ thấy số của trường mình,
 * nhân sự chỉ thấy thiết bị mình đang giữ. Gọi thẳng API cũng không ra ngoài được.
 */
import type { LocationType, Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { tonTatCa } from '../../lib/ton-kho.js';
import { dieuKienDiaDiem, dieuKienTaiSan, phamViCua } from '../../lib/pham-vi.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';

/** Loại điểm được coi là "kho của LtL" khi chia tồn kho / ở trường. */
const LOAI_KHO = new Set<LocationType>(['KHO_VAN_PHONG', 'KHO_SU_KIEN']);

export interface DongDem {
  ma: string;
  nhan: string;
  so: number;
}

export interface DongRaVao {
  /** Ngày dạng NĂM-THÁNG-NGÀY để client tự định dạng theo tiếng Việt. */
  ngay: string;
  vao: number;
  ra: number;
}

export interface SoLieuNhanh {
  soMa: number;
  donViTaiKho: number;
  donViOTruong: number;
  maChoMuon: number;
  maQuaHan: number;
  maHong: number;
  maCanBaoTri: number;
  yeuCauChoDuyet: number;
  yeuCauChoXuat: number;
  bienBanChoXacNhan: number;
}

/**
 * Điều kiện phạm vi cho `movements`: một bút toán thuộc phạm vi nếu một trong
 * hai đầu (đi / đến) nằm trong các điểm người dùng xem được.
 */
function dieuKienBuocDiChuyen(nguoiDung: NguoiDungDaXacThuc): Prisma.MovementWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return {};
  if (pv.diaDiem) {
    const diaDiem = [...pv.diaDiem];
    return {
      OR: [{ fromLocationId: { in: diaDiem } }, { toLocationId: { in: diaDiem } }],
    };
  }
  // Nhân sự: chỉ bút toán của thiết bị mình đang giữ.
  return { asset: { holderUserId: nguoiDung.id } };
}

function ngayISO(d: Date): string {
  const thang = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ngay = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${thang}-${ngay}`;
}

/**
 * Số lượng theo địa điểm, đã lọc phạm vi — dùng chung cho nhiều phần báo cáo.
 *
 * Lọc theo CẢ HAI chiều, và phải như vậy: một mã quản lý theo số lượng (vở, pin)
 * có thể vừa nằm ở kho vừa nằm ở trường. Nếu chỉ lọc theo thiết bị, tài khoản
 * trường sẽ nhìn thấy số tồn của mã đó ở KHO của LtL — đúng thiết bị trong phạm
 * vi, nhưng sai địa điểm.
 */
async function tonTrongPhamVi(
  nguoiDung: NguoiDungDaXacThuc,
): Promise<{ theoDiem: Map<string, number>; tongTheoTaiSan: Map<string, number> }> {
  const [ton, taiSanTrongPhamVi, diemTrongPhamVi] = await Promise.all([
    tonTatCa(),
    prisma.asset.findMany({ where: dieuKienTaiSan(nguoiDung), select: { id: true } }),
    prisma.location.findMany({ where: dieuKienDiaDiem(nguoiDung), select: { id: true } }),
  ]);
  const duocXem = new Set(taiSanTrongPhamVi.map((t) => t.id));
  const coDiem = new Set(diemTrongPhamVi.map((d) => d.id));

  const theoDiem = new Map<string, number>();
  const tongTheoTaiSan = new Map<string, number>();
  for (const d of ton) {
    if (!duocXem.has(d.assetId) || !coDiem.has(d.locationId)) continue;
    theoDiem.set(d.locationId, (theoDiem.get(d.locationId) ?? 0) + d.ton);
    tongTheoTaiSan.set(d.assetId, (tongTheoTaiSan.get(d.assetId) ?? 0) + d.ton);
  }
  return { theoDiem, tongTheoTaiSan };
}

export async function soLieuNhanh(nguoiDung: NguoiDungDaXacThuc): Promise<SoLieuNhanh> {
  const dieuKien = dieuKienTaiSan(nguoiDung);
  const bayGio = new Date();

  const [soMa, maChoMuon, maQuaHan, maHong, maCanBaoTri, diem, ton, choDuyet, choXuat, choXacNhan] =
    await Promise.all([
      prisma.asset.count({ where: { ...dieuKien, isActive: true } }),
      prisma.asset.count({ where: { ...dieuKien, allocationStatus: 'CHO_MUON' } }),
      prisma.asset.count({
        where: {
          ...dieuKien,
          dueReturnAt: { lt: bayGio },
          allocationStatus: { in: ['CHO_MUON', 'DA_PHAN_BO', 'DANG_VAN_CHUYEN'] },
        },
      }),
      prisma.asset.count({ where: { ...dieuKien, condition: { in: ['HONG', 'MAT'] } } }),
      prisma.asset.count({ where: { ...dieuKien, condition: 'CAN_BAO_TRI' } }),
      prisma.location.findMany({ select: { id: true, type: true } }),
      tonTrongPhamVi(nguoiDung),
      prisma.request.count({ where: { status: 'CHO_DUYET', type: { not: 'BAO_HONG' } } }),
      prisma.request.count({ where: { status: 'DA_DUYET', type: { not: 'BAO_HONG' } } }),
      prisma.handoverNote.count({ where: { status: 'CHO_XAC_NHAN' } }),
    ]);

  const laKho = new Set(diem.filter((d) => LOAI_KHO.has(d.type)).map((d) => d.id));
  const laTruong = new Set(diem.filter((d) => d.type === 'DIEM_TRUONG').map((d) => d.id));

  let donViTaiKho = 0;
  let donViOTruong = 0;
  for (const [idDiem, so] of ton.theoDiem) {
    if (laKho.has(idDiem)) donViTaiKho += so;
    else if (laTruong.has(idDiem)) donViOTruong += so;
  }

  return {
    soMa,
    donViTaiKho,
    donViOTruong,
    maChoMuon,
    maQuaHan,
    maHong,
    maCanBaoTri,
    yeuCauChoDuyet: choDuyet,
    yeuCauChoXuat: choXuat,
    bienBanChoXacNhan: choXacNhan,
  };
}

export interface DuLieuDashboard {
  soLieu: SoLieuNhanh;
  theoLoai: DongDem[];
  theoDongGiaiPhap: DongDem[];
  theoDiaDiem: DongDem[];
  raVao: DongRaVao[];
  quaHan: Array<{
    id: string;
    code: string;
    name: string;
    dueReturnAt: string;
    soNgayQuaHan: number;
    noiDat: string | null;
    nguoiGiu: string | null;
  }>;
  thietBiHong: Array<{
    id: string;
    code: string;
    name: string;
    condition: string;
    noiDat: string | null;
  }>;
  kiemKeGanNhat: {
    id: string;
    code: string;
    name: string;
    diaDiem: string;
    closedAt: string | null;
    soMaLech: number;
    tongThieu: number;
    tongThua: number;
  } | null;
}

export async function dashboard(
  nguoiDung: NguoiDungDaXacThuc,
  soNgay: number,
): Promise<DuLieuDashboard> {
  const dieuKien = dieuKienTaiSan(nguoiDung);
  const bayGio = new Date();
  const tuNgay = new Date(bayGio.getTime() - (soNgay - 1) * 86_400_000);
  tuNgay.setUTCHours(0, 0, 0, 0);

  const [soLieu, ton, taiSan, diem, buoc, quaHanTho, hongTho, kiemKe] = await Promise.all([
    soLieuNhanh(nguoiDung),
    tonTrongPhamVi(nguoiDung),
    prisma.asset.findMany({
      where: { ...dieuKien, isActive: true },
      select: {
        id: true,
        category: { select: { id: true, name: true } },
        productLine: { select: { id: true, name: true } },
      },
    }),
    prisma.location.findMany({ select: { id: true, name: true, type: true } }),
    prisma.movement.findMany({
      where: { ...dieuKienBuocDiChuyen(nguoiDung), performedAt: { gte: tuNgay } },
      select: { performedAt: true, quantity: true, fromLocationId: true, toLocationId: true },
    }),
    prisma.asset.findMany({
      where: {
        ...dieuKien,
        dueReturnAt: { lt: bayGio },
        allocationStatus: { in: ['CHO_MUON', 'DA_PHAN_BO', 'DANG_VAN_CHUYEN'] },
      },
      select: {
        id: true,
        code: true,
        name: true,
        dueReturnAt: true,
        currentLocation: { select: { name: true } },
        holder: { select: { fullName: true } },
      },
      orderBy: { dueReturnAt: 'asc' },
      take: 50,
    }),
    prisma.asset.findMany({
      where: { ...dieuKien, condition: { in: ['HONG', 'MAT', 'CAN_BAO_TRI'] } },
      select: {
        id: true,
        code: true,
        name: true,
        condition: true,
        currentLocation: { select: { name: true } },
      },
      orderBy: [{ condition: 'asc' }, { code: 'asc' }],
      take: 50,
    }),
    prisma.inventoryCount.findFirst({
      where: { status: 'DA_CHOT' },
      orderBy: { closedAt: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        closedAt: true,
        location: { select: { name: true } },
        items: { select: { systemQuantity: true, countedQuantity: true } },
      },
    }),
  ]);

  // Đếm theo loại và theo dòng giải pháp — theo SỐ MÃ, không cộng đơn vị, vì
  // một mã quản lý theo số lượng có thể là 200 quyển vở.
  const demLoai = new Map<string, { nhan: string; so: number }>();
  const demDong = new Map<string, { nhan: string; so: number }>();
  for (const t of taiSan) {
    const l = demLoai.get(t.category.id) ?? { nhan: t.category.name, so: 0 };
    l.so += 1;
    demLoai.set(t.category.id, l);
    const maDong = t.productLine?.id ?? '—';
    const d = demDong.get(maDong) ?? { nhan: t.productLine?.name ?? 'Chưa gắn dòng', so: 0 };
    d.so += 1;
    demDong.set(maDong, d);
  }

  const tenDiem = new Map(diem.map((d) => [d.id, d.name]));
  const theoDiaDiem: DongDem[] = [...ton.theoDiem.entries()]
    .map(([id, so]) => ({ ma: id, nhan: tenDiem.get(id) ?? id, so }))
    .filter((d) => d.so !== 0)
    .sort((a, b) => b.so - a.so);

  // Ra/vào theo ngày: "vào" là bút toán có điểm đến, "ra" là bút toán có điểm đi.
  // Một lần luân chuyển nội bộ tính cả hai đầu — đúng nghĩa lưu lượng của kho.
  const theoNgay = new Map<string, { vao: number; ra: number }>();
  for (let i = 0; i < soNgay; i++) {
    const d = new Date(tuNgay.getTime() + i * 86_400_000);
    theoNgay.set(ngayISO(d), { vao: 0, ra: 0 });
  }
  for (const b of buoc) {
    const khoa = ngayISO(b.performedAt);
    const o = theoNgay.get(khoa);
    if (!o) continue;
    if (b.toLocationId) o.vao += b.quantity;
    if (b.fromLocationId) o.ra += b.quantity;
  }

  const mucLech = (kiemKe?.items ?? [])
    .filter((m) => m.countedQuantity !== null)
    .map((m) => (m.countedQuantity ?? 0) - m.systemQuantity)
    .filter((l) => l !== 0);

  return {
    soLieu,
    theoLoai: [...demLoai.entries()]
      .map(([ma, v]) => ({ ma, nhan: v.nhan, so: v.so }))
      .sort((a, b) => b.so - a.so),
    theoDongGiaiPhap: [...demDong.entries()]
      .map(([ma, v]) => ({ ma, nhan: v.nhan, so: v.so }))
      .sort((a, b) => b.so - a.so),
    theoDiaDiem,
    raVao: [...theoNgay.entries()].map(([ngay, v]) => ({ ngay, vao: v.vao, ra: v.ra })),
    quaHan: quaHanTho.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      dueReturnAt: (t.dueReturnAt ?? bayGio).toISOString(),
      soNgayQuaHan: Math.max(
        0,
        Math.floor((bayGio.getTime() - (t.dueReturnAt ?? bayGio).getTime()) / 86_400_000),
      ),
      noiDat: t.currentLocation?.name ?? null,
      nguoiGiu: t.holder?.fullName ?? null,
    })),
    thietBiHong: hongTho.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      condition: t.condition,
      noiDat: t.currentLocation?.name ?? null,
    })),
    kiemKeGanNhat: kiemKe
      ? {
          id: kiemKe.id,
          code: kiemKe.code,
          name: kiemKe.name,
          diaDiem: kiemKe.location.name,
          closedAt: kiemKe.closedAt?.toISOString() ?? null,
          soMaLech: mucLech.length,
          tongThieu: mucLech.filter((l) => l < 0).reduce((s, l) => s + l, 0),
          tongThua: mucLech.filter((l) => l > 0).reduce((s, l) => s + l, 0),
        }
      : null,
  };
}

// ===========================================================================
// LỊCH SỬ SỬA CHỮA THEO ĐIỂM
// ===========================================================================

export interface DongLichSuDiem {
  diaDiemId: string;
  ten: string;
  loai: string;
  /** Số phiếu báo hỏng đã lập cho thiết bị đang ở điểm này. */
  soBaoHong: number;
  /** Trong đó còn đang mở. */
  soBaoHongDangMo: number;
  /** Số phiếu lấy linh kiện thay cho thiết bị của điểm này. */
  soPhieuLinhKien: number;
  /** Tổng số linh kiện đã thay (cộng số lượng, không phải số phiếu). */
  tongLinhKien: number;
  /** Lần sửa gần nhất — null nếu chưa có gì. */
  lanCuoi: Date | null;
}

export interface MocLichSu {
  loai: 'BAO_HONG' | 'LINH_KIEN';
  id: string;
  code: string;
  luc: Date;
  /** Mã + tên thiết bị liên quan. */
  maThietBi: string;
  tenThietBi: string;
  /** Mô tả hỏng, hoặc tên linh kiện đã thay. */
  noiDung: string;
  /** Lý do thay (chỉ có với mốc linh kiện). */
  lyDo: string | null;
  soLuong: number | null;
  nguoi: string;
  trangThai: string | null;
  soAnh: number;
}

/**
 * Bảng tổng: mỗi điểm lưu trữ một dòng, kèm số lần hỏng và số linh kiện đã thay.
 *
 * Đếm theo VỊ TRÍ HIỆN TẠI của thiết bị (`currentLocationId`), không theo nơi
 * lập phiếu: câu hỏi thực tế là "trường này hay hỏng cái gì", nên thiết bị
 * đang ở đâu thì tính cho đó.
 */
export async function lichSuSuaChuaTheoDiem(
  nguoiDung: NguoiDungDaXacThuc,
): Promise<DongLichSuDiem[]> {
  const diem = await prisma.location.findMany({
    where: { ...dieuKienDiaDiem(nguoiDung) },
    select: { id: true, name: true, type: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
  if (diem.length === 0) return [];
  const idDiem = diem.map((d) => d.id);

  // Báo hỏng: gom theo điểm của thiết bị trong phiếu.
  const baoHong = await prisma.request.findMany({
    where: {
      type: 'BAO_HONG',
      items: { some: { asset: { currentLocationId: { in: idDiem } } } },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      items: { select: { asset: { select: { currentLocationId: true } } } },
    },
  });

  const phieuLK = await prisma.partIssue.findMany({
    where: { request: { items: { some: { asset: { currentLocationId: { in: idDiem } } } } } },
    select: {
      quantity: true,
      issuedAt: true,
      request: { select: { items: { select: { asset: { select: { currentLocationId: true } } } } } },
    },
  });

  const bang = new Map<string, DongLichSuDiem>(
    diem.map((d) => [
      d.id,
      {
        diaDiemId: d.id,
        ten: d.name,
        loai: d.type,
        soBaoHong: 0,
        soBaoHongDangMo: 0,
        soPhieuLinhKien: 0,
        tongLinhKien: 0,
        lanCuoi: null,
      },
    ]),
  );

  const moiNhat = (cu: Date | null, moi: Date): Date => (cu === null || moi > cu ? moi : cu);

  for (const p of baoHong) {
    const diaDiemId = p.items[0]?.asset.currentLocationId;
    const o = diaDiemId ? bang.get(diaDiemId) : undefined;
    if (!o) continue;
    o.soBaoHong += 1;
    if (p.status !== 'DA_HOAN_TAT') o.soBaoHongDangMo += 1;
    o.lanCuoi = moiNhat(o.lanCuoi, p.createdAt);
  }
  for (const p of phieuLK) {
    const diaDiemId = p.request.items[0]?.asset.currentLocationId;
    const o = diaDiemId ? bang.get(diaDiemId) : undefined;
    if (!o) continue;
    o.soPhieuLinhKien += 1;
    o.tongLinhKien += p.quantity;
    o.lanCuoi = moiNhat(o.lanCuoi, p.issuedAt);
  }

  return [...bang.values()];
}

/** Dòng thời gian của một điểm: báo hỏng và lấy linh kiện trộn lẫn, mới nhất trước. */
export async function lichSuMotDiem(
  nguoiDung: NguoiDungDaXacThuc,
  diaDiemId: string,
  gioiHan = 100,
): Promise<MocLichSu[]> {
  // Chốt phạm vi: điểm không nằm trong phạm vi thì trả rỗng, không lộ dữ liệu.
  const trongPhamVi = await prisma.location.findFirst({
    // AND: dieuKienDiaDiem cũng đặt `id`, spread sẽ xoá mất diaDiemId và phép
    // chốt phạm vi này thành "có điểm nào trong phạm vi không" — luôn đúng.
    where: { AND: [{ id: diaDiemId }, dieuKienDiaDiem(nguoiDung)] },
    select: { id: true },
  });
  if (!trongPhamVi) return [];

  const [baoHong, phieuLK] = await Promise.all([
    prisma.request.findMany({
      where: {
        type: 'BAO_HONG',
        items: { some: { asset: { currentLocationId: diaDiemId } } },
      },
      select: {
        id: true,
        code: true,
        status: true,
        reason: true,
        createdAt: true,
        createdBy: { select: { fullName: true } },
        items: { select: { asset: { select: { code: true, name: true } } } },
        photos: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: gioiHan,
    }),
    prisma.partIssue.findMany({
      where: { request: { items: { some: { asset: { currentLocationId: diaDiemId } } } } },
      select: {
        id: true,
        code: true,
        quantity: true,
        partName: true,
        vendorCode: true,
        note: true,
        issuedAt: true,
        asset: { select: { code: true, name: true } },
        reason: { select: { name: true } },
        issuedBy: { select: { fullName: true } },
        request: {
          select: { code: true, items: { select: { asset: { select: { code: true, name: true } } } } },
        },
        photos: { select: { id: true } },
      },
      orderBy: { issuedAt: 'desc' },
      take: gioiHan,
    }),
  ]);

  const moc: MocLichSu[] = [
    ...baoHong.map((p): MocLichSu => ({
      loai: 'BAO_HONG',
      id: p.id,
      code: p.code,
      luc: p.createdAt,
      maThietBi: p.items[0]?.asset.code ?? '—',
      tenThietBi: p.items[0]?.asset.name ?? '—',
      noiDung: p.reason,
      lyDo: null,
      soLuong: null,
      nguoi: p.createdBy.fullName,
      trangThai: p.status,
      soAnh: p.photos.length,
    })),
    ...phieuLK.map((p): MocLichSu => ({
      loai: 'LINH_KIEN',
      id: p.id,
      code: p.code,
      luc: p.issuedAt,
      maThietBi: p.request.items[0]?.asset.code ?? '—',
      tenThietBi: p.request.items[0]?.asset.name ?? '—',
      noiDung:
        p.asset?.name ??
        p.partName ??
        p.vendorCode ??
        'Linh kiện không tên',
      lyDo: p.reason.name,
      soLuong: p.quantity,
      nguoi: p.issuedBy.fullName,
      trangThai: null,
      soAnh: p.photos.length,
    })),
  ];

  moc.sort((a, b) => b.luc.getTime() - a.luc.getTime());
  return moc.slice(0, gioiHan);
}
