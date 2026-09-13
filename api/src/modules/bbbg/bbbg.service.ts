/**
 * BIÊN BẢN BÀN GIAO (BBBG) — luồng C.
 *
 * Điểm quan trọng nhất: **xác nhận biên bản mới là lúc thiết bị đổi vị trí sở
 * hữu**. Lúc xuất kho (giai đoạn 4), phân bổ/luân chuyển chỉ đánh dấu "Đang vận
 * chuyển" và CHƯA ghi movement. Đến khi bên nhận bấm xác nhận trên app, hàm
 * `xacNhan` mới ghi movement, đổi vị trí và đóng yêu cầu.
 *
 * Các dòng thiết bị trên biên bản lưu BẢN CHỤP (mã, tên, tình trạng) tại thời
 * điểm lập: biên bản là chứng từ, đổi tên thiết bị sau này không được làm thay
 * đổi nội dung đã ký.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { loi400, loi403, loi404, loi409, loi422 } from '../../lib/loi-http.js';
import { ghiAudit, type NguoiThaoTac } from '../../lib/audit.js';
import { capSoChungTu, TIEN_TO } from '../../lib/so-chung-tu.js';
import { phamViCua } from '../../lib/pham-vi.js';
import { phatChoDiaDiem, phatChoNguoiDuyet, phatChoNguoiDung, phatChoTatCa, SU_KIEN } from '../../realtime.js';
import type { NguoiDungDaXacThuc } from '../../types/express.js';
import type { BoiCanhGoi } from '../auth/auth.service.js';
import type { DuLieuLocBBBG, DuLieuSuaBBBG, DuLieuTaoBBBG } from './bbbg.schema.js';

const CHON_BBBG = {
  id: true,
  code: true,
  status: true,
  giverName: true,
  giverTitle: true,
  giverOrg: true,
  receiverOrg: true,
  receiverName: true,
  receiverTitle: true,
  receiverPhone: true,
  issuedDate: true,
  commitment: true,
  note: true,
  rejectionNote: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  confirmedBy: { select: { id: true, fullName: true } },
  receiverLocation: { select: { id: true, code: true, name: true, type: true } },
  request: { select: { id: true, code: true, type: true, status: true, reason: true } },
  items: {
    select: {
      id: true,
      assetCodeSnapshot: true,
      assetNameSnapshot: true,
      quantity: true,
      conditionSnapshot: true,
      note: true,
      sortOrder: true,
      asset: { select: { id: true, currentLocationId: true } },
    },
    orderBy: { sortOrder: 'asc' },
  },
} satisfies Prisma.HandoverNoteSelect;

export type BBBGDayDu = Prisma.HandoverNoteGetPayload<{ select: typeof CHON_BBBG }>;

/** Cam kết mặc định in trên biên bản — sửa được theo từng lần bàn giao. */
const CAM_KET_MAC_DINH =
  'Bên nhận đã kiểm tra số lượng và tình trạng thiết bị nêu trên, cam kết bảo quản, ' +
  'sử dụng đúng mục đích và chịu trách nhiệm bồi thường nếu làm hư hỏng, mất mát do lỗi chủ quan. ' +
  'Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.';

function doiNgay(iso: string): Date {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw loi400(`Ngày không hợp lệ: ${iso}`, 'NGAY_KHONG_HOP_LE');
  return d;
}

/** Điều kiện lọc theo phạm vi: điểm trường chỉ thấy biên bản gửi cho mình. */
function dieuKienPhamVi(nguoiDung: NguoiDungDaXacThuc): Prisma.HandoverNoteWhereInput {
  const pv = phamViCua(nguoiDung);
  if (pv.toanBoKho) return {};
  if (pv.diaDiem) {
    return {
      OR: [
        { receiverLocationId: { in: [...pv.diaDiem] } },
        { createdById: nguoiDung.id },
      ],
    };
  }
  return { createdById: nguoiDung.id };
}

