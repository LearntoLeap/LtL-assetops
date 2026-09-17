/**
 * Dấu hiệu AssetOps — vẽ bằng SVG nội tuyến, không phải <img>.
 *
 * Nội tuyến vì logo xuất hiện trên thanh điều hướng của MỌI trang: thêm một
 * lượt tải tệp chỉ để hiện 40px là không đáng, và <img> còn nháy một nhịp lúc
 * chưa tải xong. Tệp web/public/favicon.svg vẫn giữ riêng cho favicon —
 * trình duyệt cần một URL thật cho việc đó.
 */
interface ThamSo {
  /** Cạnh của khung, tính bằng px. */
  canh?: number;
  className?: string;
}

export function DauHieuAssetOps({ canh = 40, className }: ThamSo) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={canh}
      height={canh}
      className={className}
      role="img"
      aria-label="AssetOps"
    >
      <rect width="512" height="512" rx="104" fill="#1B5AEA" />
      <circle cx="256" cy="74" r="26" fill="#6BB8FF" />
      <rect x="88" y="124" width="336" height="288" rx="66" fill="#fff" />
      <rect x="136" y="178" width="240" height="138" rx="66" fill="#12285C" />
      <g
        fill="none"
        stroke="#6BB8FF"
        strokeWidth="27"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M170 264 L204 224 L238 264" />
        <path d="M274 264 L308 224 L342 264" />
      </g>
      <path
        d="M200 350 Q256 392 312 350"
        fill="none"
        stroke="#1B5AEA"
        strokeWidth="26"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Bản đủ chi tiết — có tai và khối tài sản. Dùng ở chỗ đủ to: ≥ 72px. */
export function DauHieuAssetOpsDay({ canh = 96, className }: ThamSo) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={canh}
      height={canh}
      className={className}
      role="img"
      aria-label="AssetOps"
    >
      <defs>
        <linearGradient id="dh-nen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B5AEA" />
          <stop offset="1" stopColor="#1246CC" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#dh-nen)" />
      <circle cx="256" cy="58" r="23" fill="#6BB8FF" />
      <rect x="248" y="76" width="16" height="58" rx="8" fill="#fff" />
      <rect x="74" y="212" width="38" height="92" rx="19" fill="#CBDDFB" />
      <rect x="400" y="212" width="38" height="92" rx="19" fill="#CBDDFB" />
      <rect x="110" y="128" width="292" height="244" rx="54" fill="#fff" />
      <rect x="154" y="170" width="204" height="116" rx="56" fill="#12285C" />
      <g
        fill="none"
        stroke="#6BB8FF"
        strokeWidth="19"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M182 240 L212 208 L242 240" />
        <path d="M270 240 L300 208 L330 240" />
      </g>
      <path
        d="M214 322 Q256 356 298 322"
        fill="none"
        stroke="#1B5AEA"
        strokeWidth="19"
        strokeLinecap="round"
      />
      <rect x="198" y="392" width="116" height="100" rx="30" fill="#CBDDFB" />
      <path d="M256 412 L292 432 L256 452 L220 432 Z" fill="#6BB8FF" />
      <path d="M220 432 L256 452 L256 474 L220 454 Z" fill="#fff" />
      <path d="M292 432 L292 454 L256 474 L256 452 Z" fill="#E8F1FE" />
    </svg>
  );
}
