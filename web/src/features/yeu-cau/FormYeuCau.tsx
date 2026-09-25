import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, PackagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { DS_LOAI_YEU_CAU } from '@ltl/taisan-shared';
import { MAU_YEU_CAU, NOI_KHAC, type MauYeuCau } from './mau-yeu-cau';
import { TaoNhanhThietBi } from './TaoNhanhThietBi';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { NutQuetQR } from '@/components/QuetQR';
import { goiApi, LoiApi } from '@/lib/api';
import { OGoiYMaThietBi } from '@/components/OGoiYMaThietBi';
import { OChonHangLe } from './OChonHangLe';
import type { NoiDen, ThietBi, TrangDuLieu, YeuCau } from '@/lib/kieu';

/** Loại lập được ở form này — BÁO HỎNG có trang riêng vì bắt buộc kèm ảnh. */
type LoaiLapDuoc = keyof typeof MAU_YEU_CAU;
const LOAI_LAP_DUOC = DS_LOAI_YEU_CAU.filter(
  (l) => l.ma !== 'BAO_HONG',
) as ReadonlyArray<{ ma: LoaiLapDuoc; nhan: string }>;

interface DongMuc {
  code: string;
  quantity: string;
  /** Tên thiết bị tra được, để người dùng thấy mình chọn đúng cái. */
  ten?: string | undefined;
  loi?: string | undefined;
}

