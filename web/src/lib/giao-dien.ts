/** Chế độ sáng/tối. Lưu theo trình duyệt; mặc định theo cài đặt hệ điều hành. */
export type CheDo = 'sang' | 'toi';

const KHOA = 'ltl-taisan:che-do';

export function docCheDo(): CheDo {
  try {
    const daLuu = localStorage.getItem(KHOA);
    if (daLuu === 'sang' || daLuu === 'toi') return daLuu;
  } catch {
    // Trình duyệt chặn localStorage (chế độ riêng tư) — dùng cài đặt hệ điều hành.
  }
  const toi =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return toi ? 'toi' : 'sang';
}

export function apDungCheDo(cheDo: CheDo): void {
  document.documentElement.classList.toggle('dark', cheDo === 'toi');
  document.documentElement.style.colorScheme = cheDo === 'toi' ? 'dark' : 'light';
  try {
    localStorage.setItem(KHOA, cheDo);
  } catch {
    // Không lưu được thì vẫn áp dụng cho phiên hiện tại.
  }
}
