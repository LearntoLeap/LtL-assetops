import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileSignature,
  Image as ImageIcon,
  LogOut,
  MapPin,
  PackageCheck,
  PackageOpen,
  PackageX,
  QrCode,
  Search,
  Settings,
  TimerOff,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import {
  DS_ANH_NEN_KIOSK,
  NHAN_LOAI_YEU_CAU,
  NHAN_TINH_TRANG,
  NHAN_TRANG_THAI_YEU_CAU,
  type AnhNenKiosk,
} from '@ltl/taisan-shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChupAnh } from '@/components/ChupAnh';
import { NutQuetQR } from '@/components/QuetQR';
import { goiApi, LoiApi } from '@/lib/api';
import { docAnh, type AnhDaTai } from '@/lib/anh';
import { useAuth } from '@/lib/auth';
import { so, thuNgayDayDu } from '@/lib/bieu-do';
import { ngayGio } from '@/lib/dinh-dang';
import type { CaiDatKiosk, SoLieuNhanh, ThietBi, ViecChoXuLy } from '@/lib/kieu';
import { SU_KIEN, useRealtime } from '@/hooks/useRealtime';
import { NEN_KIOSK, NEN_MAC_DINH } from './mau-nen';
import { MatRobot, RobotNen } from './RobotTrangTri';

type ThietBiTraCuu = Pick<ThietBi, 'id' | 'code' | 'name' | 'condition'> & {
  category: { name: string };
  currentLocation: { name: string } | null;
};

const O_MEN = 'rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm';

/** Giữ màn hình không ngủ. Trình duyệt chưa hỗ trợ thì bỏ qua, không báo lỗi. */
function useChongNguoiMan(): void {
  useEffect(() => {
    let khoa: WakeLockSentinel | null = null;
    let conHieuLuc = true;

    async function xin(): Promise<void> {
      try {
        if (!('wakeLock' in navigator)) return;
        khoa = await navigator.wakeLock.request('screen');
      } catch {
        // Người dùng từ chối hoặc pin yếu — màn hình vẫn dùng được bình thường.
      }
    }
    // Khoá bị nhả khi tab chuyển sang nền, nên xin lại lúc quay về.
    function khiHien(): void {
      if (document.visibilityState === 'visible' && conHieuLuc) void xin();
    }

    void xin();
    document.addEventListener('visibilitychange', khiHien);
    return () => {
      conHieuLuc = false;
      document.removeEventListener('visibilitychange', khiHien);
      void khoa?.release().catch(() => undefined);
    };
  }, []);
}

function DongHo() {
  const [bayGio, datBayGio] = useState(() => new Date());
  useEffect(() => {
    const h = window.setInterval(() => datBayGio(new Date()), 1000);
    return () => window.clearInterval(h);
  }, []);
  const gio = String(bayGio.getHours()).padStart(2, '0');
  const phut = String(bayGio.getMinutes()).padStart(2, '0');
  const giay = String(bayGio.getSeconds()).padStart(2, '0');
  return (
    <div className="flex items-center gap-4">
      {/*
        Đồng hồ có dấu hiệu riêng: mặt robot + mặt đồng hồ, để người đứng cách
        màn hình vài mét nhận ra ngay đây là khu vực giờ, không phải một con số
        thống kê nào khác.
      */}
      <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-sky-400/20 text-sky-200 ring-1 ring-inset ring-sky-300/40 sm:size-[4.5rem]">
        <MatRobot canh={38} />
      </span>
      <div>
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-sky-200/80">
          <Clock className="size-3.5" aria-hidden />
          Giờ kho
        </p>
        <p className="text-[clamp(2.5rem,7.5vw,5rem)] font-semibold leading-none tracking-tight tabular-nums">
          {gio}:{phut}
          <span className="ml-2 text-[0.38em] font-normal text-white/60 tabular-nums">{giay}</span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-base text-white/80 sm:text-lg">
          <CalendarDays className="size-4" aria-hidden />
          {thuNgayDayDu(bayGio)}
        </p>
      </div>
    </div>
  );
}

