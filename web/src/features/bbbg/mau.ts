/**
 * Hình dạng một mẫu biên bản do API trả về (`GET /api/bbbg/mau`).
 *
 * Nội dung mẫu nằm ở server (`api/src/modules/bbbg/mau-bbbg.ts`) chứ không chép
 * sang đây: biên bản in ra là do server dựng, hai bản chép tay sớm muộn lệch nhau.
 */
export interface MauBBBG {
  tenVanBan: string;
  vViec: string;
  nhanBenGiao: string;
  nhanBenNhan: string;
  tieuDeDanhMuc: string;
  ketQuaKiemTra: string[];
  trachNhiem: string[];
  camKet: string;
  coHanTra: boolean;
  benGiaoLaLtL: boolean;
}