export async function danhSach(
  nguoiDung: NguoiDungDaXacThuc,
  loc: DuLieuLocBBBG,
): Promise<{ muc: BBBGDayDu[]; tong: number; trang: number; moiTrang: number }> {
  const dieuKien: Prisma.HandoverNoteWhereInput = {
    ...dieuKienPhamVi(nguoiDung),
    ...(loc.status ? { status: loc.status } : {}),
    ...(loc.receiverLocationId ? { receiverLocationId: loc.receiverLocationId } : {}),
    ...(loc.tuKhoa
      ? {
          OR: [
            { code: { contains: loc.tuKhoa } },
            { receiverOrg: { contains: loc.tuKhoa } },
            { receiverName: { contains: loc.tuKhoa } },
            { items: { some: { assetCodeSnapshot: { contains: loc.tuKhoa } } } },
          ],
        }
      : {}),
  };

  const [muc, tong] = await Promise.all([
    prisma.handoverNote.findMany({
      where: dieuKien,
      select: CHON_BBBG,
      orderBy: { createdAt: 'desc' },
      skip: (loc.trang - 1) * loc.moiTrang,
      take: loc.moiTrang,
    }),
    prisma.handoverNote.count({ where: dieuKien }),
  ]);
  return { muc, tong, trang: loc.trang, moiTrang: loc.moiTrang };
}

export async function xemMot(nguoiDung: NguoiDungDaXacThuc, id: string): Promise<BBBGDayDu> {
  const bbbg = await prisma.handoverNote.findFirst({
    where: { id, ...dieuKienPhamVi(nguoiDung) },
    select: CHON_BBBG,
  });
  if (!bbbg) throw loi404('Không tìm thấy biên bản, hoặc biên bản ngoài phạm vi của bạn.');
  return bbbg;
}

/** Lập biên bản từ một yêu cầu — chụp lại mã/tên/tình trạng thiết bị lúc lập. */
export async function tao(
  duLieu: DuLieuTaoBBBG,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const yeuCau = await prisma.request.findUnique({
    where: { id: duLieu.requestId },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      toLocationId: true,
      toLocation: { select: { id: true, name: true } },
      items: {
        select: {
          quantity: true,
          note: true,
          asset: { select: { id: true, code: true, name: true, condition: true } },
        },
      },
    },
  });
  if (!yeuCau) throw loi404('Không tìm thấy yêu cầu để lập biên bản.');
  if (yeuCau.items.length === 0) throw loi422('Yêu cầu chưa có thiết bị nào.', 'YEU_CAU_RONG');

  // Biên bản chỉ có nghĩa khi hàng đã được xuất hoặc đã hoàn tất.
  if (yeuCau.status !== 'DA_XUAT' && yeuCau.status !== 'DA_HOAN_TAT') {
    throw loi422(
      `Yêu cầu đang ở trạng thái "${yeuCau.status}" — phải xuất kho xong mới lập được biên bản bàn giao.`,
      'CHUA_XUAT_KHO',
    );
  }

  const daCo = await prisma.handoverNote.findFirst({
    where: { requestId: yeuCau.id, status: { not: 'TU_CHOI' } },
    select: { id: true, code: true },
  });
  if (daCo) {
    throw loi409(`Yêu cầu này đã có biên bản ${daCo.code}.`, { bbbgId: daCo.id });
  }

  return prisma.$transaction(async (tx) => {
    const code = await capSoChungTu(tx, TIEN_TO.BBBG);
    const bbbg = await tx.handoverNote.create({
      data: {
        code,
        requestId: yeuCau.id,
        status: 'BAN_NHAP',
        giverName: duLieu.giverName,
        giverTitle: duLieu.giverTitle ?? null,
        giverOrg: duLieu.giverOrg,
        receiverLocationId: yeuCau.toLocationId,
        receiverOrg: duLieu.receiverOrg,
        receiverName: duLieu.receiverName,
        receiverTitle: duLieu.receiverTitle ?? null,
        receiverPhone: duLieu.receiverPhone ?? null,
        issuedDate: duLieu.issuedDate ? doiNgay(duLieu.issuedDate) : new Date(),
        commitment: duLieu.commitment ?? CAM_KET_MAC_DINH,
        note: duLieu.note ?? null,
        createdById: actor.id,
        items: {
          create: yeuCau.items.map((m, i) => ({
            assetId: m.asset.id,
            assetCodeSnapshot: m.asset.code,
            assetNameSnapshot: m.asset.name,
            quantity: m.quantity,
            conditionSnapshot: m.asset.condition,
            note: m.note,
            sortOrder: i,
          })),
        },
      },
      select: CHON_BBBG,
    });

    await ghiAudit(
      {
        actor,
        action: 'handover.create',
        entityType: 'handover_note',
        entityId: bbbg.id,
        afterValue: {
          code,
          requestCode: yeuCau.code,
          soDong: yeuCau.items.length,
          receiverOrg: duLieu.receiverOrg,
        },
        ...ctx,
      },
      tx,
    );
    return bbbg;
  });
}

