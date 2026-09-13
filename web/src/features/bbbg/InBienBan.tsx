import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { NHAN_TINH_TRANG } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { goiApi, LoiApi } from '@/lib/api';
import type { BienBan } from '@/lib/kieu';

/**
 * Bản in A4 của biên bản bàn giao — đúng thể thức văn bản Việt Nam: quốc hiệu,
 * tiêu ngữ, số biên bản, hai bên, bảng thiết bị, cam kết, chỗ ký.
 *
 * Trang này nằm NGOÀI bố cục ứng dụng để bản in không dính header/menu, và luôn
 * là chữ đen trên giấy trắng dù người dùng đang bật chế độ tối. Xuất PDF dùng
 * hộp thoại in của trình duyệt ("Lưu thành PDF") — không cần thư viện thêm.
 */
const CSS_IN = `
@page { size: A4; margin: 16mm 15mm 14mm; }
.bb-giay {
  color: #000; background: #fff;
  font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.5;
  max-width: 190mm; margin: 0 auto; padding: 10mm 8mm 16mm;
}
.bb-giay p { margin: 0 0 6pt; }
.bb-dau { display: flex; gap: 8mm; align-items: flex-start; }
.bb-dau > div { flex: 1 1 0; text-align: center; }
.bb-hoa { font-weight: 700; text-transform: uppercase; }
.bb-gach { display: inline-block; border-top: 1px solid #000; width: 45%; margin-top: 2pt; }
.bb-tieu-de { text-align: center; margin: 10mm 0 2mm; font-size: 16pt; font-weight: 700; text-transform: uppercase; }
.bb-so { text-align: center; margin-bottom: 8mm; font-style: italic; }
.bb-muc { font-weight: 700; margin: 6pt 0 3pt; }
.bb-bang { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; font-size: 11.5pt; }
.bb-bang th, .bb-bang td { border: 1px solid #000; padding: 4pt 5pt; vertical-align: top; }
.bb-bang th { text-align: center; font-weight: 700; }
.bb-giua { text-align: center; }
.bb-phai { text-align: right; }
.bb-ma { font-family: 'Courier New', Courier, monospace; }
.bb-ky { display: flex; gap: 8mm; margin-top: 10mm; page-break-inside: avoid; }
.bb-ky > div { flex: 1 1 0; text-align: center; }
.bb-ky .bb-cho-ten { height: 24mm; }
.bb-ky .bb-ten { font-weight: 700; }
.bb-in-an { display: none; }
@media print {
  .bb-khong-in { display: none !important; }
  .bb-in-an { display: block; }
  .bb-giay { max-width: none; margin: 0; padding: 0; }
  body { background: #fff; }
}
`;

