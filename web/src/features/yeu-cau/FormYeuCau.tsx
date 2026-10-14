import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, PackagePlus, Plus, Save, Trash2 } from 'lucide-react';
import { NHAN_LOAI_YEU_CAU } from '@ltl/taisan-shared';
import {
  LOAI_LAP_MOI,
  MAU_YEU_CAU,
  NGUON_NGOAI,
  NGUON_NHAN_SU,
  type LoaiLapMoi,
  type MauYeuCau,
} from './mau-yeu-cau';
import { TaoNhanhThietBi } from './TaoNhanhThietBi';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { NutQuetQR } from '@/components/QuetQR';
import { OChonDiaDiem } from '@/components/OChonDiaDiem';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { OGoiYMaThietBi } from '@/components/OGoiYMaThietBi';
import { OChonHangLe } from './OChonHangLe';
import type { ThietBi, YeuCau } from '@/lib/kieu';

interface DongMuc {
  code: string;
  quantity: string;
  /** Tên thiết bị tra được, để người dùng thấy mình chọn đúng cái. */
  ten?: string | undefined;
  loi?: string | undefined;
  /** Dòng chọn từ ô hàng lẻ — chỉ để hiện nhãn, máy chủ tự biết kiểu quản lý. */
  hangLe?: boolean;
}

const LOP_O_CHU =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function laLoaiLapMoi(v: string | null): v is LoaiLapMoi {
  return v !== null && (LOAI_LAP_MOI as ReadonlyArray<string>).includes(v);
}

/** Giá trị ô "Nhận từ" là một điểm thật trong danh mục (không phải lựa chọn đặc biệt). */
function laDiemThat(v: string): boolean {
  return v !== '' && v !== NGUON_NGOAI && v !== NGUON_NHAN_SU;
}

