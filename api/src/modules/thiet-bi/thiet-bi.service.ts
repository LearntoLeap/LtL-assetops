/**
 * Nghiệp vụ thiết bị.
 *
 * Hai điều được giữ chặt ở đây:
 *   1. Tạo thiết bị LUÔN sinh kèm movement NHAP_BAN_DAU trong cùng transaction,
 *      nên tồn kho suy ra từ `movements` không bao giờ thiếu gốc (nguyên tắc #5).
 *   2. Sửa thiết bị KHÔNG đụng tới vị trí / tình trạng / trạng thái phân bổ —
 *      những thứ đó chỉ đổi qua luồng yêu cầu đã duyệt (nguyên tắc #2).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { loi400, loi403, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { diemTrongPhamVi, dieuKienTaiSan, noiTrongPhamVi, phamViCua } from '../../lib/pham-vi.js';
import { hangDangTrenDuong, tonCuaTaiSan, tonNhomTheoDiem, tonTheoDiaDiem } from '../../lib/ton-kho.js';
import { xoaFileAnh } from '../../lib/luu-anh.js';
import { idMucDichHoacDauTien, idNguonGocHoacDauTien } from '../../lib/tra-ma-tai-san.js';
import {
  capMaThietBi,
  chuanBiBoDemMa,
  dayBoDemQuaMa,
  tienToTheoId,
} from '../../lib/sinh-ma-thiet-bi.js';
import { phatChoNguoiDuyet, phatChoTatCa, SU_KIEN } from '../../realtime.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type {
  DuLieuLocThietBi,
  DuLieuSuaThietBi,
  DuLieuTaoNhanhThietBi,
  DuLieuTaoThietBi,
} from './thiet-bi.schema.js';

const CHON_DONG = {
  id: true,
  code: true,
  name: true,
  serialNumber: true,
  originNote: true,
  receivedDate: true,
  value: true,
  trackingType: true,
  condition: true,
  allocationStatus: true,
  dueReturnAt: true,
  note: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, code: true, name: true } },
  productLine: { select: { id: true, code: true, name: true } },
  // Trả nguyên cả hàng nguồn gốc / mục đích chứ không chỉ id: giao diện cần
  // TÊN để hiện, mà tên giờ nằm trong CSDL chứ không còn là hằng số dịch sẵn.
  origin: { select: { id: true, code: true, name: true } },
  purpose: { select: { id: true, code: true, name: true } },
  currentLocation: { select: { id: true, code: true, name: true, type: true } },
  holder: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AssetSelect;

export type DongThietBi = Prisma.AssetGetPayload<{ select: typeof CHON_DONG }>;

function doiNgay(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw loi400(`Ngày không hợp lệ: ${iso}`, 'NGAY_KHONG_HOP_LE');
  return d;
}

/**
 * TÀI KHOẢN TRƯỜNG: che thông tin NGOÀI TRƯỜNG trên một dòng thiết bị — vị trí
 * không phải trường mình và người đang giữ. Một mã hàng lẻ dùng chung cho nhiều
 * trường nên cột vị trí có thể đang trỏ về kho hay một trường khác; trường chỉ
 * được biết hàng của trường mình. Các vai trò khác (`diaDiem` = null) giữ nguyên.
 */
function anNgoaiTruong<T extends { currentLocation: { id: string } | null }>(
  dong: T,
  diaDiem: readonly string[] | null,
): T {
  if (!diaDiem) return dong;
  return {
    ...dong,
    currentLocation:
      dong.currentLocation && diaDiem.includes(dong.currentLocation.id) ? dong.currentLocation : null,
    ...('holder' in dong ? { holder: null } : {}),
  };
}

/** Chuyển Decimal của Prisma về number để trả JSON gọn. */
function donDong(d: DongThietBi) {
  return { ...d, value: d.value === null ? null : Number(d.value) };
}