function OThongKe({
  nhan,
  gia,
  phu,
  icon: Icon,
  canhBao,
}: {
  nhan: string;
  gia: number;
  /** Dòng nhỏ dưới con số, ví dụ "bộ · 1.850 hàng lẻ". */
  phu?: string;
  icon: typeof Boxes;
  canhBao?: boolean;
}) {
  const doi = canhBao && gia > 0;
  return (
    <div className={`${O_MEN} flex items-center gap-3 px-4 py-3`}>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${
          doi ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/70'
        }`}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        {/*
          KHÔNG truncate: ở 390px ô chỉ rộng ~150px nên "Đơn vị tại kho" bị cắt
          thành "ĐƠN VỊ TẠI ..." — người đọc mất luôn từ quan trọng nhất. Cho
          xuống dòng thì ô cao thêm một dòng nhưng đọc được đủ chữ.
        */}
        <span className="block text-[0.7rem] uppercase leading-tight tracking-wide text-white/70">
          {nhan}
        </span>
        <span className={`block text-2xl font-semibold leading-tight ${doi ? 'text-amber-300' : ''}`}>
          {so(gia)}
        </span>
        {phu ? (
          <span className="block text-[0.7rem] leading-tight text-white/70">{phu}</span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Các ô chức năng lớn. Mỗi ô có BIỂU TƯỢNG VÀ MÀU RIÊNG thay vì cùng một màu
 * trắng: người ở kho dùng máy này cả ngày, nhận ô theo màu nhanh hơn nhiều so
 * với đọc chữ, nhất là khi đứng cách màn hình một hai mét.
 */
const O_LON: ReadonlyArray<{
  nhan: string;
  phu: string;
  den: string;
  icon: typeof PackageOpen;
  mau: string;
}> = [
  {
    nhan: 'Xuất kho',
    phu: 'Yêu cầu đã duyệt',
    den: '/yeu-cau?status=DA_DUYET',
    icon: PackageOpen,
    mau: 'bg-emerald-400/20 text-emerald-200 ring-emerald-300/40',
  },
  {
    nhan: 'Nhập kho',
    phu: 'Nhận hàng về',
    den: '/yeu-cau?status=DA_DUYET&type=NHAP_KHO',
    icon: PackageCheck,
    mau: 'bg-sky-400/20 text-sky-200 ring-sky-300/40',
  },
  {
    nhan: 'Lấy linh kiện',
    phu: 'Thay cho báo hỏng',
    den: '/linh-kien',
    icon: Wrench,
    mau: 'bg-violet-400/20 text-violet-200 ring-violet-300/40',
  },
  {
    nhan: 'Báo hỏng',
    phu: 'Chụp ảnh chỗ hỏng',
    den: '/bao-hong/moi',
    icon: AlertTriangle,
    mau: 'bg-amber-400/20 text-amber-200 ring-amber-300/40',
  },
  {
    nhan: 'Kiểm kê',
    phu: 'Đợt đang mở',
    den: '/kiem-ke',
    icon: ClipboardCheck,
    mau: 'bg-teal-400/20 text-teal-200 ring-teal-300/40',
  },
  {
    nhan: 'Tra cứu thiết bị',
    phu: 'Tìm theo mã, tên',
    den: '/thiet-bi',
    icon: Search,
    mau: 'bg-indigo-400/20 text-indigo-200 ring-indigo-300/40',
  },
  {
    nhan: 'In biên bản',
    phu: 'BBBG khổ A4',
    den: '/bbbg',
    icon: FileSignature,
    mau: 'bg-rose-400/20 text-rose-200 ring-rose-300/40',
  },
];

/**
 * MÀN HÌNH KHO (KIOSK) — máy đặt cố định tại kho, chạy liên tục.
 *
 * Thiết kế cho ngón tay và cho người đứng cách màn hình một hai mét: ô chạm tối
 * thiểu 96px, chữ lớn, tương phản cao. Trang nằm NGOÀI bố cục ứng dụng để dùng
 * hết màn hình, không có thanh menu chen ngang.
 *
 * Khoá vị trí GPS hiện TẮT cho mọi kho theo quyết định của LtL (GPS trong nhà
 * lệch 50-200m nên chặn oan nhiều hơn chặn đúng). Server vẫn ghi nhật ký mọi
 * lần đăng nhập kèm toạ độ và khoảng cách thật, và ADMIN bật lại được từng kho
 * ở Thêm → Khoá vị trí kho.
 */
export function ManHinhKiosk() {
  const { nguoiDung, dangXuat } = useAuth();
  const dieuHuong = useNavigate();
  useChongNguoiMan();

  const [soLieu, datSoLieu] = useState<SoLieuNhanh | null>(null);
  const [viec, datViec] = useState<ViecChoXuLy | null>(null);
  const [loi, datLoi] = useState<string | null>(null);

  const [nenKhoa, datNenKhoa] = useState<AnhNenKiosk | null>(null);
  const [nenAnhId, datNenAnhId] = useState<string | null>(null);
  const [nenAnhUrl, datNenAnhUrl] = useState<string | null>(null);
  const [moDoiNen, datMoDoiNen] = useState(false);
  const [anhTai, datAnhTai] = useState<AnhDaTai[]>([]);

  const [maTra, datMaTra] = useState('');
  const [ketQuaTra, datKetQuaTra] = useState<ThietBiTraCuu | null>(null);
  const [loiTra, datLoiTra] = useState<string | null>(null);

  const tai = useCallback(async () => {
    try {
      const [tk, cv] = await Promise.all([
        goiApi<{ ok: true; soLieu: SoLieuNhanh }>('/api/kiosk/thong-ke'),
        goiApi<ViecChoXuLy>('/api/kiosk/cho-xu-ly'),
      ]);
      datSoLieu(tk.soLieu);
      datViec(cv);
      datLoi(null);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không tải được số liệu kho.');
    }
  }, []);

  useEffect(() => {
    void tai();
  }, [tai]);

  // Dải thống kê và danh sách việc cập nhật theo tín hiệu realtime; vẫn hẹn
  // tải lại mỗi 2 phút để màn hình treo cả ngày không bị lệch nếu mất tín hiệu.
  useRealtime(
    [SU_KIEN.KHO_DOI, SU_KIEN.YEU_CAU_MOI, SU_KIEN.YEU_CAU_DOI, SU_KIEN.CANH_BAO_MOI],
    () => {
      void tai();
    },
  );
  useEffect(() => {
    const h = window.setInterval(() => void tai(), 120_000);
    return () => window.clearInterval(h);
  }, [tai]);

  useEffect(() => {
    goiApi<{ ok: true; caiDat: CaiDatKiosk }>('/api/kiosk/cai-dat')
      .then((kq) => {
        datNenKhoa(kq.caiDat.backgroundKey);
        datNenAnhId(kq.caiDat.backgroundPhotoId);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!nenAnhId) {
      datNenAnhUrl(null);
      return;
    }
    let conHieuLuc = true;
    docAnh(nenAnhId)
      .then((u) => {
        if (conHieuLuc) datNenAnhUrl(u);
      })
      .catch(() => undefined);
    return () => {
      conHieuLuc = false;
    };
  }, [nenAnhId]);

  async function luuNen(than: { backgroundKey?: AnhNenKiosk | null; backgroundPhotoId?: string | null }): Promise<void> {
    try {
      const kq = await goiApi<{ ok: true; caiDat: CaiDatKiosk }>('/api/kiosk/cai-dat', {
        method: 'PUT',
        than,
      });
      datNenKhoa(kq.caiDat.backgroundKey);
      datNenAnhId(kq.caiDat.backgroundPhotoId);
      datAnhTai([]);
      datMoDoiNen(false);
    } catch (e) {
      datLoi(e instanceof LoiApi ? e.message : 'Không lưu được ảnh nền.');
    }
  }

  async function traCuu(ma: string): Promise<void> {
    const sach = ma.trim().toUpperCase();
    datMaTra(sach);
    datKetQuaTra(null);
    datLoiTra(null);
    if (sach.length < 3) return;
    try {
      const kq = await goiApi<{ ok: true; thietBi: ThietBiTraCuu }>(
        `/api/thiet-bi/tra-cuu/${encodeURIComponent(sach)}`,
      );
      datKetQuaTra(kq.thietBi);
    } catch (e) {
      datLoiTra(e instanceof LoiApi ? e.message : 'Không tra cứu được mã.');
    }
  }

  async function thoat(): Promise<void> {
    await dangXuat();
    dieuHuong('/dang-nhap', { replace: true });
  }

  const nen = nenAnhUrl
    ? { backgroundImage: `url(${nenAnhUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: NEN_KIOSK[nenKhoa ?? NEN_MAC_DINH] };

  const soViec = (viec?.yeuCau.length ?? 0) + (viec?.bienBan.length ?? 0);

  return (
    // `dark`: màn hình kho luôn là nền tối, nên bật bảng màu tối cho riêng nhánh
    // này — các nút dùng chung (nút quét QR chẳng hạn) mới có tương phản đúng,
    // dù người dùng đang để giao diện sáng ở phần quản trị.
    <div className="dark min-h-dvh text-white" style={nen}>
      <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black/25">
        {/*
          Robot nền ở góc phải dưới. `pointer-events-none` để nó không bao giờ
          ăn cú bấm của các ô chức năng, và đặt sau nội dung trong thứ tự vẽ
          bằng z-index âm thay vì absolute chồng lên.
        */}
        <RobotNen className="pointer-events-none absolute -bottom-14 -right-10 z-0 h-[26rem] w-auto text-white/[0.07] sm:h-[34rem]" />
        <RobotNen className="pointer-events-none absolute -left-16 top-24 z-0 hidden h-64 w-auto rotate-[-8deg] text-white/[0.04] xl:block" />
        <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-4 py-5 sm:px-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <DongHo />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${O_MEN} flex items-center gap-2 px-4 py-2 text-sm`}>
                <MatRobot canh={20} className="shrink-0 text-sky-200" />
                {nguoiDung?.fullName}
                {nguoiDung?.tenDiaDiem ? ` · ${nguoiDung.tenDiaDiem}` : ''}
              </span>
              <Button
                size="cham"
                variant="outline"
                className="min-h-[3rem] border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() => datMoDoiNen((m) => !m)}
                title="Đổi ảnh nền"
              >
                <ImageIcon aria-hidden />
                <span className="hidden sm:inline">Ảnh nền</span>
              </Button>
              <Button
                size="cham"
                variant="outline"
                className="min-h-[3rem] border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                asChild
                title="Về trang quản trị"
              >
                <Link to="/">
                  <Settings aria-hidden />
                  <span className="hidden sm:inline">Trang quản trị</span>
                </Link>
              </Button>
              <Button
                size="cham"
                variant="outline"
                className="min-h-[3rem] border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={() => void thoat()}
                title="Đăng xuất"
              >
                <LogOut aria-hidden />
                <span className="hidden sm:inline">Đăng xuất</span>
              </Button>
            </div>
          </header>

          {loi ? (
            <div className={`${O_MEN} p-4`}>
              <p className="text-sm text-amber-200">{loi}</p>
            </div>
          ) : null}

          {moDoiNen ? (
            <section className={`${O_MEN} space-y-4 p-4`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Đổi ảnh nền — lưu riêng cho tài khoản này</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/15 hover:text-white"
                  aria-label="Đóng"
                  onClick={() => datMoDoiNen(false)}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {DS_ANH_NEN_KIOSK.map((m) => (
                  <button
                    key={m.ma}
                    type="button"
                    onClick={() => void luuNen({ backgroundKey: m.ma, backgroundPhotoId: null })}
                    className={`min-h-cham overflow-hidden rounded-xl border-2 text-left ${
                      nenKhoa === m.ma && !nenAnhId ? 'border-white' : 'border-white/20'
                    }`}
                    aria-pressed={nenKhoa === m.ma && !nenAnhId}
                  >
                    <span className="block h-20 w-full" style={{ backgroundImage: NEN_KIOSK[m.ma] }} />
                    <span className="block px-3 py-2 text-sm">{m.nhan}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2 border-t border-white/15 pt-3">
                <p className="text-sm text-white/80">Hoặc tải ảnh của kho lên:</p>
                <ChupAnh
                  kind="KIOSK_BACKGROUND"
                  anh={anhTai}
                  onDoiAnh={(a) => {
                    datAnhTai(a);
                    const moi = a.at(-1);
                    if (moi) void luuNen({ backgroundPhotoId: moi.id, backgroundKey: null });
                  }}
                  toiDa={1}
                  batBuoc={false}
                  moTa="Ảnh ngang, tối màu thì chữ trên màn hình dễ đọc hơn."
                />
              </div>
            </section>
          ) : null}

          {soLieu ? (
            <section
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
              aria-label="Thống kê kho"
            >
              {/* Tách BỘ và LẺ như trang Tổng quan: người đứng ở kho cần biết
                  còn mấy BỘ thiết bị để phân về trường, và còn mấy quyển sách
                  để phát — gộp thành một số thì không trả lời được câu nào. */}
              <OThongKe
                nhan="Bộ tại kho"
                gia={soLieu.taiKho.bo}
                phu={`${so(soLieu.taiKho.le)} hàng lẻ`}
                icon={Boxes}
              />
              <OThongKe
                nhan="Bộ ở trường"
                gia={soLieu.oTruong.bo}
                phu={`${so(soLieu.oTruong.le)} hàng lẻ`}
                icon={MapPin}
              />
              <OThongKe nhan="Mã đang cho mượn" gia={soLieu.maChoMuon} icon={Truck} />
              <OThongKe nhan="Quá hạn trả" gia={soLieu.maQuaHan} icon={TimerOff} canhBao />
              <OThongKe nhan="Hỏng / mất" gia={soLieu.maHong} icon={PackageX} canhBao />
              <OThongKe
                nhan="Chờ xuất kho"
                gia={soLieu.yeuCauChoXuat}
                icon={PackageOpen}
                canhBao
              />
            </section>
          ) : null}

          <div className="grid flex-1 gap-5 xl:grid-cols-[3fr_2fr]">
            <section className="flex flex-col gap-3" aria-label="Chức năng">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {O_LON.map((o) => (
                  <Link
                    key={o.nhan}
                    to={o.den}
                    className={`${O_MEN} group flex min-h-[7.5rem] flex-col justify-between gap-3 p-4 transition-all hover:bg-white/20 hover:ring-white/30 active:scale-[0.98]`}
                  >
                    <span
                      className={`grid size-12 place-items-center rounded-xl ring-1 ring-inset transition-transform group-hover:scale-105 ${o.mau}`}
                    >
                      <o.icon className="size-6" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-lg font-semibold leading-tight">{o.nhan}</span>
                      <span className="block text-sm text-white/70">{o.phu}</span>
                    </span>
                  </Link>
                ))}
              </div>

              <div className={`${O_MEN} space-y-3 p-4`}>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <QrCode aria-hidden />
                  Quét mã / tra nhanh
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-h-cham max-w-xs border-white/25 bg-white/10 font-mono text-base text-white placeholder:text-white/50"
                    placeholder="LTL-RB-0001"
                    value={maTra}
                    aria-label="Mã thiết bị cần tra"
                    onChange={(su) => datMaTra(su.target.value.toUpperCase())}
                    onKeyDown={(su) => {
                      if (su.key === 'Enter') void traCuu(maTra);
                    }}
                  />
                  <Button
                    size="cham"
                    variant="outline"
                    className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                    onClick={() => void traCuu(maTra)}
                  >
                    <Search aria-hidden />
                    Tra
                  </Button>
                  <NutQuetQR nhan="Quét QR" onQuetDuoc={(ma) => void traCuu(ma)} />
                </div>
                {loiTra ? <p className="text-sm text-amber-200">{loiTra}</p> : null}
                {ketQuaTra ? (
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="font-mono text-lg font-semibold">{ketQuaTra.code}</p>
                    <p className="text-white/85">{ketQuaTra.name}</p>
                    <p className="text-sm text-white/70">
                      {ketQuaTra.category.name} · {NHAN_TINH_TRANG[ketQuaTra.condition]} ·{' '}
                      {ketQuaTra.currentLocation?.name ?? 'chưa gắn điểm'}
                    </p>
                    <Button
                      size="cham"
                      variant="outline"
                      className="mt-2 border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                      asChild
                    >
                      <Link to={`/thiet-bi/${ketQuaTra.id}`}>Mở chi tiết thiết bị</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </section>

            <DanhSachCuon viec={viec} soViec={soViec} />
          </div>

          <p className="pb-2 text-xs text-white/50">
            Màn hình đặt tại kho. Mọi lần đăng nhập đều được ghi nhật ký kèm toạ độ máy và khoảng
            cách tới kho. Quản trị bật lại khoá vị trí bất cứ lúc nào ở Thêm → Khoá vị trí kho.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Danh sách việc đang chờ, tự cuộn vòng để người đứng xa vẫn thấy hết. */
function DanhSachCuon({ viec, soViec }: { viec: ViecChoXuLy | null; soViec: number }) {
  const oRef = useRef<HTMLDivElement>(null);
  const [tamDung, datTamDung] = useState(false);

  useEffect(() => {
    const o = oRef.current;
    if (!o || tamDung || soViec === 0) return;
    const h = window.setInterval(() => {
      if (o.scrollHeight - o.clientHeight <= 4) return;
      // Tới đáy thì quay về đầu — danh sách chạy vòng suốt ngày.
      o.scrollTop = o.scrollTop + 1 >= o.scrollHeight - o.clientHeight ? 0 : o.scrollTop + 1;
    }, 60);
    return () => window.clearInterval(h);
  }, [tamDung, soViec]);

  return (
    <section className={`${O_MEN} flex min-h-[20rem] flex-col p-4`} aria-label="Việc đang chờ">
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 className="text-lg font-semibold">Đang chờ xử lý ({soViec})</h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/80 hover:bg-white/15 hover:text-white"
          onClick={() => datTamDung((t) => !t)}
        >
          {tamDung ? 'Cho cuộn lại' : 'Dừng cuộn'}
        </Button>
      </div>

      {soViec === 0 ? (
        <p className="text-white/70">Không còn việc nào đang chờ. Kho đang sạch việc.</p>
      ) : (
        <div
          ref={oRef}
          className="flex-1 space-y-2 overflow-y-auto pr-1"
          onMouseEnter={() => datTamDung(true)}
          onMouseLeave={() => datTamDung(false)}
        >
          {viec?.yeuCau.map((y) => (
            <Link
              key={y.id}
              to={`/yeu-cau/${y.id}`}
              className="block rounded-xl bg-black/25 p-3 transition-colors hover:bg-black/40"
            >
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{y.code}</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
                  {NHAN_TRANG_THAI_YEU_CAU[y.status]}
                </span>
              </p>
              <p className="text-sm text-white/80">
                {NHAN_LOAI_YEU_CAU[y.type]} · {y._count.items} dòng ·{' '}
                {y.toLocation?.name ?? 'nội bộ'}
              </p>
              <p className="text-xs text-white/60">
                {y.createdBy.fullName} · {ngayGio(y.createdAt)}
              </p>
            </Link>
          ))}
          {viec?.bienBan.map((b) => (
            <Link
              key={b.id}
              to={`/bbbg/${b.id}`}
              className="block rounded-xl bg-black/25 p-3 transition-colors hover:bg-black/40"
            >
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-semibold">{b.code}</span>
                <span className="rounded-full bg-amber-400/25 px-2 py-0.5 text-xs text-amber-100">
                  Chờ bên nhận xác nhận
                </span>
              </p>
              <p className="text-sm text-white/80">
                {b.receiverLocation?.name ?? b.receiverOrg} · {b._count.items} dòng
              </p>
              <p className="text-xs text-white/60">{ngayGio(b.createdAt)}</p>
            </Link>
          ))}
        </div>
      )}

      {soViec > 0 ? (
        <Alert variant="info" className="mt-3 border-white/20 bg-white/10 text-white">
          Danh sách tự cuộn. Chạm vào một dòng để mở phiếu tương ứng.
        </Alert>
      ) : null}
    </section>
  );
}
