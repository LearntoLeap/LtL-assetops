/**
 * Lớp gọi API duy nhất của web. Địa chỉ lấy từ VITE_API_URL (xem web/.env.example).
 *
 * Tự động gắn access token và tự làm mới token khi gặp 401 — mỗi lần chỉ làm mới
 * MỘT lần, các request song song cùng chờ một promise để không tạo nhiều phiên.
 */
const DIA_CHI_API: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

const KHOA_ACCESS = 'ltl-taisan:access-token';
const KHOA_REFRESH = 'ltl-taisan:refresh-token';

export class LoiApi extends Error {
  readonly maHttp: number;
  readonly maLoi: string;
  readonly chiTiet: Record<string, unknown> | undefined;

  constructor(
    maHttp: number,
    thongDiep: string,
    maLoi = 'LOI_CHUNG',
    chiTiet?: Record<string, unknown>,
  ) {
    super(thongDiep);
    this.name = 'LoiApi';
    this.maHttp = maHttp;
    this.maLoi = maLoi;
    this.chiTiet = chiTiet;
  }
}

function docKho(khoa: string): string | null {
  try {
    return localStorage.getItem(khoa);
  } catch {
    return null;
  }
}

function ghiKho(khoa: string, giaTri: string | null): void {
  try {
    if (giaTri === null) localStorage.removeItem(khoa);
    else localStorage.setItem(khoa, giaTri);
  } catch {
    // Trình duyệt chặn localStorage — phiên chỉ tồn tại tới khi tải lại trang.
  }
}

export const kho = {
  docAccess: () => docKho(KHOA_ACCESS),
  docRefresh: () => docKho(KHOA_REFRESH),
  luu(accessToken: string, refreshToken: string): void {
    ghiKho(KHOA_ACCESS, accessToken);
    ghiKho(KHOA_REFRESH, refreshToken);
  },
  xoa(): void {
    ghiKho(KHOA_ACCESS, null);
    ghiKho(KHOA_REFRESH, null);
  },
};

/** Gọi khi phiên hết hiệu lực hẳn — AuthContext đăng ký để đưa về trang đăng nhập. */
let khiMatPhien: (() => void) | null = null;
export function datXuLyMatPhien(xuLy: (() => void) | null): void {
  khiMatPhien = xuLy;
}

interface ThanLoi {
  thongDiep?: string;
  maLoi?: string;
  chiTiet?: Record<string, unknown>;
}

function laThanLoi(giaTri: unknown): giaTri is ThanLoi {
  return typeof giaTri === 'object' && giaTri !== null;
}

export interface TuyChonGoi {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  than?: unknown;
  /** Không gắn token và không tự làm mới (dùng cho đăng nhập / làm mới). */
  congKhai?: boolean;
}

async function goiMot(duongDan: string, tuyChon: TuyChonGoi): Promise<Response> {
  const token = tuyChon.congKhai ? null : kho.docAccess();
  try {
    return await fetch(`${DIA_CHI_API}${duongDan.startsWith('/') ? duongDan : `/${duongDan}`}`, {
      method: tuyChon.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(tuyChon.than === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(tuyChon.than === undefined ? {} : { body: JSON.stringify(tuyChon.than) }),
    });
  } catch {
    throw new LoiApi(0, `Không kết nối được tới API tại ${DIA_CHI_API}.`, 'KHONG_KET_NOI');
  }
}

let dangLamMoi: Promise<boolean> | null = null;

async function lamMoiToken(): Promise<boolean> {
  const refreshToken = kho.docRefresh();
  if (!refreshToken) return false;

  const phanHoi = await goiMot('/api/auth/lam-moi', {
    method: 'POST',
    than: { refreshToken },
    congKhai: true,
  });
  if (!phanHoi.ok) return false;

  const than: unknown = await phanHoi.json();
  if (
    laThanLoi(than) &&
    typeof (than as { accessToken?: unknown }).accessToken === 'string' &&
    typeof (than as { refreshToken?: unknown }).refreshToken === 'string'
  ) {
    const t = than as { accessToken: string; refreshToken: string };
    kho.luu(t.accessToken, t.refreshToken);
    return true;
  }
  return false;
}

/** Chỉ làm mới một lần dù nhiều request cùng nhận 401. */
function lamMoiMotLan(): Promise<boolean> {
  dangLamMoi ??= lamMoiToken()
    .catch(() => false)
    .finally(() => {
      dangLamMoi = null;
    });
  return dangLamMoi;
}

async function docThan(phanHoi: Response): Promise<unknown> {
  const kieu = phanHoi.headers.get('content-type') ?? '';
  if (!kieu.includes('application/json')) return null;
  try {
    return await phanHoi.json();
  } catch {
    return null;
  }
}

function nemLoi(phanHoi: Response, than: unknown): never {
  const thongDiep =
    (laThanLoi(than) && than.thongDiep) || `API trả về lỗi ${phanHoi.status}.`;
  const maLoi = (laThanLoi(than) && than.maLoi) || 'LOI_CHUNG';
  const chiTiet = laThanLoi(than) ? than.chiTiet : undefined;
  throw new LoiApi(phanHoi.status, thongDiep, maLoi, chiTiet);
}

export async function goiApi<T>(duongDan: string, tuyChon: TuyChonGoi = {}): Promise<T> {
  let phanHoi = await goiMot(duongDan, tuyChon);

  // 401 nghĩa là access token hết hạn — thử làm mới đúng một lần rồi gọi lại.
  if (phanHoi.status === 401 && !tuyChon.congKhai && kho.docRefresh()) {
    if (await lamMoiMotLan()) {
      phanHoi = await goiMot(duongDan, tuyChon);
    } else {
      kho.xoa();
      khiMatPhien?.();
    }
  }

  const than = await docThan(phanHoi);
  if (!phanHoi.ok) nemLoi(phanHoi, than);
  return than as T;
}

export const diaChiApi = DIA_CHI_API;