export async function danhSach(
  nguoiDung: NguoiDungDaXacThuc,
  loc: DuLieuLocThietBi,
): Promise<{
  muc: Array<ReturnType<typeof donDong> & { tonTaiDiem?: number }>;
  tong: number;
  trang: number;
  moiTrang: number;
}> {
  /*
   * LỌC THEO ĐIỂM bằng TỒN THẬT, không chỉ cột vị trí. Hàng lẻ nằm rải nhiều
   * nơi: kho còn 70 quyển mà cột vị trí trỏ sang trường thì lọc "Kho văn phòng"
   * trước đây không ra mã đó. Giờ ra mọi mã còn hàng ở điểm, kèm số tại điểm.
   *
   * Tài khoản trường chỉ lọc được trong trường mình — chọn điểm khác là xem
   * được số tồn của kho / trường khác. Không chọn điểm thì vẫn kèm số tại
   * trường mình, vì với trường đó mới là con số có nghĩa.
   */
  const pv = phamViCua(nguoiDung);
  if (loc.locationId && !diemTrongPhamVi(nguoiDung, loc.locationId)) {
    throw loi403('Bạn chỉ xem được thiết bị tại trường của mình.');
  }
  const diemTinhTon = loc.locationId ?? (pv.diaDiem?.length === 1 ? pv.diaDiem[0] : undefined);
  const tonTaiDiem = diemTinhTon
    ? new Map(
        (await tonTheoDiaDiem(diemTinhTon))
          .filter((t) => t.ton > 0)
          .map((t) => [t.assetId, t.ton] as const),
      )
    : null;
  // AND, không spread: phạm vi của tài khoản trường là một khối OR, ô tìm kiếm
  // cũng là một khối OR — spread thì khối sau ghi đè khối trước và lộ toàn kho.
  const dieuKien: Prisma.AssetWhereInput = {
    AND: [
      // Phạm vi vai trò kiểm ở SERVER — gọi thẳng API cũng không ra ngoài được.
      await dieuKienTaiSan(nguoiDung),
      {
        ...(loc.chiHoatDong === 'true' ? { isActive: true } : {}),
        ...(loc.categoryId ? { categoryId: loc.categoryId } : {}),
        ...(loc.productLineId ? { productLineId: loc.productLineId } : {}),
        ...(loc.condition ? { condition: loc.condition } : {}),
        ...(loc.allocationStatus ? { allocationStatus: loc.allocationStatus } : {}),
        ...(loc.purposeId ? { purposeId: loc.purposeId } : {}),
        ...(loc.trackingType ? { trackingType: loc.trackingType } : {}),
      },
      ...(loc.locationId && tonTaiDiem
        ? [
            {
              OR: [
                { currentLocationId: loc.locationId },
                { id: { in: [...tonTaiDiem.keys()] } },
              ],
            },
          ]
        : []),
      ...(loc.tuKhoa
        ? [
            {
              OR: [
                { code: { contains: loc.tuKhoa } },
                { name: { contains: loc.tuKhoa } },
                { serialNumber: { contains: loc.tuKhoa } },
              ],
            },
          ]
        : []),
    ],
  };

  const thuTu: Prisma.AssetOrderByWithRelationInput =
    loc.sapXep === 'name'
      ? { name: 'asc' }
      : loc.sapXep === 'moi_nhat'
        ? { createdAt: 'desc' }
        : { code: 'asc' };

  const [muc, tong] = await Promise.all([
    prisma.asset.findMany({
      where: dieuKien,
      select: CHON_DONG,
      orderBy: thuTu,
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.asset.count({ where: dieuKien }),
  ]);

  return {
    muc: muc.map((m) => ({
      ...anNgoaiTruong(donDong(m), pv.diaDiem),
      ...(tonTaiDiem ? { tonTaiDiem: tonTaiDiem.get(m.id) ?? 0 } : {}),
    })),
    tong,
    trang: loc.trang,
    moiTrang: loc.moiTrang,
  };
}

/** Chi tiết: kèm tồn kho SUY RA từ movements và lịch sử di chuyển gần nhất. */
export async function xemMot(nguoiDung: NguoiDungDaXacThuc, id: string) {
  const thietBi = await prisma.asset.findFirst({
    where: { AND: [{ id }, await dieuKienTaiSan(nguoiDung)] },
    select: CHON_DONG,
  });
  if (!thietBi) throw loi404('Không tìm thấy thiết bị, hoặc thiết bị không thuộc phạm vi của bạn.');

  /*
   * Tài khoản trường: chỉ số tồn và lịch sử TẠI TRƯỜNG MÌNH. Một mã hàng lẻ dùng
   * chung cho nhiều trường — mở ra mà thấy tồn kho LtL, tồn của trường khác và
   * mọi lượt chuyển giữa các nơi khác là lộ dữ liệu ngoài phạm vi.
   */
  const diaDiemXem = phamViCua(nguoiDung).diaDiem;
  const [ton, lichSu, tenDiaDiem] = await Promise.all([
    tonCuaTaiSan(thietBi.id),
    prisma.movement.findMany({
      where: {
        assetId: thietBi.id,
        ...(diaDiemXem
          ? {
              OR: [
                { fromLocationId: { in: [...diaDiemXem] } },
                { toLocationId: { in: [...diaDiemXem] } },
              ],
            }
          : {}),
      },
      orderBy: { performedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        quantity: true,
        conditionBefore: true,
        conditionAfter: true,
        performedAt: true,
        // Tên người ở kho tự khai lúc xuất/nhập — với loại không quét mã thì đây
        // là bản ghi bằng chữ duy nhất của thứ đã mang ra, phải hiện ra mới đối
        // chiếu được với ảnh khi nhập lại.
        declaredName: true,
        note: true,
        fromLocation: { select: { id: true, name: true } },
        toLocation: { select: { id: true, name: true } },
        performedBy: { select: { id: true, fullName: true } },
        request: { select: { id: true, code: true, type: true } },
      },
    }),
    prisma.location.findMany({ select: { id: true, name: true } }),
  ]);

  const ten = new Map(tenDiaDiem.map((d) => [d.id, d.name]));
  const tonXemDuoc = diaDiemXem
    ? ton.theoDiaDiem.filter((d) => diaDiemXem.includes(d.locationId))
    : ton.theoDiaDiem;
  return {
    thietBi: anNgoaiTruong(donDong(thietBi), diaDiemXem),
    tonKho: {
      tongTon: diaDiemXem ? tonXemDuoc.reduce((t, d) => t + d.ton, 0) : ton.tongTon,
      theoDiaDiem: tonXemDuoc.map((d) => ({
        locationId: d.locationId,
        tenDiaDiem: ten.get(d.locationId) ?? '(đã xoá)',
        ton: d.ton,
      })),
    },
    lichSu,
  };
}

/** Tra cứu theo MÃ — dùng cho quét QR tại kho. */
export async function timTheoMa(nguoiDung: NguoiDungDaXacThuc, code: string) {
  const chuanHoa = code.trim().toUpperCase();
  const thietBi = await prisma.asset.findFirst({
    where: { AND: [{ code: chuanHoa }, await dieuKienTaiSan(nguoiDung)] },
    select: { id: true },
  });
  if (!thietBi) {
    throw loi404(
      `Không tìm thấy thiết bị có mã ${chuanHoa}, hoặc thiết bị không thuộc phạm vi của bạn.`,
    );
  }
  return xemMot(nguoiDung, thietBi.id);
}

/**
 * Tra cứu RÚT GỌN theo mã — mọi vai trò đã đăng nhập đều gọi được.
 *
 * Vì sao không dùng phạm vi như `timTheoMa`: người lập phiếu phải nhập được mã
 * thiết bị đang nằm ở nơi khác, và trường cập nhật onsite phải báo được "thấy
 * thiết bị này tại trường nhưng sổ ghi ở nơi khác". Endpoint này chỉ trả đủ
 * thông tin để nhận ra mã (tên, loại, tình trạng) — KHÔNG trả giá trị, tồn kho
 * hay lịch sử, và KHÔNG cho duyệt danh sách: phải gõ đúng cả mã.
 *
 * Tài khoản TRƯỜNG chỉ xem được thiết bị của trường mình: mã ngoài trường vẫn
 * nhận ra được (để báo thấy tại trường), nhưng KHÔNG cho biết đang ghi ở đâu.
 */
export async function traCuuNhanh(nguoiDung: NguoiDungDaXacThuc, code: string) {
  const chuanHoa = code.trim().toUpperCase();
  const thietBi = await prisma.asset.findFirst({
    // `deletedAt: null`: đây là đường người lập yêu cầu dùng để đưa một mã vào
    // phiếu. Tra ra được thiết bị đang nằm trong thùng rác thì họ sẽ xin xuất
    // một thứ đã không còn tồn tại trong mọi danh sách.
    where: { code: chuanHoa, deletedAt: null },
    select: {
      id: true,
      code: true,
      name: true,
      trackingType: true,
      condition: true,
      allocationStatus: true,
      isActive: true,
      category: { select: { name: true } },
      currentLocation: { select: { id: true, name: true } },
    },
  });
  if (!thietBi) throw loi404(`Không có thiết bị nào mang mã ${chuanHoa}.`);
  // Nơi đặt chỉ trả khi nằm trong phạm vi điểm của người hỏi — kể cả hàng lẻ
  // trường đang có: cột vị trí của mã dùng chung có thể trỏ sang nơi khác.
  return { ...thietBi, currentLocation: noiTrongPhamVi(nguoiDung, thietBi.currentLocation) };
}

/**
 * HÀNG LẺ: thiết bị quản lý THEO SỐ LƯỢNG, chọn bằng TÊN chứ không gõ mã.
 *
 * Sách lẻ, cờ, standee, ấn phẩm in… không dán mã lên từng cái được, nhưng vẫn
 * phải biết kho còn bao nhiêu để lấy ra bao nhiêu thì trả về bấy nhiêu. Chúng
 * KHÔNG phải một bảng riêng — vẫn là thiết bị `SO_LUONG` trong cùng sổ tồn kho,
 * chỉ khác ở chỗ người dùng không bao giờ phải nhìn thấy mã. Tách bảng riêng
 * nghĩa là hai hệ thống tồn kho song song, và sớm muộn hai con số sẽ lệch nhau.
 *
 * Trả kèm TỒN để người lập yêu cầu không xin nhiều hơn số đang có.
 */
/**
 * HÀNG LẺ (sách, cờ, standee, ấn phẩm in…) kèm TỒN THEO TỪNG ĐIỂM.
 *
 * Hai điều ở đây đã từng sai và phải giữ cho đúng:
 *
 *  1. KHÔNG lọc theo `current_location_id`. Một mã hàng lẻ nằm rải nhiều nơi
 *     cùng lúc; cột đó chỉ ghi được MỘT nơi, nên lấy 30 trong 100 là cả dòng
 *     nhảy sang nơi nhận và 70 cái còn trong kho biến mất khỏi danh sách. Nơi
 *     nào còn hàng phải suy từ `movements` (nguyên tắc bất biến #5).
 *
 *  2. Con số mặc định KHÔNG phải tổng toàn hệ thống. Chuyển 30 quyển từ kho về
 *     trường thì tổng toàn hệ thống vẫn là 100 — đúng số, nhưng người lập yêu
 *     cầu nhìn vào tưởng kho chưa bị trừ gì. Họ cần biết TỪNG ĐIỂM còn bao
 *     nhiêu, nên trả về cả bản tách theo điểm.
 */
export async function hangLe(
  nguoiDung: NguoiDungDaXacThuc,
  loc: { tuKhoa?: string | undefined; locationId?: string | undefined; moiTrang: number },
) {
  /*
   * PHẠM VI: Quản trị / Vận hành / Kho / Nhân sự thấy mọi hàng lẻ — ô này để
   * LẬP PHIẾU, người lập phải thấy hàng đang có ở kho thì mới xin được (trước
   * đây nhân sự chỉ thấy hàng mình giữ, mở form là "chưa có hàng lẻ nào" dù kho
   * đầy, rồi quay sang tạo mã mới cho thứ đã có).
   *
   * Tài khoản TRƯỜNG chỉ thấy hàng lẻ CỦA TRƯỜNG MÌNH (còn tồn tại trường hoặc
   * đang trên đường về trường) — trường chỉ nhận hàng do Quản trị / Vận hành /
   * Kho cấp về, không duyệt hàng trong kho. Số lượng cũng chỉ tính tại trường.
   */
  const pv = phamViCua(nguoiDung);
  if (loc.locationId && !diemTrongPhamVi(nguoiDung, loc.locationId)) {
    throw loi403('Bạn chỉ xem được hàng lẻ tại trường của mình.');
  }
  // Điểm dùng để tính "tồn tại điểm": điểm được hỏi, hoặc trường của tài khoản
  // trường (các vai trò khác không hỏi điểm thì tính ở các kho, như trước).
  const diemHoi = loc.locationId ?? (pv.diaDiem?.length === 1 ? pv.diaDiem[0] : undefined);
  const muc = await prisma.asset.findMany({
    where: {
      AND: [
        await dieuKienTaiSan(nguoiDung),
        { deletedAt: null, trackingType: 'SO_LUONG', isActive: true },
        ...(loc.tuKhoa
          ? [
              {
                OR: [
                  { name: { contains: loc.tuKhoa } },
                  { code: { contains: loc.tuKhoa } },
                ],
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
      category: { select: { id: true, name: true } },
      currentLocation: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
    // Lấy dư rồi mới cắt, vì bước lọc "còn tồn ở điểm đang hỏi" nằm sau truy vấn.
    take: loc.locationId ? loc.moiTrang * 4 : loc.moiTrang,
  });

  const ids = muc.map((m) => m.id);
  const [theoDiem, dangDi] = await Promise.all([tonNhomTheoDiem(ids), hangDangTrenDuong(ids)]);
  const thongTinDiem = await tenCacDiem(theoDiem);
  const tenDiem = new Map([...thongTinDiem].map(([id, d]) => [id, d.name]));
  const laKho = (id: string): boolean => {
    const loai = thongTinDiem.get(id)?.type;
    return loai === 'KHO_VAN_PHONG' || loai === 'KHO_SU_KIEN';
  };
  const xemDuoc = (id: string): boolean => !pv.diaDiem || pv.diaDiem.includes(id);

  const dayDu = muc.map((m) => {
    const cac = (theoDiem.get(m.id) ?? []).filter((d) => d.ton > 0 && xemDuoc(d.locationId));
    const di = dangDi.get(m.id) ?? [];
    const diTai = (id: string): number =>
      di.filter((x) => x.locationId === id).reduce((t, x) => t + x.soLuong, 0);
    const tongTon = cac.reduce((t, d) => t + d.ton, 0);
    /*
     * Không hỏi một điểm cụ thể thì "lấy được" chỉ tính ở các KHO. Trước đây
     * cộng cả hàng đang nằm ở trường / đối tác: kho 70 + trường 30 thì báo
     * "Lấy được 100", rồi lúc xuất máy chủ chặn vì kho chỉ có 70.
     */
    const cacKho = cac.filter((d) => laKho(d.locationId));
    const tonTaiDiem = diemHoi
      ? (cac.find((d) => d.locationId === diemHoi)?.ton ?? 0)
      : cacKho.reduce((t, d) => t + d.ton, 0);
    const diTaiDiem = diemHoi
      ? diTai(diemHoi)
      : cacKho.reduce((t, d) => t + diTai(d.locationId), 0);
    return {
      ...anNgoaiTruong(m, pv.diaDiem),
      /** Tổng còn trong toàn hệ thống (theo sổ movements). */
      tongTon,
      /** Tồn sổ sách tại điểm đang hỏi. */
      ton: tonTaiDiem,
      /** Đã mang ra khỏi điểm này nhưng bên nhận chưa xác nhận. */
      dangDi: diTaiDiem,
      /** Thật sự còn lấy được = tồn sổ sách − hàng đang trên đường. */
      khaDung: Math.max(0, tonTaiDiem - diTaiDiem),
      theoDiem: cac
        .map((d) => ({
          locationId: d.locationId,
          ten: tenDiem.get(d.locationId) ?? '—',
          ton: d.ton,
          dangDi: diTai(d.locationId),
          khaDung: Math.max(0, d.ton - diTai(d.locationId)),
        }))
        .sort((a, b) => b.ton - a.ton),
    };
  });

  // Hỏi theo một điểm cụ thể thì chỉ trả về mã điểm đó THẬT SỰ còn lấy được.
  const locTheoDiem = loc.locationId ? dayDu.filter((m) => m.khaDung > 0) : dayDu;
  return { muc: locTheoDiem.slice(0, loc.moiTrang), tong: locTheoDiem.length };
}

/** Tên của mọi điểm xuất hiện trong bản tách tồn — một truy vấn cho cả danh sách. */
async function tenCacDiem(
  theoDiem: Map<string, Array<{ locationId: string; ton: number }>>,
): Promise<Map<string, { name: string; type: string }>> {
  const ids = [...new Set([...theoDiem.values()].flat().map((d) => d.locationId))];
  if (ids.length === 0) return new Map();
  const diem = await prisma.location.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, type: true },
  });
  return new Map(diem.map((d) => [d.id, { name: d.name, type: d.type }]));
}

export async function tao(
  duLieu: DuLieuTaoThietBi,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<ReturnType<typeof donDong>> {
  const [daCo, loai, diem, nguonGoc, mucDich] = await Promise.all([
    // Gõ tay mã thì phải dò trùng; để server sinh thì bước dò nằm trong vòng
    // thử lại ở dưới, dò ở đây chỉ tốn một truy vấn thừa.
    duLieu.code
      ? prisma.asset.findUnique({
          where: { code: duLieu.code },
          select: { id: true, deletedAt: true },
        })
      : Promise.resolve(null),
    prisma.assetCategory.findUnique({ where: { id: duLieu.categoryId }, select: { id: true } }),
    // `deletedAt: null`: không nhập thiết bị mới về một điểm đã nằm trong thùng rác.
    prisma.location.findFirst({
      where: { id: duLieu.nhapVeLocationId, deletedAt: null },
      select: { id: true },
    }),
    prisma.assetOrigin.findUnique({ where: { id: duLieu.originId }, select: { id: true } }),
    prisma.assetPurpose.findUnique({ where: { id: duLieu.purposeId }, select: { id: true } }),
  ]);
  // Thiết bị ở THÙNG RÁC vẫn giữ mã của nó trong khoá duy nhất, nên báo trùng mà
  // người dùng tìm khắp danh sách không thấy đâu. Nói rõ nó ở đâu và làm gì tiếp.
  if (daCo?.deletedAt) {
    throw loi409(
      `Mã ${duLieu.code} đang thuộc một thiết bị trong THÙNG RÁC. Vào Thiết bị → Thùng rác để khôi phục, hoặc xoá vĩnh viễn rồi mới tạo lại mã này.`,
      { truong: 'code', maLoi: 'MA_O_THUNG_RAC', thietBiId: daCo.id },
    );
  }
  if (daCo) throw loi409(`Mã thiết bị ${duLieu.code} đã tồn tại.`, { truong: 'code' });
  if (!loai) throw loi400('Loại tài sản không tồn tại.', 'LOAI_KHONG_TON_TAI');

  if (!diem) throw loi400('Điểm nhập về không tồn tại hoặc đã bị xoá.', 'DIEM_KHONG_TON_TAI');
  // Kiểm tường minh thay vì để khoá ngoại tự đổ: lỗi khoá ngoại của Prisma là
  // một dòng tiếng Anh về ràng buộc, người dùng đọc không hiểu mình sai ô nào.
  // Hay gặp nhất là nguồn gốc vừa bị ADMIN xoá trong lúc form đang mở.
  if (!nguonGoc) throw loi400('Nguồn gốc không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'NGUON_GOC_KHONG_TON_TAI');
  if (!mucDich) throw loi400('Mục đích sử dụng không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'MUC_DICH_KHONG_TON_TAI');

  if (duLieu.productLineId) {
    const dong = await prisma.productLine.findUnique({
      where: { id: duLieu.productLineId },
      select: { id: true },
    });
    if (!dong) throw loi400('Dòng giải pháp không tồn tại.', 'DONG_KHONG_TON_TAI');
  }

  const ngayNhap = duLieu.receivedDate ? doiNgay(duLieu.receivedDate) : new Date();

  // Tiền tố của tổ hợp nguồn gốc – loại – dòng: cần cho cả cấp mã tự sinh lẫn
  // đẩy bộ đếm khi mã gõ tay nằm trong dãy tự sinh.
  const tienTo = await tienToTheoId(
    duLieu.originId,
    duLieu.categoryId,
    duLieu.productLineId || null,
  );

  /**
   * CẤP MÃ TRONG CÙNG TRANSACTION GHI.
   *
   * Trước đây mã được đọc NGOÀI transaction rồi mới ghi, nên hai người lưu cùng
   * lúc đọc ra cùng một số; lại thêm cách lấy số lớn nhất theo thứ tự chữ làm dãy
   * kẹt ở 0001. Giờ bộ đếm khoá dòng cấp số ngay trong transaction ghi thiết bị —
   * xem `capMaThietBi`. Vẫn thử lại khi va khoá (P2002 hiếm gặp, P2034 deadlock)
   * vì khoá duy nhất trên `assets.code` là chốt cuối cùng.
   */
  // Tạo sẵn dòng bộ đếm NGOÀI transaction — xem `damBaoBoDem`.
  if (!duLieu.code && tienTo) await chuanBiBoDemMa(tienTo);
  for (let lan = 0; lan < 3; lan += 1) {
    try {
      return await ghiThietBi();
    } catch (e) {
      const thuLai =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2034' || (e.code === 'P2002' && !duLieu.code)) &&
        lan < 2;
      if (!thuLai) throw e;
    }
  }
  throw loi409('Không cấp được mã thiết bị. Hãy thử lại.', { maLoi: 'MA_TRUNG_LIEN_TUC' });

  async function ghiThietBi(): Promise<ReturnType<typeof donDong>> {
  return prisma.$transaction(async (tx) => {
    let ma = duLieu.code;
    if (!ma) {
      if (!tienTo) throw loi400('Không sinh được mã thiết bị.', 'KHONG_SINH_DUOC_MA');
      ma = await capMaThietBi(tx, tienTo);
    } else if (tienTo) {
      await dayBoDemQuaMa(tx, tienTo, ma);
    }
    const thietBi = await tx.asset.create({
      data: {
        code: ma,
        name: duLieu.name,
        categoryId: duLieu.categoryId,
        productLineId: duLieu.productLineId || null,
        serialNumber: duLieu.serialNumber || null,
        originId: duLieu.originId,
        originNote: duLieu.originNote || null,
        receivedDate: ngayNhap,
        value: duLieu.value ?? null,
        purposeId: duLieu.purposeId,
        trackingType: duLieu.trackingType,
        condition: duLieu.condition,
        // Thiết bị mới luôn bắt đầu ở nơi nhận hàng, trạng thái Tại kho.
        currentLocationId: duLieu.nhapVeLocationId,
        allocationStatus: 'TAI_KHO',
        dueReturnAt: duLieu.dueReturnAt ? doiNgay(duLieu.dueReturnAt) : null,
        note: duLieu.note || null,
        createdById: actor.id,
      },
      select: CHON_DONG,
    });

    // Gốc của tồn kho: từ ngoài hệ thống → điểm nhận hàng. Số lượng 0 (chỉ có ở
    // tạo nhanh hàng lẻ cho phiếu nhập kho) thì chưa có gì vào kho: phiếu nhập
    // sẽ ghi lượt nhập thật, ghi thêm một dòng 0 ở đây chỉ làm rối lịch sử.
    if (duLieu.soLuongNhap > 0) await tx.movement.create({
      data: {
        assetId: thietBi.id,
        type: 'NHAP_BAN_DAU',
        fromLocationId: null,
        toLocationId: duLieu.nhapVeLocationId,
        quantity: duLieu.soLuongNhap,
        conditionAfter: duLieu.condition,
        performedById: actor.id,
        performedAt: ngayNhap,
        note: 'Nhập ban đầu khi tạo thiết bị.',
      },
    });

    await ghiAudit(
      {
        actor,
        action: 'asset.create',
        entityType: 'asset',
        entityId: thietBi.id,
        afterValue: {
          code: thietBi.code,
          name: thietBi.name,
          trackingType: thietBi.trackingType,
          soLuongNhap: duLieu.soLuongNhap,
          nhapVeLocationId: duLieu.nhapVeLocationId,
        },
        ...ctx,
      },
      tx,
    );

    return donDong(thietBi);
  // Nhiều người cùng lưu một tiền tố thì xếp hàng trên dòng bộ đếm — cho
  // transaction đủ thời gian chờ lượt thay vì hỏng sau 5 giây mặc định.
  }, { maxWait: 10_000, timeout: 20_000 });
  }
}

export async function sua(
  id: string,
  duLieu: DuLieuSuaThietBi,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<ReturnType<typeof donDong>> {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: { ...CHON_DONG, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');
  // Sửa thiết bị đang nằm trong thùng rác là sửa một thứ không hiện ở đâu cả —
  // lưu xong người dùng không có cách nào nhìn thấy kết quả.
  if (truoc.deletedAt) {
    throw loi409(
      'Thiết bị này đang nằm trong THÙNG RÁC nên không sửa được. Hãy khôi phục ở Thiết bị → Thùng rác rồi sửa.',
    );
  }

  if (duLieu.categoryId) {
    const loai = await prisma.assetCategory.findUnique({
      where: { id: duLieu.categoryId },
      select: { id: true },
    });
    if (!loai) throw loi400('Loại tài sản không tồn tại.', 'LOAI_KHONG_TON_TAI');
  }
  if (duLieu.productLineId) {
    const dong = await prisma.productLine.findUnique({
      where: { id: duLieu.productLineId },
      select: { id: true },
    });
    if (!dong) throw loi400('Dòng giải pháp không tồn tại.', 'DONG_KHONG_TON_TAI');
  }
  if (duLieu.originId) {
    const ng = await prisma.assetOrigin.findUnique({
      where: { id: duLieu.originId },
      select: { id: true },
    });
    if (!ng) throw loi400('Nguồn gốc không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'NGUON_GOC_KHONG_TON_TAI');
  }
  if (duLieu.purposeId) {
    const md = await prisma.assetPurpose.findUnique({
      where: { id: duLieu.purposeId },
      select: { id: true },
    });
    if (!md) throw loi400('Mục đích sử dụng không tồn tại (có thể vừa bị xoá). Hãy tải lại trang và chọn lại.', 'MUC_DICH_KHONG_TON_TAI');
  }

  const sau = await prisma.asset.update({
    where: { id },
    data: {
      ...(duLieu.name === undefined ? {} : { name: duLieu.name }),
      ...(duLieu.categoryId === undefined ? {} : { categoryId: duLieu.categoryId }),
      ...(duLieu.productLineId === undefined ? {} : { productLineId: duLieu.productLineId || null }),
      ...(duLieu.serialNumber === undefined ? {} : { serialNumber: duLieu.serialNumber || null }),
      ...(duLieu.originId === undefined ? {} : { originId: duLieu.originId }),
      ...(duLieu.originNote === undefined ? {} : { originNote: duLieu.originNote || null }),
      ...(duLieu.receivedDate === undefined
        ? {}
        : { receivedDate: duLieu.receivedDate ? doiNgay(duLieu.receivedDate) : null }),
      ...(duLieu.value === undefined ? {} : { value: duLieu.value }),
      ...(duLieu.purposeId === undefined ? {} : { purposeId: duLieu.purposeId }),
      ...(duLieu.dueReturnAt === undefined
        ? {}
        : { dueReturnAt: duLieu.dueReturnAt ? doiNgay(duLieu.dueReturnAt) : null }),
      ...(duLieu.note === undefined ? {} : { note: duLieu.note || null }),
      ...(duLieu.isActive === undefined ? {} : { isActive: duLieu.isActive }),
    },
    select: CHON_DONG,
  });

  await ghiAudit({
    actor,
    action: 'asset.update',
    entityType: 'asset',
    entityId: id,
    beforeValue: {
      name: truoc.name,
      categoryId: truoc.category.id,
      productLineId: truoc.productLine?.id ?? null,
      serialNumber: truoc.serialNumber,
      origin: truoc.origin.code,
      value: truoc.value === null ? null : Number(truoc.value),
      purpose: truoc.purpose.code,
      isActive: truoc.isActive,
    },
    afterValue: {
      name: sau.name,
      categoryId: sau.category.id,
      productLineId: sau.productLine?.id ?? null,
      serialNumber: sau.serialNumber,
      origin: sau.origin.code,
      value: sau.value === null ? null : Number(sau.value),
      purpose: sau.purpose.code,
      isActive: sau.isActive,
    },
    ...ctx,
  });

  return donDong(sau);
}

/**
 * XOÁ MỀM một thiết bị — LUÔN cho xoá, ở bất kỳ tình trạng và trạng thái phân bổ nào.
 *
 * Trước đây hàm này xoá hẳn và chặn khi thiết bị đã phát sinh nghiệp vụ, nên
 * thiết bị đang cho mượn hay đã phân bổ về trường thì không xoá được — nhập sai
 * một mã là mắc luôn ở đó. Giờ đổi thành xoá mềm:
 *
 *   - bản ghi thiết bị, nhật ký di chuyển, ảnh, chứng từ đều GIỮ NGUYÊN;
 *   - thiết bị biến khỏi mọi danh sách, mọi báo cáo, và không còn tính vào tồn
 *     kho (phép lọc nằm ở `dieuKienTaiSan` và ở `lib/ton-kho.ts`);
 *   - khôi phục lại được nguyên trạng nếu xoá nhầm.
 *
 * Đánh đổi phải biết: MÃ thiết bị vẫn bị giữ trong khoá duy nhất khi còn ở thùng
 * rác, nên tạo lại đúng mã đó sẽ báo trùng — `tao()` nói rõ mã đang ở thùng rác
 * để người dùng chọn khôi phục hay xoá vĩnh viễn.
 */
export async function xoa(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      deletedAt: true,
      allocationStatus: true,
      condition: true,
    },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');
  if (truoc.deletedAt) throw loi409('Thiết bị này đã ở trong thùng rác.');

  // Đếm nghiệp vụ KHÔNG để chặn nữa, chỉ để ghi vào nhật ký: sau này xem lại
  // biết lúc xoá thiết bị đang dính những gì.
  const [soMovement, yeuCau, bbbg, kiemKe] = await Promise.all([
    prisma.movement.count({ where: { assetId: id, type: { not: 'NHAP_BAN_DAU' } } }),
    prisma.requestItem.count({ where: { assetId: id } }),
    prisma.handoverNoteItem.count({ where: { assetId: id } }),
    prisma.inventoryCountItem.count({ where: { assetId: id } }),
  ]);

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'asset.soft_delete',
        entityType: 'asset',
        entityId: id,
        beforeValue: {
          code: truoc.code,
          name: truoc.name,
          allocationStatus: truoc.allocationStatus,
          condition: truoc.condition,
          nghiepVu: { diChuyen: soMovement, yeuCau, bienBan: bbbg, kiemKe },
        },
        note: 'Chuyển vào thùng rác — khôi phục được.',
        ...ctx,
      },
      tx,
    );
    await tx.asset.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
  });
}

/** Danh sách thiết bị trong THÙNG RÁC, mới xoá lên trước. */
export async function thungRac(gioiHan = 200) {
  const muc = await prisma.asset.findMany({
    where: { deletedAt: { not: null } },
    select: {
      ...CHON_DONG,
      deletedAt: true,
      deletedBy: { select: { id: true, fullName: true } },
    },
    orderBy: { deletedAt: 'desc' },
    take: gioiHan,
  });
  return { muc: muc.map((t) => ({ ...donDong(t), deletedAt: t.deletedAt, deletedBy: t.deletedBy })), tong: muc.length };
}

/** Khôi phục một thiết bị từ thùng rác về đúng nguyên trạng trước khi xoá. */
export async function khoiPhuc(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi) {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');
  const lucXoa = truoc.deletedAt;
  if (!lucXoa) throw loi409('Thiết bị này không ở trong thùng rác.');

  const sau = await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'asset.restore',
        entityType: 'asset',
        entityId: id,
        beforeValue: { code: truoc.code, deletedAt: lucXoa.toISOString() },
        note: 'Khôi phục từ thùng rác.',
        ...ctx,
      },
      tx,
    );
    return tx.asset.update({
      where: { id },
      data: { deletedAt: null, deletedById: null },
      select: CHON_DONG,
    });
  });
  return donDong(sau);
}

/**
 * XOÁ VĨNH VIỄN khỏi thùng rác — không khôi phục lại được.
 *
 * Cần có vì mã thiết bị là khoá duy nhất: thiết bị còn nằm ở thùng rác thì mã của
 * nó vẫn bị giữ, không tạo lại được đúng mã đó. Khi nạp bộ dữ liệu thật mà trùng
 * mã cũ thì phải dọn hẳn.
 *
 * Chỉ nhận thiết bị ĐÃ ở thùng rác — bắt buộc đi qua hai bước (xoá mềm rồi mới
 * xoá hẳn) để không có đường nào mất dữ liệu bằng một cú bấm.
 */
export async function xoaVinhVien(id: string, actor: NguoiThaoTac, ctx: BoiCanhGoi): Promise<void> {
  const truoc = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, deletedAt: true },
  });
  if (!truoc) throw loi404('Không tìm thấy thiết bị.');
  if (!truoc.deletedAt) {
    throw loi409(
      'Chỉ xoá vĩnh viễn được thiết bị đang ở thùng rác. Hãy xoá thiết bị trước, rồi vào thùng rác xoá hẳn.',
    );
  }

  // Lấy đường dẫn ảnh TRƯỚC khi xoá: sau đó bản ghi ảnh đã cascade mất, không
  // còn chỗ nào tìm lại file trên đĩa.
  const anhCanDonDia = await prisma.photo.findMany({
    where: { assetId: id },
    select: { filePath: true },
  });

  await prisma.$transaction(async (tx) => {
    await ghiAudit(
      {
        actor,
        action: 'asset.hard_delete',
        entityType: 'asset',
        entityId: id,
        beforeValue: { code: truoc.code, name: truoc.name },
        note: 'Xoá vĩnh viễn khỏi thùng rác — không khôi phục được.',
        ...ctx,
      },
      tx,
    );
    // Các bảng dưới đây khai khoá ngoài RESTRICT nên phải xoá tay theo thứ tự,
    // không cascade được như ảnh.
    await tx.inventoryCountItem.deleteMany({ where: { assetId: id } });
    await tx.handoverNoteItem.deleteMany({ where: { assetId: id } });
    await tx.requestItem.deleteMany({ where: { assetId: id } });
    await tx.movement.deleteMany({ where: { assetId: id } });
    await tx.asset.delete({ where: { id } });
  });

  for (const a of anhCanDonDia) await xoaFileAnh(a.filePath);
}

