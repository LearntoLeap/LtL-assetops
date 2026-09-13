/**
 * Kết nối Socket.IO và nghe sự kiện đồng bộ.
 *
 * Server chỉ phát TÍN HIỆU (id, mã, trạng thái) chứ không phát dữ liệu nghiệp
 * vụ, nên khi nhận tín hiệu thì màn hình gọi lại API để lấy dữ liệu ĐÃ LỌC theo
 * phạm vi của mình. Nhờ vậy realtime không trở thành lỗ hổng rò dữ liệu.
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { kho } from '@/lib/api';

const DIA_CHI_API: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

export const SU_KIEN = {
  YEU_CAU_MOI: 'yeu-cau:moi',
  YEU_CAU_DOI: 'yeu-cau:doi-trang-thai',
  KHO_DOI: 'kho:thay-doi',
  CANH_BAO_MOI: 'canh-bao:moi',
} as const;

export interface ThongTinSuKien {
  id?: string;
  code?: string;
  type?: string;
  status?: string;
  thongDiep?: string;
}

let socketChung: Socket | null = null;
let soNguoiDung = 0;

function laySocket(): Socket | null {
  const token = kho.docAccess();
  if (!token) return null;
  socketChung ??= io(DIA_CHI_API, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
  return socketChung;
}

export function dongSocket(): void {
  socketChung?.close();
  socketChung = null;
  soNguoiDung = 0;
}

/**
 * Nghe một danh sách sự kiện. `onSuKien` được gọi mỗi lần có tín hiệu —
 * thường là để tải lại danh sách đang hiển thị.
 */
export function useRealtime(
  suKien: readonly string[],
  onSuKien: (ten: string, duLieu: ThongTinSuKien) => void,
): { dangNoi: boolean } {
  const [dangNoi, datDangNoi] = useState(false);
  const xuLyRef = useRef(onSuKien);
  xuLyRef.current = onSuKien;

  // Chuỗi ổn định để không nối lại socket mỗi lần render.
  const khoaSuKien = suKien.join('|');

  useEffect(() => {
    const socket = laySocket();
    if (!socket) return;
    soNguoiDung += 1;

    const danhSach = khoaSuKien.split('|').filter(Boolean);
    const boXuLy = danhSach.map((ten) => {
      const xuLy = (duLieu: ThongTinSuKien): void => xuLyRef.current(ten, duLieu);
      socket.on(ten, xuLy);
      return { ten, xuLy };
    });

    const khiNoi = (): void => datDangNoi(true);
    const khiNgat = (): void => datDangNoi(false);
    socket.on('connect', khiNoi);
    socket.on('disconnect', khiNgat);
    datDangNoi(socket.connected);

    return () => {
      for (const { ten, xuLy } of boXuLy) socket.off(ten, xuLy);
      socket.off('connect', khiNoi);
      socket.off('disconnect', khiNgat);
      soNguoiDung -= 1;
      // Không còn màn hình nào nghe thì đóng hẳn, đỡ giữ kết nối thừa.
      if (soNguoiDung <= 0) dongSocket();
    };
  }, [khoaSuKien]);

  return { dangNoi };
}
