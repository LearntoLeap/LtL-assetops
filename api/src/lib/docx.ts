/**
 * XUẤT FILE WORD (.docx) — không dùng thư viện sinh văn bản nào.
 *
 * .docx chỉ là một file ZIP chứa mấy file XML. Module này dựng đúng bốn file tối
 * thiểu mà Word / Google Docs / LibreOffice đều mở được, rồi nén bằng `jszip`
 * (đã có sẵn trong node_modules vì `exceljs` dùng — không kéo thêm thư viện nặng).
 *
 * Vì sao tự dựng chứ không dùng `docx`/`officegen`: biên bản bàn giao là văn bản
 * hành chính, cần đúng khổ A4, đúng lề, đúng phông Times New Roman 13pt, bảng có
 * dòng gộp ô — bấy nhiêu đó XML thì rõ ràng và kiểm soát được hơn là học API của
 * một thư viện rồi vẫn phải chèn XML thô cho phần nó không hỗ trợ.
 *
 * ĐƠN VỊ ĐO của Word:
 *   - khoảng cách, lề, độ rộng cột: twip = 1/20 pt = 1/1440 inch (1mm ≈ 56,7 twip)
 *   - cỡ chữ: nửa điểm (13pt → 26)
 */
import JSZip from 'jszip';

/** 1mm bằng bao nhiêu twip. */
const TWIP_MOI_MM = 56.6929;
export function mm(soMm: number): number {
  return Math.round(soMm * TWIP_MOI_MM);
}

/** Khổ A4: 210 × 297mm. */
export const A4 = { rong: mm(210), cao: mm(297) } as const;