/** "ngày 15 tháng 3 năm 2026" — thể thức văn bản hành chính. */
function ngayVanBan(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '…… tháng …… năm ……';
  return `${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
}

export function InBienBan() {
  const { id } = useParams<{ id: string }>();
  const [bb, datBb] = useState<BienBan | null>(null);
  const [loi, datLoi] = useState<string | null>(null);

  const tai = useCallback(async () => {
    if (!id) return;
    try {
      const kq = await goiApi<{ ok: true; bbbg: BienBan }>(`/api/bbbg/${id}`);
      datBb(kq.bbbg);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được biên bản.');
    }
  }, [id]);

  useEffect(() => {
    void tai();
  }, [tai]);

  if (loi) {
    return (
      <div className="container space-y-3 py-8">
        <Alert variant="destructive" tieuDe="Không mở được biên bản">
          {loi}
        </Alert>
        <Button variant="outline" asChild>
          <Link to="/bbbg">
            <ArrowLeft aria-hidden />
            Về danh sách biên bản
          </Link>
        </Button>
      </div>
    );
  }
  if (!bb) return <p className="container py-8 text-sm text-muted-foreground">Đang tải…</p>;

  const tong = bb.items.reduce((s, m) => s + m.quantity, 0);

  return (
    <>
      <style>{CSS_IN}</style>

      <div className="bb-khong-in border-b bg-card">
        <div className="container flex flex-wrap items-center gap-2 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/bbbg/${bb.id}`}>
              <ArrowLeft aria-hidden />
              Về biên bản
            </Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer aria-hidden />
            In / Lưu PDF
          </Button>
          <p className="text-xs text-muted-foreground">
            Trong hộp thoại in, chọn máy in “Lưu thành PDF” (Save as PDF) để xuất file PDF khổ A4.
          </p>
        </div>
      </div>

      <div className="bb-giay">
        <div className="bb-dau">
          <div>
            <p className="bb-hoa">{bb.giverOrg}</p>
            <span className="bb-gach" />
          </div>
          <div>
            <p className="bb-hoa">Cộng hoà xã hội chủ nghĩa Việt Nam</p>
            <p className="bb-hoa">Độc lập – Tự do – Hạnh phúc</p>
            <span className="bb-gach" />
          </div>
        </div>

        <p className="bb-tieu-de">Biên bản bàn giao thiết bị</p>
        <p className="bb-so">Số: {bb.code}</p>

        <p>
          Hôm nay, ngày {ngayVanBan(bb.issuedDate ?? bb.createdAt)}, tại{' '}
          {bb.receiverLocation?.name ?? bb.receiverOrg}, hai bên gồm:
        </p>

        <p className="bb-muc">I. BÊN GIAO</p>
        <p>– Đơn vị: {bb.giverOrg}</p>
        <p>
          – Người đại diện: {bb.giverName}
          {bb.giverTitle ? ` — Chức vụ: ${bb.giverTitle}` : ''}
        </p>

        <p className="bb-muc">II. BÊN NHẬN</p>
        <p>– Đơn vị: {bb.receiverOrg}</p>
        <p>
          – Người đại diện: {bb.receiverName}
          {bb.receiverTitle ? ` — Chức vụ: ${bb.receiverTitle}` : ''}
        </p>
        {bb.receiverPhone ? <p>– Điện thoại: {bb.receiverPhone}</p> : null}

        <p className="bb-muc">III. NỘI DUNG BÀN GIAO</p>
        <p>Bên giao đã bàn giao cho bên nhận các thiết bị sau:</p>
        <table className="bb-bang">
          <thead>
            <tr>
              <th style={{ width: '8%' }}>STT</th>
              <th style={{ width: '20%' }}>Mã thiết bị</th>
              <th>Tên thiết bị</th>
              <th style={{ width: '10%' }}>SL</th>
              <th style={{ width: '18%' }}>Tình trạng</th>
              <th style={{ width: '18%' }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {bb.items.map((m, i) => (
              <tr key={m.id}>
                <td className="bb-giua">{i + 1}</td>
                <td className="bb-ma">{m.assetCodeSnapshot}</td>
                <td>{m.assetNameSnapshot}</td>
                <td className="bb-giua">{m.quantity}</td>
                <td>{NHAN_TINH_TRANG[m.conditionSnapshot]}</td>
                <td>{m.note ?? ''}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="bb-phai">
                <strong>Tổng cộng</strong>
              </td>
              <td className="bb-giua">
                <strong>{tong}</strong>
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>

        <p className="bb-muc">IV. CAM KẾT</p>
        <p>{bb.commitment ?? ''}</p>

        {bb.note ? (
          <>
            <p className="bb-muc">V. GHI CHÚ</p>
            <p>{bb.note}</p>
          </>
        ) : null}

        <p>Biên bản lập xong, hai bên cùng đọc lại, nhất trí với nội dung trên và ký tên dưới đây.</p>

        <div className="bb-ky">
          <div>
            <p className="bb-hoa">Bên giao</p>
            <p>
              <em>(Ký, ghi rõ họ tên)</em>
            </p>
            <div className="bb-cho-ten" />
            <p className="bb-ten">{bb.giverName}</p>
          </div>
          <div>
            <p className="bb-hoa">Bên nhận</p>
            <p>
              <em>(Ký, ghi rõ họ tên)</em>
            </p>
            <div className="bb-cho-ten" />
            <p className="bb-ten">{bb.receiverName}</p>
          </div>
        </div>
      </div>
    </>
  );
}
