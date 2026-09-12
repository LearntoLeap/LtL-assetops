/**
 * Chặn dò mật khẩu bằng bộ đếm trong bộ nhớ tiến trình.
 *
 * Cố ý KHÔNG thêm thư viện: pm2 chạy `exec_mode: 'fork'` với `instances: 1`
 * (xem api/ecosystem.config.cjs) nên chỉ có một tiến trình, bộ đếm trong bộ nhớ
 * là đủ. Nếu sau này chạy nhiều tiến trình thì phải chuyển sang Redis.
 */
export interface CauHinhGioiHan {
  /** Số lần cho phép trong một cửa sổ. */
  soLan: number;
  /** Độ dài cửa sổ (ms). */
  cuaSoMs: number;
}

interface Muc {
  dem: number;
  hetHanLuc: number;
}

export class GioiHanLan {
  private readonly bang = new Map<string, Muc>();
  private readonly cauHinh: CauHinhGioiHan;
  private donDepLanCuoi = 0;

  constructor(cauHinh: CauHinhGioiHan) {
    this.cauHinh = cauHinh;
  }

  /**
   * Tăng bộ đếm cho khoá. Trả về số giây phải chờ nếu đã vượt hạn mức,
   * hoặc null nếu còn được phép.
   */
  ghiNhan(khoa: string, bayGio = Date.now()): number | null {
    this.donDep(bayGio);
    const muc = this.bang.get(khoa);

    if (!muc || muc.hetHanLuc <= bayGio) {
      this.bang.set(khoa, { dem: 1, hetHanLuc: bayGio + this.cauHinh.cuaSoMs });
      return null;
    }

    muc.dem += 1;
    if (muc.dem > this.cauHinh.soLan) {
      return Math.max(1, Math.ceil((muc.hetHanLuc - bayGio) / 1000));
    }
    return null;
  }

  /** Xoá bộ đếm — gọi khi đăng nhập thành công. */
  xoa(khoa: string): void {
    this.bang.delete(khoa);
  }

  /** Dọn các mục đã hết hạn, nhiều nhất mỗi phút một lần. */
  private donDep(bayGio: number): void {
    if (bayGio - this.donDepLanCuoi < 60_000) return;
    this.donDepLanCuoi = bayGio;
    for (const [khoa, muc] of this.bang) {
      if (muc.hetHanLuc <= bayGio) this.bang.delete(khoa);
    }
  }
}

/** 10 lần đăng nhập sai trong 15 phút cho mỗi cặp (email, IP). */
export const gioiHanDangNhap = new GioiHanLan({ soLan: 10, cuaSoMs: 15 * 60_000 });