export function thoat(tho: string): string {
  return tho
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface DinhDangChu {
  dam?: boolean;
  nghieng?: boolean;
  gachChan?: boolean;
  /** Cỡ chữ theo pt; bỏ trống thì theo cỡ mặc định của văn bản. */
  coChu?: number;
  /** Phông riêng cho đoạn này, vd 'Courier New' cho mã thiết bị. */
  phong?: string;
  hoaToanBo?: boolean;
}

/** Thứ tự thẻ theo lược đồ OOXML: rFonts → b → i → caps → sz → u. */
function xmlDinhDang(d: DinhDangChu): string {
  const phan: string[] = [];
  if (d.phong) phan.push(`<w:rFonts w:ascii="${thoat(d.phong)}" w:hAnsi="${thoat(d.phong)}"/>`);
  if (d.dam) phan.push('<w:b/>');
  if (d.nghieng) phan.push('<w:i/>');
  if (d.hoaToanBo) phan.push('<w:caps/>');
  if (d.coChu !== undefined) {
    const nua = Math.round(d.coChu * 2);
    phan.push(`<w:sz w:val="${nua}"/><w:szCs w:val="${nua}"/>`);
  }
  if (d.gachChan) phan.push('<w:u w:val="single"/>');
  return phan.length > 0 ? `<w:rPr>${phan.join('')}</w:rPr>` : '';
}

/** Một mẩu chữ trong đoạn — cho phép trộn đậm/thường trong cùng một dòng. */
export interface MauChu extends DinhDangChu {
  chu: string;
}

/**
 * Một mẩu chữ thành XML. `\n` trong chuỗi thành ngắt dòng mềm (`<w:br/>`) để
 * người dùng gõ nhiều dòng trong một ô nhập vẫn ra nhiều dòng trên file Word.
 */
function xmlMau(m: MauChu): string {
  const dinhDang = xmlDinhDang(m);
  const doan = m.chu.split('\n');
  const than = doan
    .map((d, i) => `${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${thoat(d)}</w:t>`)
    .join('');
  return `<w:r>${dinhDang}${than}</w:r>`;
}

export type CanLe = 'trai' | 'giua' | 'phai' | 'deu';
const MA_CAN_LE: Record<CanLe, string> = {
  trai: 'left',
  giua: 'center',
  phai: 'right',
  deu: 'both',
};

export interface TuyChonDoan extends DinhDangChu {
  canLe?: CanLe;
  /** Cách trên / cách dưới theo pt. */
  cachTren?: number;
  cachDuoi?: number;
  /** Thụt lề trái theo mm. */
  thutTrai?: number;
  /** Thụt dòng đầu theo mm (âm = treo dòng đầu ra ngoài). */
  thutDongDau?: number;
  /** Giãn dòng (1 = đơn, 1.5 = một rưỡi). */
  gianDong?: number;
  /** Không cho ngắt trang giữa đoạn này và đoạn sau. */
  dinhVoiSau?: boolean;
}

/**
 * Thuộc tính đoạn. THỨ TỰ CÁC THẺ LÀ BẮT BUỘC theo lược đồ OOXML
 * (keepNext → spacing → ind → jc → rPr). Word bỏ qua được nếu sai thứ tự,
 * nhưng LibreOffice và bộ kiểm chuẩn thì báo file hỏng.
 */
function xmlThuocTinhDoan(t: TuyChonDoan): string {
  const phan: string[] = [];
  if (t.dinhVoiSau) phan.push('<w:keepNext/>');

  const cach: string[] = [];
  if (t.cachTren !== undefined) cach.push(`w:before="${Math.round(t.cachTren * 20)}"`);
  if (t.cachDuoi !== undefined) cach.push(`w:after="${Math.round(t.cachDuoi * 20)}"`);
  if (t.gianDong !== undefined) {
    cach.push(`w:line="${Math.round(t.gianDong * 240)}" w:lineRule="auto"`);
  }
  if (cach.length > 0) phan.push(`<w:spacing ${cach.join(' ')}/>`);

  const thut: string[] = [];
  if (t.thutTrai !== undefined) thut.push(`w:left="${mm(t.thutTrai)}"`);
  if (t.thutDongDau !== undefined) {
    thut.push(
      t.thutDongDau >= 0
        ? `w:firstLine="${mm(t.thutDongDau)}"`
        : `w:hanging="${mm(-t.thutDongDau)}"`,
    );
  }
  if (thut.length > 0) phan.push(`<w:ind ${thut.join(' ')}/>`);
  if (t.canLe) phan.push(`<w:jc w:val="${MA_CAN_LE[t.canLe]}"/>`);

  // rPr trong pPr = định dạng của DẤU KẾT ĐOẠN, phải nằm cuối cùng.
  const chu = xmlDinhDang(t);
  if (chu) phan.push(chu);
  return phan.length > 0 ? `<w:pPr>${phan.join('')}</w:pPr>` : '';
}

/** Một đoạn văn. Truyền chuỗi cho đoạn một định dạng, hoặc mảng mẩu chữ để trộn. */
export function doan(noiDung: string | MauChu[], tuyChon: TuyChonDoan = {}): string {
  const mau: MauChu[] =
    typeof noiDung === 'string'
      ? noiDung === ''
        ? []
        : [{ chu: noiDung, ...tuyChon }]
      : noiDung.map((m) => ({ ...tuyChon, ...m }));
  return `<w:p>${xmlThuocTinhDoan(tuyChon)}${mau.map(xmlMau).join('')}</w:p>`;
}

/** Dòng trắng — dùng để chừa chỗ ký. */
export function dongTrang(soDong = 1): string {
  return Array.from({ length: soDong }, () => doan('')).join('');
}

// --------------------------------------------------------------------- bảng

export interface O {
  /** Nội dung ô: chuỗi (một đoạn) hoặc XML đoạn dựng sẵn. */
  noiDung: string | string[];
  gopCot?: number;
  canLe?: CanLe;
  /** Căn theo chiều dọc trong ô. */
  canDoc?: 'tren' | 'giua' | 'duoi';
  dam?: boolean;
  nghieng?: boolean;
  /** Màu nền dạng RRGGBB, vd 'D9D9D9' cho dòng tiêu đề. */
  mauNen?: string;
  /** Bỏ viền ô (dùng cho bảng chỗ ký). */
  khongVien?: boolean;
  coChu?: number;
  phong?: string;
}

export interface TuyChonBang {
  /** Độ rộng từng cột theo twip; tổng nên bằng bề rộng vùng in. */
  doRongCot: number[];
  /** Cỡ chữ mặc định trong bảng (pt). */
  coChu?: number;
  khongVien?: boolean;
  /** Lặp lại dòng đầu ở mỗi trang khi bảng dài. */
  lapDongDau?: boolean;
}

const VIEN_DON = 'w:val="single" w:sz="4" w:space="0" w:color="000000"';

function xmlO(o: O, rong: number, macDinh: TuyChonBang): string {
  const dinhDang: DinhDangChu = {
    ...(macDinh.coChu === undefined ? {} : { coChu: macDinh.coChu }),
    ...(o.coChu === undefined ? {} : { coChu: o.coChu }),
    ...(o.phong === undefined ? {} : { phong: o.phong }),
    ...(o.dam ? { dam: true } : {}),
    ...(o.nghieng ? { nghieng: true } : {}),
  };
  const cacDoan = (Array.isArray(o.noiDung) ? o.noiDung : [o.noiDung]).map((n) =>
    n.startsWith('<w:p') ? n : doan(n, { ...dinhDang, ...(o.canLe ? { canLe: o.canLe } : {}) }),
  );

  const thuocTinh: string[] = [`<w:tcW w:w="${rong}" w:type="dxa"/>`];
  if (o.gopCot && o.gopCot > 1) thuocTinh.push(`<w:gridSpan w:val="${o.gopCot}"/>`);
  if (o.khongVien ?? macDinh.khongVien) {
    thuocTinh.push(
      '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>',
    );
  }
  if (o.mauNen) {
    thuocTinh.push(`<w:shd w:val="clear" w:color="auto" w:fill="${thoat(o.mauNen)}"/>`);
  }
  if (o.canDoc) {
    const ma = o.canDoc === 'tren' ? 'top' : o.canDoc === 'duoi' ? 'bottom' : 'center';
    thuocTinh.push(`<w:vAlign w:val="${ma}"/>`);
  }
  return `<w:tc><w:tcPr>${thuocTinh.join('')}</w:tcPr>${cacDoan.join('')}</w:tc>`;
}

export function bang(cacHang: O[][], tuyChon: TuyChonBang): string {
  const tongRong = tuyChon.doRongCot.reduce((a, b) => a + b, 0);
  const vien = tuyChon.khongVien
    ? '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
    : `<w:tblBorders><w:top ${VIEN_DON}/><w:left ${VIEN_DON}/><w:bottom ${VIEN_DON}/><w:right ${VIEN_DON}/><w:insideH ${VIEN_DON}/><w:insideV ${VIEN_DON}/></w:tblBorders>`;

  const luoi = tuyChon.doRongCot.map((r) => `<w:gridCol w:w="${r}"/>`).join('');
  const hang = cacHang
    .map((h, chiSo) => {
      // Ô gộp chiếm chỗ của nhiều cột nên phải cộng dồn độ rộng cho đúng.
      let cot = 0;
      const o = h
        .map((oMot) => {
          const soCot = oMot.gopCot && oMot.gopCot > 1 ? oMot.gopCot : 1;
          const rong = tuyChon.doRongCot.slice(cot, cot + soCot).reduce((a, b) => a + b, 0);
          cot += soCot;
          return xmlO(oMot, rong || tuyChon.doRongCot[0] || 1000, tuyChon);
        })
        .join('');
      const lap = chiSo === 0 && tuyChon.lapDongDau ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
      return `<w:tr>${lap}${o}</w:tr>`;
    })
    .join('');

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${tongRong}" w:type="dxa"/>${vien}` +
    '<w:tblLayout w:type="fixed"/>' +
    '<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>' +
    '<w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>' +
    `</w:tblPr><w:tblGrid>${luoi}</w:tblGrid>${hang}</w:tbl>`
  );
}

