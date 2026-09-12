/**
 * Lớp gọi API duy nhất của web. Địa chỉ lấy từ VITE_API_URL (xem web/.env.example).
 * Mọi lỗi đều quy về `LoiApi` để giao diện hiển thị thông báo tiếng Việt.
 */
const DIA_CHI_API: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(
  /\/+$/,
  '',
);

export class LoiApi extends Error {
  readonly maHttp: number;
  readonly maLoi: string;

  constructor(maHttp: number, thongDiep: string, maLoi = 'LOI_CHUNG') {
    super(thongDiep);
    this.name = 'LoiApi';
    this.maHttp = maHttp;
    this.maLoi = maLoi;
  }
}

interface ThanLoi {
  thongDiep?: string;
  maLoi?: string;
}

function laThanLoi(giaTri: unknown): giaTri is ThanLoi {
  return typeof giaTri === 'object' && giaTri !== null;
}

export async function goiApi<T>(duongDan: string, tuyChon: RequestInit = {}): Promise<T> {
  const dia = `${DIA_CHI_API}${duongDan.startsWith('/') ? duongDan : `/${duongDan}`}`;

  let phanHoi: Response;
  try {
    phanHoi = await fetch(dia, {
      ...tuyChon,
      headers: {
        Accept: 'application/json',
        ...(tuyChon.body ? { 'Content-Type': 'application/json' } : {}),
        ...tuyChon.headers,
      },
    });
  } catch {
    throw new LoiApi(0, `Không kết nối được tới API tại ${DIA_CHI_API}.`, 'KHONG_KET_NOI');
  }

  const kieu = phanHoi.headers.get('content-type') ?? '';
  const than: unknown = kieu.includes('application/json') ? await phanHoi.json() : null;

  if (!phanHoi.ok) {
    const thongDiep =
      (laThanLoi(than) && than.thongDiep) || `API trả về lỗi ${phanHoi.status}.`;
    const maLoi = (laThanLoi(than) && than.maLoi) || 'LOI_CHUNG';
    throw new LoiApi(phanHoi.status, thongDiep, maLoi);
  }

  return than as T;
}

export const diaChiApi = DIA_CHI_API;