export async function sua(
  id: string,
  duLieu: DuLieuSuaBBBG,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, createdById: true },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  // Biên bản đã gửi đi là chứng từ — không sửa nội dung nữa.
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409('Chỉ sửa được biên bản còn ở trạng thái Nháp.');
  }

  return prisma.$transaction(async (tx) => {
    for (const m of duLieu.muc ?? []) {
      await tx.handoverNoteItem.updateMany({
        where: { id: m.id, handoverNoteId: id },
        data: {
          ...(m.conditionSnapshot === undefined ? {} : { conditionSnapshot: m.conditionSnapshot }),
          ...(m.note === undefined ? {} : { note: m.note }),
        },
      });
    }

    const sau = await tx.handoverNote.update({
      where: { id },
      data: {
        ...(duLieu.giverName === undefined ? {} : { giverName: duLieu.giverName }),
        ...(duLieu.giverTitle === undefined ? {} : { giverTitle: duLieu.giverTitle }),
        ...(duLieu.giverOrg === undefined ? {} : { giverOrg: duLieu.giverOrg }),
        ...(duLieu.receiverOrg === undefined ? {} : { receiverOrg: duLieu.receiverOrg }),
        ...(duLieu.receiverName === undefined ? {} : { receiverName: duLieu.receiverName }),
        ...(duLieu.receiverTitle === undefined ? {} : { receiverTitle: duLieu.receiverTitle }),
        ...(duLieu.receiverPhone === undefined ? {} : { receiverPhone: duLieu.receiverPhone }),
        ...(duLieu.issuedDate === undefined ? {} : { issuedDate: doiNgay(duLieu.issuedDate) }),
        ...(duLieu.commitment === undefined ? {} : { commitment: duLieu.commitment }),
        ...(duLieu.note === undefined ? {} : { note: duLieu.note }),
      },
      select: CHON_BBBG,
    });

    await ghiAudit(
      {
        actor,
        action: 'handover.update',
        entityType: 'handover_note',
        entityId: id,
        afterValue: { code: truoc.code },
        ...ctx,
      },
      tx,
    );
    return sau;
  });
}