// ------------------------------------------------------------- đóng gói file

export interface TuyChonTrang {
  /** Lề theo mm: trên, phải, dưới, trái. */
  le?: { tren: number; phai: number; duoi: number; trai: number };
  /** Phông mặc định. */
  phong?: string;
  /** Cỡ chữ mặc định (pt). */
  coChu?: number;
  /** Tên hiển thị trong thuộc tính file. */
  tieuDe?: string;
}

const LE_MAC_DINH = { tren: 16, phai: 15, duoi: 14, trai: 15 };

function xmlStyles(phong: string, coChu: number): string {
  const nua = Math.round(coChu * 2);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="${thoat(phong)}" w:hAnsi="${thoat(phong)}" w:eastAsia="${thoat(phong)}" w:cs="${thoat(phong)}"/>
      <w:sz w:val="${nua}"/><w:szCs w:val="${nua}"/><w:lang w:val="vi-VN"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
  </w:style>
</w:styles>`;
}

/**
 * Nén các khối nội dung thành file .docx hoàn chỉnh.
 *
 * `khoi` là mảng XML do `doan()` / `bang()` sinh ra, ghép theo thứ tự xuất hiện.
 */
export async function taoDocx(khoi: string[], tuyChon: TuyChonTrang = {}): Promise<Buffer> {
  const le = tuyChon.le ?? LE_MAC_DINH;
  const phong = tuyChon.phong ?? 'Times New Roman';
  const coChu = tuyChon.coChu ?? 13;

  // Word đòi đoạn cuối cùng phải nằm ngoài bảng, nếu không file bị coi là hỏng.
  const than = khoi.join('');
  const chotBang = than.trimEnd().endsWith('</w:tbl>') ? doan('') : '';

  const sectPr =
    `<w:sectPr><w:pgSz w:w="${A4.rong}" w:h="${A4.cao}"/>` +
    `<w:pgMar w:top="${mm(le.tren)}" w:right="${mm(le.phai)}" w:bottom="${mm(le.duoi)}" ` +
    `w:left="${mm(le.trai)}" w:header="708" w:footer="708" w:gutter="0"/>` +
    '<w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>';

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${than}${chotBang}${sectPr}</w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const bayGio = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${thoat(tuyChon.tieuDe ?? 'Biên bản')}</dc:title>
  <dc:creator>AssetOps — Learn to Leap</dc:creator>
  <cp:lastModifiedBy>AssetOps</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${bayGio}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${bayGio}</dcterms:modified>
</cp:coreProperties>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', document);
  zip.file('word/_rels/document.xml.rels', docRels);
  zip.file('word/styles.xml', xmlStyles(phong, coChu));
  zip.file('docProps/core.xml', core);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