export function FormYeuCau() {
  const dieuHuong = useNavigate();
  const [type, datType] = useState<LoaiLapDuoc>('CHO_MUON');
  /** Dòng đang mở bảng tạo nhanh thiết bị; null = không mở. */
  const [dongTaoNhanh, datDongTaoNhanh] = useState<number | null>(null);
  const [reason, datReason] = useState('');
  const [toLocationId, datToLocationId] = useState('');
  const [destinationNote, datDestinationNote] = useState('');
  const [expectedReturnAt, datExpectedReturnAt] = useState('');
  const [muc, datMuc] = useState<DongMuc[]>([{ code: '', quantity: '1' }]);
  const [diaDiem, datDiaDiem] = useState<NoiDen[]>([]);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);

  useEffect(() => {
    async function tai(): Promise<void> {
      try {
        // Danh sách NƠI ĐẾN (chỉ mã/tên) chứ không phải danh sách đã lọc phạm vi:
        // luân chuyển giữa các trường thì trường A phải chọn được trường B.
        const kq = await goiApi<TrangDuLieu<NoiDen>>('/api/dia-diem/noi-den?chiHoatDong=true');
        datDiaDiem(kq.muc);
      } catch {
        // Thiếu danh mục điểm thì vẫn tạo được yêu cầu không cần nơi đến.
      }
    }
    void tai();
  }, []);

  /** Tra mã ngay khi nhập xong để báo sai sớm, không đợi bấm Lưu. */
  async function traMa(i: number, code: string): Promise<void> {
    const ma = code.trim().toUpperCase();
    if (!ma) return;
    try {
      // Dùng endpoint tra cứu rút gọn: người lập yêu cầu phải gõ được mã thiết
      // bị mình muốn mượn, dù thiết bị chưa thuộc phạm vi dữ liệu của họ.
      const kq = await goiApi<{ ok: true; thietBi: Pick<ThietBi, 'name' | 'code'> }>(
        `/api/thiet-bi/tra-cuu/${encodeURIComponent(ma)}`,
      );
      datMuc((cu) =>
        cu.map((d, j) =>
          j === i ? { ...d, code: ma, ten: kq.thietBi.name, loi: undefined } : d,
        ),
      );
    } catch (e) {
      datMuc((cu) =>
        cu.map((d, j) =>
          j === i
            ? {
                ...d,
                code: ma,
                ten: undefined,
                loi: e instanceof LoiApi ? e.message : 'Không tra được mã này.',
              }
            : d,
        ),
      );
    }
  }

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    const dong = muc.filter((d) => d.code.trim() !== '');
    if (dong.length === 0) {
      datLoi('Yêu cầu phải có ít nhất một thiết bị.');
      return;
    }
    datDangGui(true);
    try {
      const kq = await goiApi<{ ok: true; yeuCau: YeuCau }>('/api/yeu-cau', {
        method: 'POST',
        than: {
          type,
          reason,
          // Chọn "Nơi khác" thì KHÔNG gửi toLocationId — giá trị NOI_KHAC chỉ
          // là cờ của giao diện, gửi lên server sẽ thành id không tồn tại.
          ...(toLocationId && toLocationId !== NOI_KHAC ? { toLocationId } : {}),
          ...(destinationNote.trim() ? { destinationNote: destinationNote.trim() } : {}),
          ...(expectedReturnAt ? { expectedReturnAt: new Date(expectedReturnAt).toISOString() } : {}),
          muc: dong.map((d) => ({
            code: d.code.trim().toUpperCase(),
            quantity: Number(d.quantity || '1'),
          })),
        },
      });
      dieuHuong(`/yeu-cau/${kq.yeuCau.id}`);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Tạo yêu cầu thất bại.');
    } finally {
      datDangGui(false);
    }
  }

  const mau: MauYeuCau = MAU_YEU_CAU[type];
  const noiKhac = toLocationId === NOI_KHAC;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to="/yeu-cau">
            <ArrowLeft aria-hidden />
            Về danh sách yêu cầu
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Tạo yêu cầu · {mau.tieuDe}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{mau.tieuDe}</CardTitle>
          <CardDescription>
            {mau.moTa} Tạo xong ở trạng thái Nháp; bấm Gửi duyệt ở trang chi tiết thì người có
            quyền duyệt mới thấy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(su) => void gui(su)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="y-loai">Loại yêu cầu *</Label>
                <Select
                  id="y-loai"
                  required
                  value={type}
                  onChange={(su) => {
                    datType(su.target.value as LoaiLapDuoc);
                    // Đổi loại thì xoá nơi đến và hạn trả: mỗi loại có bộ ô
                    // riêng, giữ lại giá trị cũ dễ gửi đi thứ không áp dụng.
                    datToLocationId('');
                    datDestinationNote('');
                    datExpectedReturnAt('');
                  }}
                >
                  {LOAI_LAP_DUOC.map((l) => (
                    <option key={l.ma} value={l.ma}>
                      {l.nhan}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Thiết bị hỏng thì lập ở{' '}
                  <Link to="/bao-hong/moi" className="font-medium text-primary underline">
                    trang Báo hỏng
                  </Link>{' '}
                  — ở đó bắt buộc kèm ảnh và tự báo cho kho, vận hành, nhân sự.
                </p>
              </div>

              {mau.noiDen !== 'an' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="y-noi-den">
                    {mau.nhanNoiDen} {mau.noiDen === 'bat-buoc' ? '*' : '(không bắt buộc)'}
                  </Label>
                  <Select
                    id="y-noi-den"
                    required={mau.noiDen === 'bat-buoc'}
                    value={toLocationId}
                    onChange={(su) => datToLocationId(su.target.value)}
                  >
                    <option value="">— Chưa chọn —</option>
                    {diaDiem.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                    <option value={NOI_KHAC}>— Nơi khác, tự điền —</option>
                  </Select>
                  <p className="text-xs text-muted-foreground">{mau.giaiThichNoiDen}</p>
                </div>
              ) : null}

              {/*
                Ô tự điền chỉ hiện khi chọn "Nơi khác". Trước đây nó luôn hiện
                dưới tên "Ghi chú nơi đến" nên không ai hiểu khi nào thì dùng —
                giờ nó là đường chính thức để ghi nơi đến ngoài danh mục.
              */}
              {noiKhac ? (
                <div className="space-y-1.5">
                  <Label htmlFor="y-noi-tu-dien">Nơi đến — tự điền *</Label>
                  <Input
                    id="y-noi-tu-dien"
                    required
                    value={destinationNote}
                    onChange={(su) => datDestinationNote(su.target.value)}
                    placeholder="VD: Nhà thi đấu Cầu Giấy — giải ROBOG vòng khu vực"
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ghi rõ để kho biết giao đi đâu. Nơi dùng thường xuyên thì nên nhờ quản trị
                    thêm vào danh mục Điểm lưu trữ.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="y-ly-do">{mau.nhanLyDo} *</Label>
                <textarea
                  id="y-ly-do"
                  required
                  minLength={5}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  value={reason}
                  onChange={(su) => datReason(su.target.value)}
                  placeholder={mau.goiYLyDo}
                />
              </div>

              {mau.hanTra !== 'an' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="y-han-tra">
                    Thời gian dự kiến trả{' '}
                    {mau.hanTra === 'nen-co' ? '(nên điền)' : '(không bắt buộc)'}
                  </Label>
                  <Input
                    id="y-han-tra"
                    type="date"
                    value={expectedReturnAt}
                    onChange={(su) => datExpectedReturnAt(su.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{mau.giaiThichHanTra}</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{mau.nhanThietBi} *</Label>
                <NutQuetQR
                  nhan="Quét mã thêm dòng"
                  onQuetDuoc={(ma) => {
                    const chuanHoa = ma.trim().toUpperCase();
                    // Điền vào dòng trống đầu tiên, không có thì thêm dòng mới.
                    const viTri = muc.findIndex((d) => d.code.trim() === '');
                    datMuc((cu) =>
                      viTri >= 0
                        ? cu.map((d, j) =>
                            j === viTri ? { ...d, code: chuanHoa, ten: undefined, loi: undefined } : d,
                          )
                        : [...cu, { code: chuanHoa, quantity: '1' }],
                    );
                    void traMa(viTri >= 0 ? viTri : muc.length, chuanHoa);
                  }}
                />
              </div>

              <ul className="space-y-2">
                {muc.map((d, i) => (
                  <li key={i} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-44 flex-1 space-y-1">
                        <OGoiYMaThietBi
                          className="font-mono"
                          placeholder="Gõ vài ký tự để hiện gợi ý…"
                          giaTri={d.code}
                          onDoi={(v) =>
                            datMuc((cu) => cu.map((x, j) => (j === i ? { ...x, code: v } : x)))
                          }
                          onChot={(v) => void traMa(i, v)}
                          ariaLabel={`Mã thiết bị dòng ${i + 1}`}
                        />
                        {d.ten ? (
                          <p className="text-xs text-success-dam">{d.ten}</p>
                        ) : d.loi ? (
                          <div className="space-y-1">
                            <p className="text-xs text-destructive-dam">{d.loi}</p>
                            {/*
                              Mã không có trong kho là chuyện thường: linh kiện
                              mới về, thiết bị tặng, hàng chưa kịp vào sổ. Cho
                              thêm ngay tại đây thay vì bắt rời form — máy chủ
                              vẫn đòi ảnh nên không có gì vào sổ mà không ai
                              thấy mặt.
                            */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => datDongTaoNhanh(dongTaoNhanh === i ? null : i)}
                              aria-expanded={dongTaoNhanh === i}
                            >
                              <PackagePlus aria-hidden />
                              Thiết bị chưa có mã — thêm ngay
                            </Button>
                          </div>
                        ) : null}
                        {dongTaoNhanh === i ? (
                          <div className="mt-2">
                            <TaoNhanhThietBi
                              goiYTen=""
                              onHuy={() => datDongTaoNhanh(null)}
                              onTaoXong={(tb) => {
                                datMuc((cu) =>
                                  cu.map((x, j) =>
                                    j === i
                                      ? { ...x, code: tb.code, ten: tb.name, loi: undefined }
                                      : x,
                                  ),
                                );
                                datDongTaoNhanh(null);
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                      <Input
                        type="number"
                        min={1}
                        className="w-24"
                        value={d.quantity}
                        onChange={(su) =>
                          datMuc((cu) =>
                            cu.map((x, j) => (j === i ? { ...x, quantity: su.target.value } : x)),
                          )
                        }
                        aria-label={`Số lượng dòng ${i + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive-dam"
                        onClick={() => datMuc((cu) => cu.filter((_, j) => j !== i))}
                        disabled={muc.length === 1}
                        aria-label={`Bỏ dòng ${i + 1}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => datMuc((cu) => [...cu, { code: '', quantity: '1' }])}
              >
                <Plus aria-hidden />
                Thêm dòng
              </Button>

              {/*
                HÀNG LẺ tách thành phần riêng, KHÔNG trộn vào danh sách trên.
                Người ở kho biết rõ thứ mình cần là robot có mã hay là sách lẻ;
                tách hai phần thì mỗi phần chỉ hỏi đúng thứ nó cần — trên gõ mã,
                dưới tìm theo tên. Cả hai cùng đổ vào MỘT danh sách gửi lên, nên
                phía sau (duyệt → xuất → nhập) không phải biết gì về chuyện này.
              */}
              <div className="space-y-2 pt-2">
                <div>
                  <p className="text-sm font-medium">Hàng lẻ — chọn theo tên</p>
                  <p className="text-xs text-muted-foreground">
                    Sách, cờ, standee, ấn phẩm in… không dán mã lên từng cái. Chọn tên rồi sửa số
                    lượng ở danh sách trên; lấy ra bao nhiêu thì lúc trả hệ thống đối chiếu bấy nhiêu.
                  </p>
                </div>
                <OChonHangLe
                  locationId={undefined}
                  daThem={new Set(muc.map((d) => d.code.trim().toUpperCase()).filter(Boolean))}
                  onChon={(t) =>
                    datMuc((cu) => {
                      // Đã có trong phiếu thì thôi — tránh hai dòng cùng một mã,
                      // lúc duyệt sẽ không biết lấy số lượng của dòng nào.
                      if (cu.some((d) => d.code.trim().toUpperCase() === t.code)) return cu;
                      const trong = cu.findIndex((d) => d.code.trim() === '');
                      const dong = { code: t.code, quantity: '1', ten: t.name };
                      if (trong >= 0) return cu.map((d, j) => (j === trong ? dong : d));
                      return [...cu, dong];
                    })
                  }
                />
              </div>
            </div>

            {loi ? <Alert variant="destructive">{loi}</Alert> : null}

            <div className="flex gap-2">
              <Button type="submit" disabled={dangGui}>
                {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                Tạo yêu cầu
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/yeu-cau">Huỷ</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