export function FormYeuCau() {
  const dieuHuong = useNavigate();
  const [thamSo] = useSearchParams();
  const { nguoiDung } = useAuth();
  const laTruong = nguoiDung?.role === 'TRUONG';
  const truongCuaToi = laTruong ? (nguoiDung?.locationId ?? '') : '';

  const loaiTuUrl = thamSo.get('loai');
  const [type, datType] = useState<LoaiLapMoi>(
    laLoaiLapMoi(loaiTuUrl) && !(laTruong && loaiTuUrl === 'PHAN_BO_VE_TRUONG')
      ? loaiTuUrl
      : 'CHO_MUON',
  );
  /** Dòng đang mở bảng tạo nhanh thiết bị; null = không mở. */
  const [dongTaoNhanh, datDongTaoNhanh] = useState<number | null>(null);
  const [moThemHangLe, datMoThemHangLe] = useState(false);
  const [reason, datReason] = useState('');
  const [note, datNote] = useState('');
  const [fromLocationId, datFromLocationId] = useState('');
  const [toLocationId, datToLocationId] = useState('');
  const [expectedReturnAt, datExpectedReturnAt] = useState('');
  const [muc, datMuc] = useState<DongMuc[]>([{ code: '', quantity: '1' }]);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);

  const mau: MauYeuCau = MAU_YEU_CAU[type];
  const laNhap = mau.chieu === 'nhap';

  /*
   * Tài khoản trường: NƠI ĐI LUÔN LÀ TRƯỜNG MÌNH (trả về kho, luân chuyển, xuất
   * hay cho mượn từ trường) — trường chỉ làm việc với hàng của trường. Máy chủ
   * chặn nơi đi khác; ở đây khoá ô cho khỏi chọn nhầm.
   */
  useEffect(() => {
    if (laTruong && truongCuaToi) datFromLocationId(truongCuaToi);
  }, [type, laTruong, truongCuaToi]);
  /** Phân bổ về trường do Quản trị / Vận hành / Kho lập — trường là bên nhận. */
  const loaiDuocLap = laTruong
    ? LOAI_LAP_MOI.filter((l) => l !== 'PHAN_BO_VE_TRUONG')
    : LOAI_LAP_MOI;

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

  /** Thêm một mã vào phiếu; đã có thì thôi — hai dòng cùng mã thì không biết lấy số nào. */
  function themDong(dong: DongMuc): void {
    datMuc((cu) => {
      if (cu.some((d) => d.code.trim().toUpperCase() === dong.code)) return cu;
      const trong = cu.findIndex((d) => d.code.trim() === '');
      if (trong >= 0) return cu.map((d, j) => (j === trong ? dong : d));
      return [...cu, dong];
    });
  }

  /** Tạo xong thì người lập làm luôn bước chụp ảnh — không còn chờ duyệt. */
  function noiDenSauKhiTao(yc: YeuCau): string {
    // Tài khoản trường chỉ tự thực hiện được khi hàng đi từ chính trường mình;
    // còn lại (vd xin kho phân bổ về) thì kho làm, người lập xem ở trang chi tiết.
    if (laTruong && yc.fromLocation?.id !== truongCuaToi) return `/yeu-cau/${yc.id}`;
    // Nhập "hàng mới" hay "nhân sự trả lại" không lưu thành điểm trên phiếu —
    // truyền sang màn hình kho để chọn sẵn đúng nguồn.
    const nguon =
      laNhap && fromLocationId === NGUON_NGOAI
        ? '?nguon=NGOAI'
        : laNhap && fromLocationId === NGUON_NHAN_SU
          ? '?nguon=NHAN_SU'
          : '';
    return `/kho/${mau.chieu}/${yc.id}${nguon}`;
  }

  async function gui(su: FormEvent): Promise<void> {
    su.preventDefault();
    datLoi(null);
    const dong = muc.filter((d) => d.code.trim() !== '');
    if (dong.length === 0) {
      datLoi('Yêu cầu phải có ít nhất một thiết bị.');
      return;
    }
    if (mau.noiDi === 'bat-buoc' && !fromLocationId) {
      datLoi(`Chưa chọn ${mau.nhanNoiDi.toLowerCase()}.`);
      return;
    }
    if (mau.noiDen === 'bat-buoc' && !toLocationId) {
      datLoi(`Chưa chọn ${mau.nhanNoiDen.toLowerCase()}.`);
      return;
    }
    datDangGui(true);
    try {
      const kq = await goiApi<{ ok: true; yeuCau: YeuCau }>('/api/yeu-cau', {
        method: 'POST',
        than: {
          type,
          reason,
          // "Hàng mới / nhân sự trả" không phải điểm trong danh mục: để trống
          // nơi đi, máy chủ ghi lượt nhập từ ngoài vào / từ người mượn.
          ...(mau.noiDi !== 'an' && laDiemThat(fromLocationId) ? { fromLocationId } : {}),
          ...(mau.noiDen !== 'an' && toLocationId ? { toLocationId } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(mau.hanTra !== 'an' && expectedReturnAt
            ? { expectedReturnAt: new Date(expectedReturnAt).toISOString() }
            : {}),
          muc: dong.map((d) => ({
            code: d.code.trim().toUpperCase(),
            quantity: Number(d.quantity || '1'),
          })),
        },
      });
      dieuHuong(noiDenSauKhiTao(kq.yeuCau));
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Tạo yêu cầu thất bại.');
    } finally {
      datDangGui(false);
    }
  }

  // Ô hàng lẻ: lấy ra thì chỉ hiện thứ CÒN LẤY ĐƯỢC ở nơi lấy; nhập về thì hiện
  // mọi mã, kể cả đang hết — hết hàng chính là lúc cần nhập thêm.
  const diemLayHangLe = !laNhap && laDiemThat(fromLocationId) ? fromLocationId : undefined;
  const khoChoHangMoi = laNhap ? toLocationId : diemLayHangLe;
  const duocThemThietBi = !laTruong;

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
            {mau.moTa} Tạo xong là chuyển ngay sang bước chụp ảnh xác nhận{' '}
            {laNhap ? 'nhập' : 'xuất'} kho, không phải chờ duyệt. Biên bản bàn giao tự lập, quản
            trị được báo tự động.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(su) => void gui(su)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="y-loai">Loại yêu cầu *</Label>
                <Select
                  id="y-loai"
                  required
                  value={type}
                  onChange={(su) => {
                    datType(su.target.value as LoaiLapMoi);
                    // Đổi loại thì xoá nơi đi / nơi đến và hạn trả: mỗi loại có
                    // bộ ô riêng, giữ giá trị cũ dễ gửi đi thứ không áp dụng.
                    datFromLocationId('');
                    datToLocationId('');
                    datExpectedReturnAt('');
                    datMoThemHangLe(false);
                  }}
                >
                  {loaiDuocLap.map((l) => (
                    <option key={l} value={l}>
                      {NHAN_LOAI_YEU_CAU[l]}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Hàng trả về kho cũng lập ở loại Nhập kho. Thiết bị hỏng thì lập ở{' '}
                  <Link to="/bao-hong/moi" className="font-medium text-primary underline">
                    trang Báo hỏng
                  </Link>{' '}
                  — ở đó bắt buộc kèm ảnh và tự báo cho kho, vận hành, nhân sự.
                </p>
              </div>

              {mau.noiDi !== 'an' ? (
                <OChonDiaDiem
                  key={`di-${type}`}
                  id="y-noi-di"
                  nhan={`${mau.nhanNoiDi} ${mau.noiDi === 'bat-buoc' ? '*' : '(không bắt buộc)'}`}
                  giaTri={fromLocationId}
                  onDoi={datFromLocationId}
                  loai={mau.loaiNoiDi}
                  boDiem={toLocationId || undefined}
                  required={mau.noiDi === 'bat-buoc'}
                  nhanTrong={mau.noiDi === 'bat-buoc' ? '— Chưa chọn —' : '— Để hệ thống tự chọn —'}
                  luaChonThem={
                    laNhap
                      ? [
                          { giaTri: NGUON_NGOAI, nhan: 'Hàng mới / từ bên ngoài (mua, tặng…)' },
                          { giaTri: NGUON_NHAN_SU, nhan: 'Nhân sự trả lại hàng đã mượn' },
                        ]
                      : undefined
                  }
                  goiY={laTruong ? 'Tài khoản trường lập phiếu cho hàng đi từ chính trường mình.' : mau.giaiThichNoiDi}
                  chiDiem={laTruong ? truongCuaToi : undefined}
                />
              ) : null}

              {mau.noiDen !== 'an' ? (
                <OChonDiaDiem
                  key={`den-${type}`}
                  id="y-noi-den"
                  nhan={`${mau.nhanNoiDen} ${mau.noiDen === 'bat-buoc' ? '*' : '(không bắt buộc)'}`}
                  giaTri={toLocationId}
                  onDoi={datToLocationId}
                  loai={mau.loaiNoiDen}
                  boDiem={laDiemThat(fromLocationId) ? fromLocationId : undefined}
                  required={mau.noiDen === 'bat-buoc'}
                  goiY={mau.giaiThichNoiDen}
                />
              ) : null}

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="y-ly-do">{mau.nhanLyDo} *</Label>
                <textarea
                  id="y-ly-do"
                  required
                  minLength={5}
                  rows={3}
                  className={LOP_O_CHU}
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

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="y-ghi-chu">Ghi chú (không bắt buộc)</Label>
                <textarea
                  id="y-ghi-chu"
                  rows={2}
                  maxLength={2000}
                  className={LOP_O_CHU}
                  value={note}
                  onChange={(su) => datNote(su.target.value)}
                  placeholder="VD: Kho văn phòng thiếu 20 quyển, mượn thêm 20 quyển từ Kho Ngoại Giao Đoàn."
                />
                <p className="text-xs text-muted-foreground">
                  Ghi lại nếu phải mượn thêm thiết bị từ kho khác, hoặc điều gì kho cần biết. Ghi
                  chú in kèm phiếu, không làm đổi số lượng.
                </p>
              </div>
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
                          <p className="text-xs text-success-dam">
                            {d.ten}
                            {d.hangLe ? ' · hàng lẻ' : ''}
                          </p>
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
                            {duocThemThietBi ? (
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
                            ) : null}
                          </div>
                        ) : null}
                        {dongTaoNhanh === i ? (
                          <div className="mt-2">
                            <TaoNhanhThietBi
                              goiYTen=""
                              khoMacDinh={khoChoHangMoi}
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
                dưới tìm theo tên. Cả hai cùng đổ vào MỘT danh sách gửi lên.
              */}
              <div className="space-y-2 pt-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Hàng lẻ — chọn theo tên</p>
                    <p className="text-xs text-muted-foreground">
                      Sách, cờ, standee, ấn phẩm in… không dán mã lên từng cái. Chọn tên rồi sửa số
                      lượng ở danh sách trên.
                      {laNhap
                        ? ' Mã đang hết hàng vẫn chọn được để nhập thêm.'
                        : ' Số "Lấy được" đã trừ hàng đang trên đường đi.'}
                    </p>
                  </div>
                  {duocThemThietBi ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => datMoThemHangLe((v) => !v)}
                      aria-expanded={moThemHangLe}
                    >
                      <PackagePlus aria-hidden />
                      Thêm hàng lẻ mới
                    </Button>
                  ) : null}
                </div>
                {moThemHangLe ? (
                  <TaoNhanhThietBi
                    hangLe={laNhap ? 'danh-muc' : 'co-ton'}
                    khoMacDinh={khoChoHangMoi}
                    onHuy={() => datMoThemHangLe(false)}
                    onDaCo={(t) => {
                      themDong({ code: t.code, quantity: '1', ten: t.name, hangLe: true });
                      datMoThemHangLe(false);
                    }}
                    onTaoXong={(tb, soLuongNhap) => {
                      themDong({
                        code: tb.code,
                        quantity: String(Math.max(1, soLuongNhap)),
                        ten: tb.name,
                        hangLe: true,
                      });
                      datMoThemHangLe(false);
                    }}
                  />
                ) : null}
                <OChonHangLe
                  locationId={diemLayHangLe}
                  cheDoNhap={laNhap}
                  daThem={new Set(muc.map((d) => d.code.trim().toUpperCase()).filter(Boolean))}
                  onChon={(t) => themDong({ code: t.code, quantity: '1', ten: t.name, hangLe: true })}
                />
              </div>
            </div>

            {loi ? <Alert variant="destructive">{loi}</Alert> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={dangGui}>
                {dangGui ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
                Tạo &amp; chụp ảnh {laNhap ? 'nhập' : 'xuất'} kho
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