/** Gửi cho bên nhận xác nhận: Nháp → Chờ bên nhận xác nhận. */
export async function guiXacNhan(
  id: string,
  actor: NguoiThaoTac,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const truoc = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, receiverLocationId: true },
  });
  if (!truoc) throw loi404('Không tìm thấy biên bản.');
  if (truoc.status !== 'BAN_NHAP') {
    throw loi409('Chỉ gửi xác nhận được biên bản đang ở trạng thái Nháp.');
  }

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.handoverNote.update({
      where: { id },
      data: { status: 'CHO_XAC_NHAN' },
      select: CHON_BBBG,
    });
    await ghiAudit(
      {
        actor,
        action: 'handover.submit',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { status: 'BAN_NHAP' },
        afterValue: { status: 'CHO_XAC_NHAN' },
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  if (truoc.receiverLocationId) {
    phatChoDiaDiem(truoc.receiverLocationId, SU_KIEN.YEU_CAU_DOI, {
      id: sau.id,
      code: sau.code,
      status: sau.status,
      thongDiep: `Biên bản ${sau.code} đang chờ bạn xác nhận.`,
    });
  }
  return sau;
}

/**
 * BÊN NHẬN XÁC NHẬN — đây là lúc thiết bị thật sự đổi vị trí sở hữu (luồng C).
 *
 * Chỉ tài khoản thuộc đúng điểm nhận (hoặc ADMIN/VAN_HANH) mới xác nhận được.
 */
export async function xacNhan(
  id: string,
  ghiChu: string | undefined,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const bbbg = await prisma.handoverNote.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      status: true,
      receiverLocationId: true,
      requestId: true,
      request: { select: { id: true, code: true, type: true, status: true, expectedReturnAt: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          conditionSnapshot: true,
          assetCodeSnapshot: true,
          asset: { select: { id: true, currentLocationId: true, condition: true } },
        },
      },
    },
  });
  if (!bbbg) throw loi404('Không tìm thấy biên bản.');
  if (bbbg.status !== 'CHO_XAC_NHAN') {
    throw loi409(
      `Biên bản đang ở trạng thái khác "Chờ bên nhận xác nhận" nên không xác nhận được.`,
    );
  }

  const pv = phamViCua(nguoiDung);
  const dungBenNhan =
    pv.toanBoKho ||
    (bbbg.receiverLocationId !== null && nguoiDung.locationId === bbbg.receiverLocationId);
  if (!dungBenNhan) {
    throw loi403('Chỉ tài khoản của đơn vị nhận mới xác nhận được biên bản này.');
  }
  if (!bbbg.receiverLocationId) {
    throw loi422(
      'Biên bản chưa gắn điểm nhận trong danh mục nên không xác định được thiết bị chuyển về đâu.',
      'THIEU_DIEM_NHAN',
    );
  }

  const noiNhan = bbbg.receiverLocationId;
  const bayGio = new Date();
  const loaiChoXacNhan =
    bbbg.request?.type === 'PHAN_BO_VE_TRUONG' || bbbg.request?.type === 'LUAN_CHUYEN_TRUONG';

  const sau = await prisma.$transaction(async (tx) => {
    // Movement chỉ ghi cho loại "chờ xác nhận" — các loại khác đã ghi lúc xuất kho.
    if (loaiChoXacNhan) {
      for (const m of bbbg.items) {
        const movement = await tx.movement.create({
          data: {
            assetId: m.asset.id,
            type: bbbg.request?.type === 'LUAN_CHUYEN_TRUONG' ? 'LUAN_CHUYEN' : 'PHAN_BO',
            fromLocationId: m.asset.currentLocationId,
            toLocationId: noiNhan,
            requestId: bbbg.requestId,
            quantity: m.quantity,
            conditionBefore: m.asset.condition,
            conditionAfter: m.asset.condition,
            performedById: nguoiDung.id,
            performedAt: bayGio,
            note: `Bên nhận xác nhận biên bản ${bbbg.code}.`,
          },
          select: { id: true },
        });

        await tx.asset.update({
          where: { id: m.asset.id },
          data: {
            currentLocationId: noiNhan,
            allocationStatus: 'DA_PHAN_BO',
            ...(bbbg.request?.expectedReturnAt
              ? { dueReturnAt: bbbg.request.expectedReturnAt }
              : {}),
          },
        });

        await ghiAudit(
          {
            actor: nguoiDung,
            action: 'asset.xac_nhan_ban_giao',
            entityType: 'asset',
            entityId: m.asset.id,
            beforeValue: {
              currentLocationId: m.asset.currentLocationId,
              allocationStatus: 'DANG_VAN_CHUYEN',
            },
            afterValue: {
              currentLocationId: noiNhan,
              allocationStatus: 'DA_PHAN_BO',
              movementId: movement.id,
            },
            note: `Bên nhận xác nhận biên bản ${bbbg.code} — mã ${m.assetCodeSnapshot}.`,
            ...ctx,
          },
          tx,
        );
      }

      if (bbbg.requestId) {
        await tx.request.update({
          where: { id: bbbg.requestId },
          data: { status: 'DA_HOAN_TAT', completedAt: bayGio },
        });
      }
    }

    const capNhat = await tx.handoverNote.update({
      where: { id },
      data: {
        status: 'DA_XAC_NHAN',
        confirmedById: nguoiDung.id,
        confirmedAt: bayGio,
        ...(ghiChu ? { note: ghiChu } : {}),
      },
      select: CHON_BBBG,
    });

    await ghiAudit(
      {
        actor: nguoiDung,
        action: 'handover.confirm',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { status: 'CHO_XAC_NHAN' },
        afterValue: {
          status: 'DA_XAC_NHAN',
          soDong: bbbg.items.length,
          doiViTri: loaiChoXacNhan,
        },
        note: ghiChu ?? null,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  phatChoNguoiDuyet(SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Biên bản ${sau.code} đã được bên nhận xác nhận.`,
  });
  phatChoTatCa(SU_KIEN.KHO_DOI, { id: sau.id, code: sau.code, thongDiep: 'Tồn kho vừa thay đổi.' });
  return sau;
}

export async function tuChoi(
  id: string,
  rejectionNote: string,
  nguoiDung: NguoiDungDaXacThuc,
  ctx: BoiCanhGoi,
): Promise<BBBGDayDu> {
  const bbbg = await prisma.handoverNote.findUnique({
    where: { id },
    select: { id: true, code: true, status: true, receiverLocationId: true, createdById: true },
  });
  if (!bbbg) throw loi404('Không tìm thấy biên bản.');
  if (bbbg.status !== 'CHO_XAC_NHAN') {
    throw loi409('Chỉ từ chối được biên bản đang chờ xác nhận.');
  }
  const pv = phamViCua(nguoiDung);
  const dungBenNhan =
    pv.toanBoKho ||
    (bbbg.receiverLocationId !== null && nguoiDung.locationId === bbbg.receiverLocationId);
  if (!dungBenNhan) {
    throw loi403('Chỉ tài khoản của đơn vị nhận mới từ chối được biên bản này.');
  }

  const sau = await prisma.$transaction(async (tx) => {
    const capNhat = await tx.handoverNote.update({
      where: { id },
      data: { status: 'TU_CHOI', rejectionNote, confirmedById: nguoiDung.id, confirmedAt: new Date() },
      select: CHON_BBBG,
    });
    await tx.alert.create({
      data: {
        type: 'CHENH_LECH_KIEM_KE',
        severity: 'CAO',
        title: `Bên nhận từ chối biên bản ${capNhat.code}`,
        message: `${capNhat.receiverOrg} từ chối nhận: ${rejectionNote}`,
        entityType: 'handover_note',
        entityId: id,
      },
    });
    await ghiAudit(
      {
        actor: nguoiDung,
        action: 'handover.reject',
        entityType: 'handover_note',
        entityId: id,
        beforeValue: { status: 'CHO_XAC_NHAN' },
        afterValue: { status: 'TU_CHOI' },
        note: rejectionNote,
        ...ctx,
      },
      tx,
    );
    return capNhat;
  });

  phatChoNguoiDuyet(SU_KIEN.CANH_BAO_MOI, {
    id: sau.id,
    code: sau.code,
    thongDiep: `Biên bản ${sau.code} bị bên nhận từ chối.`,
  });
  phatChoNguoiDung(bbbg.createdById, SU_KIEN.YEU_CAU_DOI, {
    id: sau.id,
    code: sau.code,
    status: sau.status,
    thongDiep: `Biên bản ${sau.code} bị từ chối.`,
  });
  return sau;
}
