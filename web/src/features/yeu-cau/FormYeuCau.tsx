import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { DS_LOAI_YEU_CAU, type LoaiYeuCau } from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { NutQuetQR } from '@/components/QuetQR';
import { goiApi, LoiApi } from '@/lib/api';
import type { DiaDiem, ThietBi, TrangDuLieu, YeuCau } from '@/lib/kieu';

/** Loại yêu cầu bắt buộc chọn nơi đến trong danh mục — khớp kiểm tra ở server. */
const CAN_NOI_DEN: ReadonlySet<LoaiYeuCau> = new Set<LoaiYeuCau>([
  'XUAT_KHO',
  'PHAN_BO_VE_TRUONG',
  'LUAN_CHUYEN_TRUONG',
]);

interface DongMuc {
  code: string;
  quantity: string;
  /** Tên thiết bị tra được, để người dùng thấy mình chọn đúng cái. */
  ten?: string | undefined;
  loi?: string | undefined;
}

export function FormYeuCau() {
  const dieuHuong = useNavigate();
  const [type, datType] = useState<LoaiYeuCau>('CHO_MUON');
  const [reason, datReason] = useState('');
  const [toLocationId, datToLocationId] = useState('');
  const [destinationNote, datDestinationNote] = useState('');
  const [expectedReturnAt, datExpectedReturnAt] = useState('');
  const [muc, datMuc] = useState<DongMuc[]>([{ code: '', quantity: '1' }]);
  const [diaDiem, datDiaDiem] = useState<DiaDiem[]>([]);
  const [loi, datLoi] = useState<string | null>(null);
  const [dangGui, datDangGui] = useState(false);

  useEffect(() => {
    async function tai(): Promise<void> {
      try {
        const kq = await goiApi<TrangDuLieu<DiaDiem>>('/api/dia-diem?chiHoatDong=true');
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
          ...(toLocationId ? { toLocationId } : {}),
          ...(destinationNote.trim() ? { destinationNote } : {}),
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

  const canNoiDen = CAN_NOI_DEN.has(type);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link to="/yeu-cau">
            <ArrowLeft aria-hidden />
            Về danh sách yêu cầu
          </Link>
        </Button>
        <h1 className="text-xl font-semibold sm:text-2xl">Tạo yêu cầu</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nội dung yêu cầu</CardTitle>
          <CardDescription>
            Tạo xong sẽ ở trạng thái Nháp. Bấm Gửi duyệt ở trang chi tiết thì người có quyền duyệt
            mới thấy.
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
                  onChange={(su) => datType(su.target.value as LoaiYeuCau)}
                >
                  {DS_LOAI_YEU_CAU.map((l) => (
                    <option key={l.ma} value={l.ma}>
                      {l.nhan}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="y-noi-den">
                  Nơi đến {canNoiDen ? '*' : '(không bắt buộc)'}
                </Label>
                <Select
                  id="y-noi-den"
                  required={canNoiDen}
                  value={toLocationId}
                  onChange={(su) => datToLocationId(su.target.value)}
                >
                  <option value="">— Chưa chọn —</option>
                  {diaDiem.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
                {canNoiDen ? (
                  <p className="text-xs text-muted-foreground">
                    Loại yêu cầu này bắt buộc có nơi đến thì mới gửi duyệt được.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Cho nhân sự mượn thì để trống — thiết bị vẫn thuộc kho, chỉ gắn người giữ.
                  </p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="y-ly-do">Lý do *</Label>
                <textarea
                  id="y-ly-do"
                  required
                  minLength={5}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  value={reason}
                  onChange={(su) => datReason(su.target.value)}
                  placeholder="VD: Mượn laptop soạn học liệu cho khối 3, dùng trong 2 tuần."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="y-han-tra">Thời gian dự kiến trả</Label>
                <Input
                  id="y-han-tra"
                  type="date"
                  value={expectedReturnAt}
                  onChange={(su) => datExpectedReturnAt(su.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="y-ghi-noi-den">Ghi chú nơi đến</Label>
                <Input
                  id="y-ghi-noi-den"
                  value={destinationNote}
                  onChange={(su) => datDestinationNote(su.target.value)}
                  placeholder="VD: Sự kiện lẻ tại nhà thi đấu"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Thiết bị *</Label>
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
                        <Input
                          className="font-mono"
                          placeholder="Mã thiết bị, VD LTL-RB-0001"
                          value={d.code}
                          spellCheck={false}
                          onChange={(su) =>
                            datMuc((cu) =>
                              cu.map((x, j) => (j === i ? { ...x, code: su.target.value } : x)),
                            )
                          }
                          onBlur={(su) => void traMa(i, su.target.value)}
                          aria-label={`Mã thiết bị dòng ${i + 1}`}
                        />
                        {d.ten ? (
                          <p className="text-xs text-success-dam">{d.ten}</p>
                        ) : d.loi ? (
                          <p className="text-xs text-destructive-dam">{d.loi}</p>
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
