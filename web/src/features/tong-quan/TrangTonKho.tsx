import { BangTonTheoDiem } from './BangTonTheoDiem';

/** Trang riêng của bảng tồn có lọc — để mở thẳng từ các ô trên trang chủ và gửi đường dẫn. */
export function TrangTonKho() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Tồn theo điểm</h1>
        <p className="text-sm text-muted-foreground">
          Mỗi kho, mỗi trường đang có bao nhiêu bộ và hàng lẻ; mỗi sản phẩm đang nằm ở đâu.
        </p>
      </div>
      <BangTonTheoDiem />
    </div>
  );
}
