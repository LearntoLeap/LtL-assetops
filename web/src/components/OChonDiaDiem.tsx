import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { NHAN_LOAI_DIEM_LUU_TRU, type LoaiDiemLuuTru } from '@ltl/taisan-shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { goiApi, LoiApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { NoiDen, TrangDuLieu } from '@/lib/kieu';

/** Giá trị riêng của mục "+ Thêm điểm mới…" — không trùng id thật nào (id là cuid). */
const THEM_MOI = '__them_diem_moi__';

export interface LuaChonThem {
  /** Giá trị gửi đi khi chọn — KHÔNG trùng id điểm nào. */
  giaTri: string;
  nhan: string;
}

interface Props {
  id: string;
  nhan: string;
  giaTri: string;
  onDoi: (id: string) => void;
  /** Chỉ hiện các loại điểm này; bỏ trống = mọi loại. */
  loai?: ReadonlyArray<LoaiDiemLuuTru>;
  /** Bỏ bớt một điểm (vd trường gửi không được trùng trường nhận). */
  boDiem?: string | undefined;
  required?: boolean;
  /** Dòng đầu khi chưa chọn gì. */
  nhanTrong?: string;
  /** Lựa chọn đặc biệt ngoài danh sách điểm (vd "Hàng mới / từ bên ngoài"). */
  luaChonThem?: ReadonlyArray<LuaChonThem> | undefined;
  goiY?: string | undefined;
}

/**
 * Ô CHỌN ĐIỂM NHẬN / TRẢ kèm "+ Thêm điểm mới" ngay tại chỗ.
 *
 * Trước đây điểm chưa có trong danh mục thì chỉ có ô "Nơi khác, tự điền" — mà
 * phiếu chọn ô đó KHÔNG BAO GIỜ thực hiện được (máy chủ đòi nơi đến trong danh
 * mục). Giờ thêm điểm ngay trong form: ghi vào danh mục luôn, lần sau có sẵn,
 * và tự hiện ở mục Danh mục → Điểm nhận / trả để sửa sau.
 *
 * Kho văn phòng chỉ Quản trị / Vận hành thêm được (gắn tài khoản kho và GPS);
 * tài khoản trường không thêm điểm. Máy chủ kiểm lại cả hai điều này.
 */
