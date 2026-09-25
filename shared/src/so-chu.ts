/**
 * ĐỌC SỐ THÀNH CHỮ TIẾNG VIỆT — dùng cho chứng từ: "04 (bốn) bản",
 * "15 (mười lăm) thiết bị".
 *
 * Để ở gói dùng chung vì CẢ HAI phía đều cần: server dựng file Word, web dựng
 * bản in trên màn hình. Hai bản chép tay sớm muộn đọc số lệch nhau, mà lệch
 * giữa số và chữ trên chứng từ đã ký thì không ai sửa lại được nữa.
 *
 * Văn bản hành chính bắt buộc viết số kèm chữ trong ngoặc để không sửa được số
 * sau khi ký. Trước đây chỗ này phải gõ tay nên dễ lệch giữa số và chữ.
 *
 * Xử lý đúng các biến âm của tiếng Việt: 1 → "một" nhưng 21 → "hai mươi mốt";
 * 5 → "năm" nhưng 15 → "mười lăm"; 10 → "mười" nhưng 110 → "một trăm mười";
 * 4 → "bốn" nhưng 24 → "hai mươi tư"; và "linh" cho hàng chục trống.
 */
const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/** Đọc một nhóm ba chữ số. `coHangTram` = có nhóm lớn hơn phía trước. */
function docNhomBa(so: number, doc: boolean): string {
  const tram = Math.floor(so / 100);
  const chuc = Math.floor((so % 100) / 10);
  const donVi = so % 10;
  const ra: string[] = [];

  if (tram > 0 || doc) ra.push(`${CHU_SO[tram] ?? 'không'} trăm`);

  if (chuc === 0) {
    // "một trăm linh năm" — chỉ có "linh" khi phía trước đã đọc hàng trăm.
    if (donVi > 0 && (tram > 0 || doc)) ra.push('linh', CHU_SO[donVi] ?? '');
    else if (donVi > 0) ra.push(CHU_SO[donVi] ?? '');
  } else if (chuc === 1) {
    ra.push('mười');
    if (donVi === 5) ra.push('lăm');
    else if (donVi > 0) ra.push(CHU_SO[donVi] ?? '');
  } else {
    ra.push(`${CHU_SO[chuc] ?? ''} mươi`);
    if (donVi === 1) ra.push('mốt');
    else if (donVi === 4) ra.push('tư');
    else if (donVi === 5) ra.push('lăm');
    else if (donVi > 0) ra.push(CHU_SO[donVi] ?? '');
  }
  return ra.filter((t) => t !== '').join(' ');
}

const HANG = ['', ' nghìn', ' triệu', ' tỷ'];

export function soThanhChu(so: number): string {
  if (!Number.isFinite(so)) return '';
  const nguyen = Math.trunc(Math.abs(so));
  if (nguyen === 0) return so < 0 ? 'âm không' : 'không';

  // Tách thành các nhóm ba chữ số, nhóm nhỏ nhất ở đầu mảng.
  const nhom: number[] = [];
  let con = nguyen;
  while (con > 0) {
    nhom.push(con % 1000);
    con = Math.floor(con / 1000);
  }
  if (nhom.length > HANG.length) return String(nguyen);

  const phan: string[] = [];
  for (let i = nhom.length - 1; i >= 0; i -= 1) {
    const giaTri = nhom[i] ?? 0;
    // Nhóm giữa bằng 0 thì bỏ hẳn: 1.000.500 → "một triệu năm trăm".
    if (giaTri === 0) continue;
    // Nhóm không phải nhóm đầu thì luôn đọc đủ ba chữ số: 1.005 → "một nghìn không trăm linh năm".
    phan.push(`${docNhomBa(giaTri, i !== nhom.length - 1)}${HANG[i] ?? ''}`);
  }

  const chu = phan.join(' ').replace(/\s+/g, ' ').trim();
  return so < 0 ? `âm ${chu}` : chu;
}

/** "04 (bốn)" — số có đệm 0 kèm chữ trong ngoặc, đúng thể thức chứng từ. */
export function soVaChu(so: number, doDem = 2): string {
  return `${String(Math.trunc(so)).padStart(doDem, '0')} (${soThanhChu(so)})`;
}
