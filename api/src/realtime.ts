/**
 * Đồng bộ realtime bằng Socket.IO.
 *
 * Client phải gửi access token lúc bắt tay; server xác thực rồi xếp vào "phòng"
 * theo vai trò, nên sự kiện chỉ tới đúng người được phép thấy. Không phát dữ
 * liệu nhạy cảm qua socket — chỉ phát TÍN HIỆU để client gọi lại API và nhận
 * dữ liệu đã lọc theo phạm vi.
 */
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { UserRole } from '@prisma/client';
import { env } from './env.js';
import { prisma } from './prisma.js';
import { docAccessToken } from './lib/jwt.js';
import { log, moTaLoi } from './lib/ghi-log.js';

/** Tên sự kiện phát cho client. */
export const SU_KIEN = {
  YEU_CAU_MOI: 'yeu-cau:moi',
  YEU_CAU_DOI: 'yeu-cau:doi-trang-thai',
  KHO_DOI: 'kho:thay-doi',
  CANH_BAO_MOI: 'canh-bao:moi',
} as const;

export interface ThongTinSuKien {
  /** id bản ghi liên quan, để client biết có cần tải lại chi tiết đang mở không. */
  id?: string;
  code?: string;
  type?: string;
  status?: string;
  thongDiep?: string;
}

/** Phòng cho nhóm duyệt (ADMIN + VAN_HANH) — nơi nhận yêu cầu chờ duyệt. */
const PHONG_DUYET = 'vai-tro:duyet';
/** Phòng cho tài khoản kho — nơi nhận yêu cầu đã duyệt cần xuất. */
const PHONG_KHO = 'vai-tro:kho';

function phongCuaVaiTro(vaiTro: UserRole): string[] {
  const phong = [`vai-tro:${vaiTro}`];
  if (vaiTro === 'ADMIN' || vaiTro === 'VAN_HANH') phong.push(PHONG_DUYET);
  if (vaiTro === 'KHO') phong.push(PHONG_KHO);
  return phong;
}

let io: Server | null = null;

export function dungRealtime(server: HttpServer): Server {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigins, credentials: true },
    // Máy kiosk chạy liên tục, mạng kho hay chập chờn → cho thử lại lâu hơn.
    pingTimeout: 30_000,
    pingInterval: 25_000,
  });

  io.use((socket, tiep) => {
    void (async () => {
      try {
        const tho: unknown = socket.handshake.auth['token'];
        if (typeof tho !== 'string' || tho === '') {
          tiep(new Error('Thiếu token.'));
          return;
        }
        const noiDung = docAccessToken(tho);
        // Đọc lại từ CSDL: khoá tài khoản là mất kết nối ngay ở lần nối tiếp theo.
        const nguoiDung = await prisma.user.findUnique({
          where: { id: noiDung.sub },
          select: { id: true, role: true, isLocked: true, locationId: true },
        });
        if (!nguoiDung || nguoiDung.isLocked) {
          tiep(new Error('Tài khoản không hợp lệ.'));
          return;
        }
        socket.data.userId = nguoiDung.id;
        socket.data.role = nguoiDung.role;
        socket.data.locationId = nguoiDung.locationId;
        tiep();
      } catch (loi) {
        tiep(loi instanceof Error ? loi : new Error('Xác thực socket thất bại.'));
      }
    })();
  });

  io.on('connection', (socket: Socket) => {
    const vaiTro = socket.data.role as UserRole;
    const userId = socket.data.userId as string;
    void socket.join(phongCuaVaiTro(vaiTro));
    void socket.join(`nguoi-dung:${userId}`);
    const diaDiem = socket.data.locationId as string | null;
    if (diaDiem) void socket.join(`dia-diem:${diaDiem}`);

    log.debug('Socket đã nối', { userId, vaiTro });
    socket.on('disconnect', (ly) => {
      log.debug('Socket đã ngắt', { userId, ly });
    });
  });

  log.info('Socket.IO đã sẵn sàng', { duongDan: '/socket.io' });
  return io;
}

/** Phát sự kiện cho nhóm duyệt (ADMIN + VAN_HANH). */
export function phatChoNguoiDuyet(suKien: string, duLieu: ThongTinSuKien): void {
  io?.to(PHONG_DUYET).emit(suKien, duLieu);
}

/** Phát cho tài khoản kho. */
export function phatChoKho(suKien: string, duLieu: ThongTinSuKien): void {
  io?.to(PHONG_KHO).emit(suKien, duLieu);
}

/** Phát cho một người cụ thể (vd người tạo yêu cầu được duyệt). */
export function phatChoNguoiDung(userId: string, suKien: string, duLieu: ThongTinSuKien): void {
  io?.to(`nguoi-dung:${userId}`).emit(suKien, duLieu);
}

/** Phát cho tài khoản gắn với một điểm lưu trữ (vd trường nhận bàn giao). */
export function phatChoDiaDiem(locationId: string, suKien: string, duLieu: ThongTinSuKien): void {
  io?.to(`dia-diem:${locationId}`).emit(suKien, duLieu);
}

/** Phát cho mọi người đang kết nối — dùng cho số liệu tổng ở màn hình kiosk. */
export function phatChoTatCa(suKien: string, duLieu: ThongTinSuKien): void {
  io?.emit(suKien, duLieu);
}

export async function dongRealtime(): Promise<void> {
  if (!io) return;
  await new Promise<void>((xong) => {
    io?.close(() => xong());
  }).catch((loi: unknown) => {
    log.warn('Đóng Socket.IO không êm', moTaLoi(loi));
  });
  io = null;
}
