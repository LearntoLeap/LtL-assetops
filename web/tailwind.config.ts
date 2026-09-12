import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Tông màu: xanh dương → xanh cyan. Biến CSS khai báo ở src/index.css để
 * chế độ tối chỉ cần đổi giá trị biến, không nhân đôi class.
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--vien))',
        input: 'hsl(var(--o-nhap))',
        ring: 'hsl(var(--vong-focus))',
        background: 'hsl(var(--nen))',
        foreground: 'hsl(var(--chu))',
        primary: {
          DEFAULT: 'hsl(var(--chinh))',
          foreground: 'hsl(var(--chu-tren-chinh))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--phu))',
          foreground: 'hsl(var(--chu-tren-phu))',
        },
        muted: {
          DEFAULT: 'hsl(var(--nhat))',
          foreground: 'hsl(var(--chu-nhat))',
        },
        accent: {
          DEFAULT: 'hsl(var(--nhan-manh))',
          foreground: 'hsl(var(--chu-tren-nhan-manh))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--nguy-hiem))',
          foreground: 'hsl(var(--chu-tren-nguy-hiem))',
        },
        success: {
          DEFAULT: 'hsl(var(--thanh-cong))',
          foreground: 'hsl(var(--chu-tren-thanh-cong))',
        },
        warning: {
          DEFAULT: 'hsl(var(--canh-bao))',
          foreground: 'hsl(var(--chu-tren-canh-bao))',
        },
        card: {
          DEFAULT: 'hsl(var(--the))',
          foreground: 'hsl(var(--chu-tren-the))',
        },
        popover: {
          DEFAULT: 'hsl(var(--noi-len))',
          foreground: 'hsl(var(--chu-tren-noi-len))',
        },
      },
      borderRadius: {
        lg: 'var(--bo-goc)',
        md: 'calc(var(--bo-goc) - 2px)',
        sm: 'calc(var(--bo-goc) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Vùng chạm tối thiểu 48px cho màn hình KIOSK (giai đoạn 6)
      minHeight: { cham: '48px' },
      minWidth: { cham: '48px' },
      keyframes: {
        'hien-len': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'hien-len': 'hien-len 180ms ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
