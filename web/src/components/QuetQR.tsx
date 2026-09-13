import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, Loader2, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Quét QR bằng camera.
 *
 * Ưu tiên BarcodeDetector của trình duyệt (Chrome/Edge, Chrome Android — đúng
 * loại máy kiosk và tablet dùng tại kho): nhanh, chạy ở tầng native. Trình duyệt
 * không có (Safari/iOS) thì rơi sang jsQR giải mã trên canvas.
 *
 * Camera chỉ chạy trên HTTPS hoặc localhost.
 */
export interface QuetQRProps {
  onQuetDuoc: (maDaQuet: string) => void;
  onDong: () => void;
  /** Nhãn hiển thị trên khung quét. */
  moTa?: string;
}

type TrangThai = 'dang-mo' | 'dang-quet' | 'loi';

const CHU_KY_QUET_MS = 200;

export function QuetQR({ onQuetDuoc, onDong, moTa }: QuetQRProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const luongRef = useRef<MediaStream | null>(null);
  const dungRef = useRef(false);
  const [trangThai, datTrangThai] = useState<TrangThai>('dang-mo');
  const [loi, datLoi] = useState<string | null>(null);
  const [cachQuet, datCachQuet] = useState<'native' | 'jsqr'>('jsqr');

  const dungCamera = useCallback(() => {
    dungRef.current = true;
    for (const track of luongRef.current?.getTracks() ?? []) track.stop();
    luongRef.current = null;
  }, []);

  useEffect(() => {
    dungRef.current = false;
    let detector: BarcodeDetector | null = null;
    let hen: number | undefined;

    async function batDau(): Promise<void> {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Trình duyệt không hỗ trợ camera. Cần dùng trình duyệt hiện đại qua HTTPS.',
          );
        }
        const luong = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (dungRef.current) {
          for (const t of luong.getTracks()) t.stop();
          return;
        }
        luongRef.current = luong;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = luong;
        await video.play();

        if (window.BarcodeDetector) {
          try {
            detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            datCachQuet('native');
          } catch {
            detector = null;
          }
        }
        datTrangThai('dang-quet');
        vongQuet();
      } catch (e) {
        datTrangThai('loi');
        datLoi(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Bạn đã từ chối quyền dùng camera. Hãy cho phép rồi mở lại.'
            : e instanceof Error
              ? e.message
              : 'Không mở được camera.',
        );
      }
    }

    function vongQuet(): void {
      if (dungRef.current) return;
      void quetMotLan().finally(() => {
        if (!dungRef.current) hen = window.setTimeout(vongQuet, CHU_KY_QUET_MS);
      });
    }

    async function quetMotLan(): Promise<void> {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      if (detector) {
        try {
          const ketQua = await detector.detect(video);
          const ma = ketQua[0]?.rawValue?.trim();
          if (ma) {
            dungCamera();
            onQuetDuoc(ma);
          }
          return;
        } catch {
          // BarcodeDetector lỗi giữa chừng → chuyển hẳn sang jsQR.
          detector = null;
          datCachQuet('jsqr');
        }
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      if (canvas.width === 0 || canvas.height === 0) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const anh = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const ketQua = jsQR(anh.data, anh.width, anh.height, { inversionAttempts: 'dontInvert' });
      const ma = ketQua?.data.trim();
      if (ma) {
        dungCamera();
        onQuetDuoc(ma);
      }
    }

    void batDau();
    return () => {
      if (hen !== undefined) window.clearTimeout(hen);
      dungCamera();
    };
  }, [dungCamera, onQuetDuoc]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <video
          ref={videoRef}
          className="aspect-[4/3] w-full max-w-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        {trangThai === 'dang-quet' ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="size-48 max-w-[70%] rounded-lg border-4 border-accent/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        ) : null}
        {trangThai === 'dang-mo' ? (
          <p className="absolute inset-0 grid place-items-center text-sm text-white">
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" aria-hidden />
              Đang mở camera…
            </span>
          </p>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        {moTa ?? 'Đưa mã QR trên nhãn thiết bị vào khung.'}{' '}
        {trangThai === 'dang-quet' ? (
          <span className="text-xs">
            ({cachQuet === 'native' ? 'dùng bộ giải mã của trình duyệt' : 'dùng bộ giải mã dự phòng'})
          </span>
        ) : null}
      </p>

      {loi ? (
        <Alert variant="destructive" tieuDe="Không quét được">
          {loi}
        </Alert>
      ) : null}

      <Button
        variant="outline"
        size="cham"
        onClick={() => {
          dungCamera();
          onDong();
        }}
        className="w-full"
      >
        {trangThai === 'loi' ? <CameraOff aria-hidden /> : <X aria-hidden />}
        Đóng camera
      </Button>
    </div>
  );
}

/** Nút mở/đóng khung quét, dùng chung ở các màn hình nhập liệu. */
export function NutQuetQR({
  onQuetDuoc,
  nhan = 'Quét mã QR',
}: {
  onQuetDuoc: (ma: string) => void;
  nhan?: string;
}) {
  const [mo, datMo] = useState(false);
  const nhanMa = useCallback(
    (ma: string) => {
      datMo(false);
      onQuetDuoc(ma);
    },
    [onQuetDuoc],
  );

  if (!mo) {
    return (
      <Button variant="outline" size="cham" onClick={() => datMo(true)}>
        <Camera aria-hidden />
        {nhan}
      </Button>
    );
  }
  return <QuetQR onQuetDuoc={nhanMa} onDong={() => datMo(false)} />;
}
