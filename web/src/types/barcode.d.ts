/**
 * Khai báo tối thiểu cho BarcodeDetector — API quét mã vạch có sẵn trong
 * Chrome/Edge và Chrome trên Android (máy kiosk tại kho và tablet đều dùng
 * được). TypeScript chưa có sẵn khai báo này trong lib.dom.
 * Trình duyệt không hỗ trợ (Safari/iOS) sẽ rơi sang jsQR — xem components/QuetQR.tsx.
 */
interface DiemPhatHien {
  x: number;
  y: number;
}

interface KetQuaMaVach {
  rawValue: string;
  format: string;
  cornerPoints?: DiemPhatHien[];
}

declare class BarcodeDetector {
  constructor(tuyChon?: { formats?: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(anh: ImageBitmapSource): Promise<KetQuaMaVach[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
