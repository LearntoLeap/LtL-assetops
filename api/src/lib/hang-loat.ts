/**
 * THAO TÁC HÀNG LOẠT — chạy một việc cho từng id, mỗi cái một giao dịch riêng.
 *
 * Cố ý KHÔNG gộp cả lô vào một transaction: gộp thì một dòng vướng là cuốn theo
 * 32 dòng đã làm đúng, mà khi chọn cả trang rồi bấm xoá, người dùng muốn "làm
 * được cái nào thì làm" rồi xem lại phần bỏ sót.
 *
 * Trả về `boQua` kèm MÃ và LÝ DO chứ không chỉ đếm số: lô 30 cái mà 2 cái vướng
 * thì phải nói rõ đúng 2 cái nào và vì sao, không thể báo "thất bại" rồi để
 * người dùng tự dò.
 *
 * Bản này nhận `layMa` từ bên ngoài nên dùng được cho mọi loại bản ghi — phiếu
 * yêu cầu, biên bản, thiết bị — thay vì mỗi chỗ chép lại một bản.
 */
export interface DongBoQuaChung {
  id: string;
  ma: string | null;
  lyDo: string;
}

export interface KetQuaHangLoatChung {
  soThanhCong: number;
  boQua: DongBoQuaChung[];
}

export async function chayTungCai(
  ids: readonly string[],
  /** Tra mã hiển thị của cả lô một lượt, để thông điệp lỗi gọi tên chứ không đọc id. */
  layMa: (ids: readonly string[]) => Promise<Map<string, string>>,
  viec: (id: string) => Promise<unknown>,
): Promise<KetQuaHangLoatChung> {
  const boQua: DongBoQuaChung[] = [];
  let soThanhCong = 0;
  const ma = ids.length > 0 ? await layMa(ids) : new Map<string, string>();

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