/** Một dòng bị bỏ qua trong thao tác hàng loạt, kèm lý do để hiện lại cho người dùng. */
export interface DongBoQua {
  id: string;
  ma: string | null;
  lyDo: string;
}

export interface KetQuaHangLoat {
  soThanhCong: number;
  boQua: DongBoQua[];
}

/**
 * Chạy một thao tác cho từng id, KHÔNG gộp vào một transaction.
 *
 * Cố ý để mỗi thiết bị là một giao dịch riêng: gộp cả lô thì một thiết bị lỗi là
 * cuốn theo 32 cái đã làm đúng, mà thao tác hàng loạt thì người dùng muốn "làm
 * được cái nào thì làm" rồi xem lại phần bỏ sót. Hàm trả về đúng danh sách bỏ
 * qua kèm lý do để giao diện hiện nguyên văn.
 */
async function chayTungCai(
  ids: readonly string[],
  viec: (id: string) => Promise<unknown>,
): Promise<KetQuaHangLoat> {
  const boQua: DongBoQua[] = [];
  let soThanhCong = 0;
  // Lấy mã trước để thông điệp lỗi gọi tên thiết bị chứ không phải id cuid.
  const ma = new Map(
    (
      await prisma.asset.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, code: true },
      })
    ).map((t) => [t.id, t.code]),
  );

  for (const id of ids) {
    try {
      await viec(id);
      soThanhCong += 1;
    } catch (loi) {
      boQua.push({
        id,
        ma: ma.get(id) ?? null,
        lyDo: loi instanceof Error ? loi.message : 'Lỗi không rõ.',
      });
    }
  }
  return { soThanhCong, boQua };
}

