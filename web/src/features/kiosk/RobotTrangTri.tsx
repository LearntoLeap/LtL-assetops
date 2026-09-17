/**
 * Hình robot trang trí cho MÀN HÌNH KHO.
 *
 * Vẽ bằng SVG nội tuyến, không dùng tệp ảnh: màn hình kiosk chạy liên tục
 * trong mạng kho hay chập chờn, tải thêm ảnh nặng là rủi ro không đáng — và
 * SVG thì nét ở mọi kích cỡ màn chiếu.
 *
 * Tất cả đều `aria-hidden`: đây là hình trang trí, người dùng trình đọc màn
 * hình không cần nghe mô tả robot.
 */

/** Robot lớn đứng ở góc — nền của màn hình kho. */
export function RobotNen({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 460" className={className} aria-hidden focusable="false">
      {/* ăng-ten */}
      <circle cx="200" cy="26" r="18" fill="currentColor" opacity="0.85" />
      <rect x="194" y="40" width="12" height="44" rx="6" fill="currentColor" opacity="0.5" />
      {/* tai */}
      <rect x="44" y="168" width="30" height="76" rx="15" fill="currentColor" opacity="0.35" />
      <rect x="326" y="168" width="30" height="76" rx="15" fill="currentColor" opacity="0.35" />
      {/* đầu */}
      <rect x="72" y="84" width="256" height="216" rx="50" fill="currentColor" opacity="0.18" />
      <rect x="72" y="84" width="256" height="216" rx="50" fill="none" stroke="currentColor"
            strokeWidth="4" opacity="0.5" />
      {/* kính + mắt */}
      <rect x="112" y="126" width="176" height="104" rx="50" fill="currentColor" opacity="0.35" />
      <g fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round"
         strokeLinejoin="round" opacity="0.95">
        <path d="M140 196 L166 164 L192 196" />
        <path d="M208 196 L234 164 L260 196" />
      </g>
      {/* miệng */}
      <path d="M160 258 Q200 288 240 258" fill="none" stroke="currentColor" strokeWidth="14"
            strokeLinecap="round" opacity="0.75" />
      {/* thân + hai tay */}
      <rect x="120" y="316" width="160" height="120" rx="34" fill="currentColor" opacity="0.14" />
      <rect x="120" y="316" width="160" height="120" rx="34" fill="none" stroke="currentColor"
            strokeWidth="4" opacity="0.4" />
      <rect x="62" y="336" width="42" height="26" rx="13" fill="currentColor" opacity="0.3" />
      <rect x="296" y="336" width="42" height="26" rx="13" fill="currentColor" opacity="0.3" />
      {/* khối tài sản trên thân */}
      <path d="M200 352 L228 368 L200 384 L172 368 Z" fill="currentColor" opacity="0.6" />
      <path d="M172 368 L200 384 L200 406 L172 390 Z" fill="currentColor" opacity="0.38" />
      <path d="M228 368 L228 390 L200 406 L200 384 Z" fill="currentColor" opacity="0.26" />
    </svg>
  );
}

/** Mặt robot nhỏ — dùng làm dấu hiệu cạnh đồng hồ và trong các ô. */
export function MatRobot({ canh = 28, className }: { canh?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={canh}
      height={canh}
      className={className}
      aria-hidden
      focusable="false"
    >
      <circle cx="32" cy="7" r="5" fill="currentColor" />
      <rect x="6" y="14" width="52" height="42" rx="13" fill="currentColor" opacity="0.22" />
      <rect x="6" y="14" width="52" height="42" rx="13" fill="none" stroke="currentColor"
            strokeWidth="3" />
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
         strokeLinejoin="round">
        <path d="M17 34 L23 26 L29 34" />
        <path d="M35 34 L41 26 L47 34" />
      </g>
      <path d="M22 44 Q32 51 42 44" fill="none" stroke="currentColor" strokeWidth="4"
            strokeLinecap="round" />
    </svg>
  );
}
