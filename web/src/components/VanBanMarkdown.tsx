import { Fragment, type ReactNode } from 'react';

/**
 * Hiển thị markdown rút gọn: tiêu đề, danh sách, đậm, nghiêng, mã, liên kết.
 *
 * Tự viết thay vì thêm thư viện vì hai lý do, lý do thứ hai mới là chính:
 *   1. chỉ cần vài cú pháp, thêm marked + dompurify là hai gói cho một việc nhỏ;
 *   2. hàm này DỰNG PHẦN TỬ REACT chứ không sinh chuỗi HTML, nên không có chỗ
 *      nào gọi dangerouslySetInnerHTML — nội dung wiki do người dùng gõ vào
 *      không thể chèn mã chạy được. An toàn theo cấu trúc, không theo bộ lọc.
 *
 * Liên kết chỉ nhận http/https (chặn javascript:) và luôn mở tab mới với
 * rel="noopener".
 */

const DAM = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/)[^\s)]+\))/g;

function dongCoDinhDang(dong: string, khoa: string): ReactNode {
  const manh = dong.split(DAM).filter((x) => x !== '');
  return (
    <Fragment key={khoa}>
      {manh.map((m, i) => {
        if (m.startsWith('**') && m.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold">
              {m.slice(2, -2)}
            </strong>
          );
        }
        if (m.startsWith('`') && m.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
              {m.slice(1, -1)}
            </code>
          );
        }
        const lk = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(m);
        if (lk) {
          return (
            <a
              key={i}
              href={lk[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-dam underline underline-offset-2"
            >
              {lk[1]}
            </a>
          );
        }
        return <Fragment key={i}>{m}</Fragment>;
      })}
    </Fragment>
  );
}

export function VanBanMarkdown({ noiDung }: { noiDung: string }) {
  const dong = noiDung.replace(/\r\n/g, '\n').split('\n');
  const khoi: ReactNode[] = [];
  let danhSach: { thuTu: boolean; muc: string[] } | null = null;
  let doan: string[] = [];

  const xaDanhSach = (): void => {
    if (!danhSach) return;
    const { thuTu, muc } = danhSach;
    const The = thuTu ? 'ol' : 'ul';
    khoi.push(
      <The
        key={`ds-${khoi.length}`}
        className={`ml-5 space-y-1 ${thuTu ? 'list-decimal' : 'list-disc'}`}
      >
        {muc.map((m, i) => (
          <li key={i}>{dongCoDinhDang(m, `${i}`)}</li>
        ))}
      </The>,
    );
    danhSach = null;
  };

  const xaDoan = (): void => {
    if (doan.length === 0) return;
    const chu = doan.join(' ');
    khoi.push(
      <p key={`p-${khoi.length}`} className="leading-relaxed">
        {dongCoDinhDang(chu, 'p')}
      </p>,
    );
    doan = [];
  };

  for (const tho of dong) {
    const d = tho.trimEnd();
    const tieuDe = /^(#{1,4})\s+(.*)$/.exec(d);
    const mucDs = /^[-*]\s+(.*)$/.exec(d);
    const mucSo = /^\d+[.)]\s+(.*)$/.exec(d);

    if (tieuDe) {
      xaDoan();
      xaDanhSach();
      const cap = tieuDe[1]?.length ?? 2;
      const co = cap <= 2 ? 'text-lg' : 'text-base';
      khoi.push(
        <p key={`h-${khoi.length}`} className={`${co} mt-1 font-semibold`}>
          {tieuDe[2]}
        </p>,
      );
      continue;
    }
    if (mucDs || mucSo) {
      xaDoan();
      const thuTu = Boolean(mucSo);
      const chu = (mucDs?.[1] ?? mucSo?.[1]) ?? '';
      if (danhSach && danhSach.thuTu === thuTu) danhSach.muc.push(chu);
      else {
        xaDanhSach();
        danhSach = { thuTu, muc: [chu] };
      }
      continue;
    }
    if (d.trim() === '') {
      xaDoan();
      xaDanhSach();
      continue;
    }
    xaDanhSach();
    doan.push(d.trim());
  }
  xaDoan();
  xaDanhSach();

  if (khoi.length === 0) return null;
  return <div className="space-y-3 text-sm">{khoi}</div>;
}