/** Xoá mềm NHIỀU thiết bị đã chọn. */
export async function xoaNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoat> {
  return chayTungCai(ids, (id) => xoa(id, actor, ctx));
}

/** Khôi phục NHIỀU thiết bị từ thùng rác. */
export async function khoiPhucNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoat> {
  return chayTungCai(ids, (id) => khoiPhuc(id, actor, ctx));
}

/** Xoá VĨNH VIỄN nhiều thiết bị khỏi thùng rác — không khôi phục lại được. */
export async function xoaVinhVienNhieu(
  ids: readonly string[],
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<KetQuaHangLoat> {
  return chayTungCai(ids, (id) => xoaVinhVien(id, actor, ctx));
}

/**
 * TẠO NHANH thiết bị khi lập yêu cầu mà mã chưa có trong kho.
 *
 * Dùng lại `tao()` ở trên thay vì viết đường ghi riêng: nhờ vậy vẫn sinh
 * movement NHAP_BAN_DAU, vẫn ghi nhật ký, vẫn qua đúng mọi ràng buộc — chỉ
 * khác ở chỗ MÃ do server sinh và các trường không hỏi thì lấy mặc định.
 *
 * Mã theo dạng LTL-TN-0001 (TN = "tạo nhanh"), đánh số theo mã lớn nhất đang
 * có cùng tiền tố. Đặt trong transaction cùng lệnh tạo để hai người bấm cùng
 * lúc không nhận cùng một số; nếu vẫn trùng (khoá UNIQUE bắt được) thì thử
 * lại tối đa 5 lần rồi mới báo lỗi.
 */
export async function taoNhanh(
  duLieu: DuLieuTaoNhanhThietBi,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<ReturnType<typeof donDong>> {
  const anh = await prisma.photo.findMany({
    where: { id: { in: duLieu.anhIds } },
    select: { id: true, kind: true, assetId: true },
  });
  if (anh.length !== duLieu.anhIds.length) {
    throw loi422('Có ảnh không tồn tại trong hệ thống.', 'ANH_KHONG_TON_TAI');
  }
  if (anh.some((a) => a.kind !== 'HIEN_TRANG')) {
    throw loi422('Ảnh phải được tải lên với loại "Ảnh hiện trạng".', 'ANH_SAI_LOAI');
  }
  if (anh.some((a) => a.assetId !== null)) {
    throw loi422('Có ảnh đã gắn vào thiết bị khác.', 'ANH_DA_DUNG');
  }

  const idKhac = await idNguonGocHoacDauTien('KHAC');
  const idMucDich = duLieu.purposeId ?? (await idMucDichHoacDauTien('XHH'));

  const ghiChu =
    'TẠO NHANH khi lập yêu cầu — cần bổ sung nguồn gốc, giá trị và serial sau.' +
    (duLieu.vendorCode ? ` Mã hãng: ${duLieu.vendorCode}.` : '') +
    (duLieu.note ? `\n${duLieu.note}` : '');

  const kieu = duLieu.trackingType ?? (duLieu.soLuongNhap > 1 ? 'SO_LUONG' : 'DON_VI');

  // HÀNG LẺ TRÙNG TÊN thì không tạo mã mới: cùng một thứ sách / cờ mà hai mã là
  // tồn kho bị chia đôi, không ai biết thật sự còn bao nhiêu. Chỉ chặn hàng lẻ —
  // robot cùng tên vẫn là từng con riêng, mỗi con một mã.
  if (kieu === 'SO_LUONG') {
    const trung = await prisma.asset.findFirst({
      where: { deletedAt: null, trackingType: 'SO_LUONG', name: duLieu.name.trim() },
      select: { id: true, code: true, name: true },
    });
    if (trung) {
      throw loi409(
        `Đã có hàng lẻ "${trung.name}" (mã ${trung.code}). Chọn nó trong danh sách hàng lẻ, hoặc lập phiếu nhập kho để cộng thêm số lượng.`,
        { maLoi: 'HANG_LE_DA_CO', thietBiId: trung.id, code: trung.code },
      );
    }
  }

  // Mã do `tao()` cấp trong cùng transaction ghi, theo đúng quy ước
  // {nguồn gốc}-{loại}-{số} (vd KHAC-AP-0001) như mọi thiết bị khác — trước đây
  // tạo nhanh dùng một dãy riêng LTL-TN-xxxx, tính số ngoài transaction.
  const thietBi = await tao(
    {
      name: duLieu.name,
      categoryId: duLieu.categoryId,
      originId: idKhac,
      purposeId: idMucDich,
      trackingType: kieu,
      condition: 'TOT',
      nhapVeLocationId: duLieu.nhapVeLocationId,
      soLuongNhap: duLieu.soLuongNhap,
      ...(duLieu.vendorCode ? { serialNumber: duLieu.vendorCode } : {}),
      note: ghiChu,
    } as DuLieuTaoThietBi,
    actor,
    ctx,
  );

  await prisma.photo.updateMany({
    where: { id: { in: duLieu.anhIds } },
    data: { assetId: thietBi.id },
  });

  // Thêm thiết bị mới là CỘNG tồn kho từ ngoài vào — không qua duyệt thì quản
  // trị phải được báo, như mọi lần xuất / nhập kho trực tiếp khác.
  if (actor.role !== 'ADMIN') {
    const noi = await prisma.location.findUnique({
      where: { id: duLieu.nhapVeLocationId },
      select: { name: true },
    });
    await prisma.alert.create({
      data: {
        type: 'XUAT_NHAP_TRUC_TIEP',
        severity: 'THAP',
        title: `${actor.email} vừa thêm thiết bị mới ${thietBi.code}`.slice(0, 191),
        message:
          duLieu.soLuongNhap > 0
            ? `${actor.email} thêm nhanh "${thietBi.name}" (${thietBi.code}) × ${duLieu.soLuongNhap} ` +
              `vào ${noi?.name ?? 'kho'} khi lập yêu cầu. Không qua bước duyệt.`
            : `${actor.email} thêm "${thietBi.name}" (${thietBi.code}) vào danh mục hàng lẻ khi lập ` +
              `phiếu nhập kho. Số lượng vào kho do phiếu nhập ghi.`,
        assetId: thietBi.id,
        entityType: 'asset',
        entityId: thietBi.id,
      },
    });
    phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
      id: thietBi.id,
      code: thietBi.code,
      thongDiep: `${actor.email} vừa thêm thiết bị mới ${thietBi.code}.`,
    });
  }
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: thietBi.id, code: thietBi.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  return thietBi;
}