export function OChonDiaDiem({
  id,
  nhan,
  giaTri,
  onDoi,
  loai,
  boDiem,
  required,
  nhanTrong = '— Chưa chọn —',
  luaChonThem,
  goiY,
}: Props) {
  const { nguoiDung } = useAuth();
  const [muc, datMuc] = useState<NoiDen[]>([]);
  const [dangThem, datDangThem] = useState(false);
  const [tenMoi, datTenMoi] = useState('');
  const [loaiMoi, datLoaiMoi] = useState<LoaiDiemLuuTru | ''>('');
  const [diaChiMoi, datDiaChiMoi] = useState('');
  const [dangLuu, datDangLuu] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const oNhap = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let conDung = true;
    async function tai(): Promise<void> {
      try {
        const kq = await goiApi<TrangDuLieu<NoiDen>>('/api/dia-diem/noi-den?chiHoatDong=true');
        if (conDung) datMuc(kq.muc);
      } catch (e) {
        if (conDung) datLoi(e instanceof LoiApi ? e.message : 'Không tải được danh sách điểm.');
      }
    }
    void tai();
    return () => {
      conDung = false;
    };
  }, []);

  useEffect(() => {
    if (dangThem) oNhap.current?.focus();
  }, [dangThem]);

  const vaiTro = nguoiDung?.role;
  const loaiThemDuoc = (loai && loai.length > 0
    ? loai
    : (['DIEM_TRUONG', 'DOI_TAC_MUON', 'KHO_SU_KIEN', 'KHO_VAN_PHONG'] as const)
  ).filter((l) => l !== 'KHO_VAN_PHONG' || vaiTro === 'ADMIN' || vaiTro === 'VAN_HANH');
  const duocThem = vaiTro !== undefined && vaiTro !== 'TRUONG' && loaiThemDuoc.length > 0;

  const hien = muc.filter(
    (d) => (!loai || loai.length === 0 || loai.includes(d.type)) && d.id !== boDiem,
  );

  async function luu(): Promise<void> {
    const ten = tenMoi.trim();
    const loaiChon = loaiMoi || loaiThemDuoc[0];
    if (ten.length < 2 || !loaiChon) return;
    datLoi(null);
    datDangLuu(true);
    try {
      // Không gửi mã: máy chủ tự sinh từ loại + tên.
      const kq = await goiApi<{ ok: true; diaDiem: NoiDen }>('/api/dia-diem', {
        method: 'POST',
        than: { name: ten, type: loaiChon, ...(diaChiMoi.trim() ? { address: diaChiMoi.trim() } : {}) },
      });
      datMuc((cu) => [...cu, { id: kq.diaDiem.id, code: kq.diaDiem.code, name: kq.diaDiem.name, type: kq.diaDiem.type }]);
      onDoi(kq.diaDiem.id);
      datTenMoi('');
      datDiaChiMoi('');
      datDangThem(false);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không thêm được điểm mới.');
    } finally {
      datDangLuu(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{nhan}</Label>
      <Select
        id={id}
        required={required}
        value={giaTri}
        onChange={(su) => {
          if (su.target.value === THEM_MOI) {
            datDangThem(true);
            return;
          }
          onDoi(su.target.value);
        }}
      >
        <option value="">{nhanTrong}</option>
        {luaChonThem?.map((l) => (
          <option key={l.giaTri} value={l.giaTri}>
            {l.nhan}
          </option>
        ))}
        {hien.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {loai && loai.length === 1 ? '' : ` — ${NHAN_LOAI_DIEM_LUU_TRU[d.type]}`}
          </option>
        ))}
        {duocThem ? <option value={THEM_MOI}>+ Thêm điểm mới…</option> : null}
      </Select>
      {goiY ? <p className="text-xs text-muted-foreground">{goiY}</p> : null}

      {dangThem ? (
        <div className="space-y-2 rounded-md border border-dashed p-3">
          <p className="text-xs font-medium">Thêm điểm mới vào danh mục</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              ref={oNhap}
              value={tenMoi}
              onChange={(su) => datTenMoi(su.target.value)}
              placeholder="Tên điểm, vd Trường Tiểu học Kim Liên"
              maxLength={191}
              aria-label="Tên điểm mới"
            />
            {loaiThemDuoc.length > 1 ? (
              <Select
                value={loaiMoi || loaiThemDuoc[0]}
                onChange={(su) => datLoaiMoi(su.target.value as LoaiDiemLuuTru)}
                aria-label="Loại điểm mới"
              >
                {loaiThemDuoc.map((l) => (
                  <option key={l} value={l}>
                    {NHAN_LOAI_DIEM_LUU_TRU[l]}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="self-center text-xs text-muted-foreground">
                Loại: {loaiThemDuoc[0] ? NHAN_LOAI_DIEM_LUU_TRU[loaiThemDuoc[0]] : '—'}
              </p>
            )}
            <Input
              className="sm:col-span-2"
              value={diaChiMoi}
              onChange={(su) => datDiaChiMoi(su.target.value)}
              placeholder="Địa chỉ (không bắt buộc) — in lên biên bản"
              maxLength={2000}
              aria-label="Địa chỉ điểm mới"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={dangLuu || tenMoi.trim().length < 2}
              onClick={() => void luu()}
            >
              {dangLuu ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              Lưu điểm
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                datDangThem(false);
                datLoi(null);
              }}
            >
              <X aria-hidden />
              Thôi
            </Button>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Plus className="size-3" aria-hidden />
            Mã điểm tự sinh. Sửa thêm địa chỉ, người liên hệ ở Danh mục → Điểm nhận / trả.
          </p>
        </div>
      ) : null}
      {loi ? <p className="text-xs text-destructive-dam">{loi}</p> : null}
    </div>
  );
}
