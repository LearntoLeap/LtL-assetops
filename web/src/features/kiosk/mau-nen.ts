import type { AnhNenKiosk } from '@ltl/taisan-shared';

/**
 * Mẫu ảnh nền cho màn hình kho, vẽ bằng CSS gradient — không kèm tệp ảnh nào nên
 * màn hình kiosk không phải tải ảnh nặng qua mạng kho, và kho mã nguồn không
 * phình thêm. Mỗi mẫu đều tối để chữ trắng ở trên luôn đọc được.
 */
export const NEN_KIOSK: Record<AnhNenKiosk, string> = {
  XANH_MACH_DIEN:
    'radial-gradient(1200px 600px at 12% -10%, #1d4ed8 0%, transparent 60%),' +
    'radial-gradient(900px 500px at 92% 8%, #0e7490 0%, transparent 55%),' +
    'linear-gradient(160deg, #06152e 0%, #0a1f3c 55%, #07182f 100%)',
  XANH_CYAN:
    'radial-gradient(900px 520px at 85% 0%, #06b6d4 0%, transparent 58%),' +
    'linear-gradient(140deg, #0b2a52 0%, #08355c 45%, #06243f 100%)',
  DEM_KHO:
    'radial-gradient(1000px 520px at 50% -15%, #1e3a8a 0%, transparent 62%),' +
    'linear-gradient(180deg, #0b1120 0%, #111a2e 60%, #0a0f1c 100%)',
  TOI_GIAN: 'linear-gradient(150deg, #111827 0%, #1f2937 60%, #0f172a 100%)',
};

export const NEN_MAC_DINH: AnhNenKiosk = 'XANH_MACH_DIEN';
