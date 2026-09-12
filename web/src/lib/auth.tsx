/**
 * Ngữ cảnh đăng nhập. Web chỉ LƯU token và hiển thị theo vai trò; mọi quyết
 * định về quyền đều do server ra (nguyên tắc bất biến #6).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { VaiTro } from '@ltl/taisan-shared';
import { datXuLyMatPhien, goiApi, kho, LoiApi } from '@/lib/api';
import type { ViTri } from '@/lib/vi-tri';

export interface NguoiDung {
  id: string;
  email: string;
  fullName: string;
  role: VaiTro;
  phone: string | null;
  department: string | null;
  locationId: string | null;
  tenDiaDiem: string | null;
  mustChangePassword: boolean;
}

interface PhanHoiDangNhap {
  ok: true;
  accessToken: string;
  refreshToken: string;
  nguoiDung: NguoiDung;
  dungMaVuotQuyen: boolean;
}

export interface ThamSoDangNhap {
  email: string;
  matKhau: string;
  viTri?: ViTri;
  maVuotQuyen?: string;
}

interface GiaTriAuth {
  nguoiDung: NguoiDung | null;
  dangTai: boolean;
  dangNhap: (thamSo: ThamSoDangNhap) => Promise<NguoiDung>;
  dangXuat: () => Promise<void>;
  /** Cập nhật hồ sơ trong bộ nhớ sau khi đổi mật khẩu / sửa thông tin. */
  capNhatHoSo: (moi: Partial<NguoiDung>) => void;
}

const NgữCảnh = createContext<GiaTriAuth | null>(null);

export function CungCapAuth({ children }: { children: ReactNode }) {
  const [nguoiDung, datNguoiDung] = useState<NguoiDung | null>(null);
  const [dangTai, datDangTai] = useState(true);

  // Khôi phục phiên khi tải lại trang.
  useEffect(() => {
    let conHieuLuc = true;
    async function khoiPhuc(): Promise<void> {
      if (!kho.docAccess() && !kho.docRefresh()) {
        if (conHieuLuc) datDangTai(false);
        return;
      }
      try {
        const kq = await goiApi<{ ok: true; nguoiDung: NguoiDung }>('/api/auth/toi');
        if (conHieuLuc) datNguoiDung(kq.nguoiDung);
      } catch {
        kho.xoa();
      } finally {
        if (conHieuLuc) datDangTai(false);
      }
    }
    void khoiPhuc();
    return () => {
      conHieuLuc = false;
    };
  }, []);

  // Khi API xác định phiên mất hẳn thì đưa về trạng thái chưa đăng nhập.
  useEffect(() => {
    datXuLyMatPhien(() => datNguoiDung(null));
    return () => datXuLyMatPhien(null);
  }, []);

  const dangNhap = useCallback(async (thamSo: ThamSoDangNhap): Promise<NguoiDung> => {
    const kq = await goiApi<PhanHoiDangNhap>('/api/auth/dang-nhap', {
      method: 'POST',
      congKhai: true,
      than: {
        email: thamSo.email,
        matKhau: thamSo.matKhau,
        ...(thamSo.viTri ? { viTri: thamSo.viTri } : {}),
        ...(thamSo.maVuotQuyen ? { maVuotQuyen: thamSo.maVuotQuyen } : {}),
      },
    });
    kho.luu(kq.accessToken, kq.refreshToken);
    datNguoiDung(kq.nguoiDung);
    return kq.nguoiDung;
  }, []);

  const dangXuat = useCallback(async (): Promise<void> => {
    const refreshToken = kho.docRefresh();
    try {
      await goiApi('/api/auth/dang-xuat', {
        method: 'POST',
        than: refreshToken ? { refreshToken } : {},
      });
    } catch (loi) {
      // Token đã hết hiệu lực thì coi như đã đăng xuất; lỗi khác cũng không nên
      // giữ người dùng lại ở trạng thái lửng lơ.
      if (!(loi instanceof LoiApi)) throw loi;
    } finally {
      kho.xoa();
      datNguoiDung(null);
    }
  }, []);

  const capNhatHoSo = useCallback((moi: Partial<NguoiDung>): void => {
    datNguoiDung((cu) => (cu ? { ...cu, ...moi } : cu));
  }, []);

  const giaTri = useMemo<GiaTriAuth>(
    () => ({ nguoiDung, dangTai, dangNhap, dangXuat, capNhatHoSo }),
    [nguoiDung, dangTai, dangNhap, dangXuat, capNhatHoSo],
  );

  return <NgữCảnh.Provider value={giaTri}>{children}</NgữCảnh.Provider>;
}

export function useAuth(): GiaTriAuth {
  const giaTri = useContext(NgữCảnh);
  if (!giaTri) throw new Error('useAuth phải nằm trong <CungCapAuth>.');
  return giaTri;
}

/** Vai trò được vào trang quản lý tài khoản (server vẫn kiểm lại). */
export const VAI_TRO_QUAN_LY: readonly VaiTro[] = ['ADMIN', 'VAN_HANH'];
