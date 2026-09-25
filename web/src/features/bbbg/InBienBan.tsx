import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { NHAN_MAU_BBBG, NHAN_TINH_TRANG, soVaChu } from '@ltl/taisan-shared';
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
.bb-deu { text-align: justify; }
.bb-giua { text-align: center; }
.bb-sao { margin-bottom: 10mm; }
.bb-vviec { margin-bottom: 8mm; }
.bb-can-cu { font-style: italic; text-align: justify; margin-bottom: 2pt; }
.bb-gach-dau { padding-left: 6mm; text-indent: -3.5mm; margin-bottom: 1pt; }
.bb-nhom { font-weight: 700; background: #f2f2f2; }
.bb-tong { font-weight: 700; }
.bb-bang .bb-ma { display: block; font-size: 9.5pt; font-style: italic; }
.bb-ky .bb-ten { font-weight: 700; }
.bb-in-an { display: none; }
@media print {
  .bb-khong-in { display: none !important; }
  .bb-in-an { display: block; }
  .bb-giay { max-width: none; margin: 0; padding: 0; }
  body { background: #fff; }
}
`;

/** Tách ô nhập nhiều dòng thành danh sách ý, bỏ dòng trống. */
function tachDong(tho: string | null | undefined): string[] {
  if (!tho) return [];
  return tho
    .split('\n')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

/**
 * Đánh số mục cho khớp bản Word: mẫu cho mượn chèn thêm mục "Thời hạn mượn"
 * nên các mục sau nó lùi xuống một số.
 */
function soMuc(bb: BienBan, muc: 'kiem-tra' | 'trach-nhiem' | 'ghi-chu'): number {
  const coHanTra = bb.templateType === 'CHO_MUON' && !!bb.request?.expectedReturnAt;
  const goc = { 'kiem-tra': 3, 'trach-nhiem': 4, 'ghi-chu': 5 }[muc];
  return goc + (coHanTra ? 1 : 0);
}

function cauSoBan(soBan: number): string {
  const n = Math.max(1, Math.trunc(soBan));
  if (n === 1) return 'Biên bản được lập thành 01 (một) bản, lưu tại Bên giao.';
  if (n % 2 === 0) {
    return `Biên bản được lập thành ${soVaChu(n)} bản có giá trị pháp lý như nhau, mỗi Bên giữ ${soVaChu(n / 2)} bản.`;
  }
  const giao = Math.ceil(n / 2);
  return `Biên bản được lập thành ${soVaChu(n)} bản có giá trị pháp lý như nhau, Bên giao giữ ${soVaChu(giao)} bản, Bên nhận giữ ${soVaChu(n - giao)} bản.`;
}

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
  const canCu = tachDong(bb.basis);
  const kiemTra = tachDong(bb.inspection);
  const trachNhiem = tachDong(bb.obligations);
  const ghiChu = tachDong(bb.note);
  const vViec = bb.subtitle?.trim() ?? '';
  const noiLap =
    bb.handoverPlace?.trim() ||
    bb.receiverAddress?.trim() ||
    bb.receiverLocation?.name ||
    bb.receiverOrg;

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
        <p className="bb-hoa bb-giua">Cộng hoà xã hội chủ nghĩa Việt Nam</p>
        <p className="bb-hoa bb-giua">Độc lập – Tự do – Hạnh phúc</p>
        <p className="bb-giua bb-sao">--------***--------</p>

        <p className="bb-tieu-de">{NHAN_MAU_BBBG[bb.templateType]}</p>
        <p className="bb-so">Số: {bb.code}</p>
        {vViec ? <p className="bb-so bb-vviec">({vViec})</p> : null}

        {canCu.map((c, i) => (
          <p key={`cc-${i}`} className="bb-can-cu">
            {c}
          </p>
        ))}

        <p className="bb-deu">
          Hôm nay, ngày {ngayVanBan(bb.issuedDate ?? bb.createdAt)}, tại {noiLap}, chúng tôi gồm:
        </p>

        <p className="bb-muc">BÊN GIAO (BÊN A): {bb.giverOrg}</p>
        {bb.giverAddress ? <p className="bb-gach-dau">- Địa chỉ: {bb.giverAddress}</p> : null}
        {bb.giverTaxCode ? <p className="bb-gach-dau">- Mã số thuế: {bb.giverTaxCode}</p> : null}
        {bb.giverPhone ? <p className="bb-gach-dau">- Điện thoại: {bb.giverPhone}</p> : null}
        <p className="bb-gach-dau">
          - Đại diện: {bb.giverName}
          {bb.giverTitle ? ` – Chức vụ: ${bb.giverTitle}` : ''}
        </p>

        <p className="bb-muc">BÊN NHẬN (BÊN B): {bb.receiverOrg}</p>
        {bb.receiverAddress ? <p className="bb-gach-dau">- Địa chỉ: {bb.receiverAddress}</p> : null}
        {bb.receiverPhone ? <p className="bb-gach-dau">- Điện thoại: {bb.receiverPhone}</p> : null}
        <p className="bb-gach-dau">
          - Đại diện: {bb.receiverName}
          {bb.receiverTitle ? ` – Chức vụ: ${bb.receiverTitle}` : ''}
        </p>

        <p className="bb-deu">Hai Bên cùng thống nhất lập biên bản với nội dung như sau:</p>

        <p className="bb-muc">1. Danh mục thiết bị bàn giao</p>
        <table className="bb-bang">
          <thead>
            <tr>
              <th style={{ width: '7%' }}>STT</th>
              <th>Tên hàng hóa</th>
              <th style={{ width: '9%' }}>ĐVT</th>
              <th style={{ width: '7%' }}>SL</th>
              <th style={{ width: '17%' }}>Tình trạng</th>
              <th style={{ width: '24%' }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {bb.items.map((m, i) => (
              <Fragment key={m.id}>
                {m.groupLabel && m.groupLabel !== bb.items[i - 1]?.groupLabel ? (
                  <tr>
                    <td colSpan={6} className="bb-nhom">
                      {m.groupLabel}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td className="bb-giua">{i + 1}</td>
                  <td>
                    {m.assetNameSnapshot}
                    <span className="bb-ma">Mã: {m.assetCodeSnapshot}</span>
                  </td>
                  <td className="bb-giua">{m.unit}</td>
                  <td className="bb-giua">{m.quantity}</td>
                  <td className="bb-giua">{NHAN_TINH_TRANG[m.conditionSnapshot]}</td>
                  <td>{m.note ?? ''}</td>
                </tr>
              </Fragment>
            ))}
            <tr>
              <td colSpan={6} className="bb-tong">
                TỔNG CỘNG: {soVaChu(bb.items.length)} danh mục — {soVaChu(tong)} thiết bị.
              </td>
            </tr>
          </tbody>
        </table>

        <p className="bb-muc">2. Địa điểm bàn giao</p>
        <p className="bb-gach-dau">{noiLap}</p>

        {bb.request?.expectedReturnAt && bb.templateType === 'CHO_MUON' ? (
          <>
            <p className="bb-muc">3. Thời hạn mượn</p>
            <p className="bb-gach-dau">
              Bên mượn hoàn trả thiết bị cho Bên cho mượn trước hết ngày{' '}
              {ngayVanBan(bb.request.expectedReturnAt)}.
            </p>
          </>
        ) : null}

        <p className="bb-muc">{soMuc(bb, 'kiem-tra')}. Kết quả kiểm tra khi bàn giao</p>
        {kiemTra.map((y, i) => (
          <p key={`kt-${i}`} className="bb-gach-dau bb-deu">
            - {y}
          </p>
        ))}

        <p className="bb-muc">{soMuc(bb, 'trach-nhiem')}. Trách nhiệm của các Bên</p>
        {trachNhiem.map((y, i) => (
          <p key={`tn-${i}`} className="bb-gach-dau bb-deu">
            - {y}
          </p>
        ))}

        {ghiChu.length > 0 ? (
          <>
            <p className="bb-muc">{soMuc(bb, 'ghi-chu')}. Ghi chú khác</p>
            {ghiChu.map((y, i) => (
              <p key={`gc-${i}`} className="bb-gach-dau bb-deu">
                - {y}
              </p>
            ))}
          </>
        ) : null}

        <p className="bb-deu">{bb.commitment ?? ''}</p>
        <p className="bb-deu">{cauSoBan(bb.copies)}</p>

        <div className="bb-ky">
          <div>
            <p className="bb-hoa">Đại diện Bên giao (Bên A)</p>
            <p>
              <em>(Ký, ghi rõ họ tên)</em>
            </p>
            <div className="bb-cho-ten" />
            <p className="bb-ten">{bb.giverName.toUpperCase()}</p>
            {bb.giverTitle ? (
              <p>
                <em>{bb.giverTitle}</em>
              </p>
            ) : null}
          </div>
          <div>
            <p className="bb-hoa">Đại diện Bên nhận (Bên B)</p>
            <p>
              <em>(Ký, ghi rõ họ tên)</em>
            </p>
            <div className="bb-cho-ten" />
            <p className="bb-ten">{bb.receiverName.toUpperCase()}</p>
            {bb.receiverTitle ? (
              <p>
                <em>{bb.receiverTitle}</em>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
