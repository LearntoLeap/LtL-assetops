import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoiApi } from '@/lib/api';
import { taiAnhLen, type AnhDaTai } from '@/lib/anh';
import { AnhBaoMat } from '@/components/AnhBaoMat';
import type { LoaiAnh } from '@ltl/taisan-shared';

/**
 * Chụp ảnh làm BẰNG CHỨNG cho xuất/nhập kho (nguyên tắc bất biến #3).
 *
 * Hai đường vào, dùng đường nào cũng được:
 *   - mở camera ngay trong trang (máy kiosk cố định tại kho có webcam);
 *   - chọn file kèm `capture="environment"` — trên tablet/điện thoại sẽ bật
 *     thẳng camera sau của máy.
 *
 * Ảnh tải lên ngay khi chụp; component trả về danh sách id ảnh cho màn hình cha.
 */
export interface ChupAnhProps {
  kind: LoaiAnh;
  anh: AnhDaTai[];
  onDoiAnh: (anh: AnhDaTai[]) => void;
  /** Gắn ảnh vào thiết bị ngay lúc tải, để phạm vi quyền đúng từ đầu. */
  assetId?: string;
  moTa?: string;
  toiDa?: number;
}

export function ChupAnh({ kind, anh, onDoiAnh, assetId, moTa, toiDa = 5 }: ChupAnhProps) {
  const oFile = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const luongRef = useRef<MediaStream | null>(null);

  const [moCamera, datMoCamera] = useState(false);
  const [dangTai, datDangTai] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  const dungCamera = useCallback(() => {
    for (const t of luongRef.current?.getTracks() ?? []) t.stop();
    luongRef.current = null;
  }, []);

  useEffect(() => {
    if (!moCamera) {
      dungCamera();
      return;
    }
    let huy = false;
    async function batDau(): Promise<void> {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Trình duyệt không hỗ trợ camera. Hãy dùng nút "Chọn ảnh" bên cạnh.');
        }
        const luong = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 } },
          audio: false,
        });
        if (huy) {
          for (const t of luong.getTracks()) t.stop();
          return;
        }
        luongRef.current = luong;
        if (videoRef.current) {
          videoRef.current.srcObject = luong;
          await videoRef.current.play();
        }
      } catch (e) {
        datLoi(
          e instanceof Error && e.name === 'NotAllowedError'
            ? 'Bạn đã từ chối quyền dùng camera. Cho phép rồi mở lại, hoặc bấm "Chọn ảnh".'
            : e instanceof Error
              ? e.message
              : 'Không mở được camera.',
        );
        datMoCamera(false);
      }
    }
    void batDau();
    return () => {
      huy = true;
      dungCamera();
    };
  }, [moCamera, dungCamera]);

  const tai = useCallback(
    async (tep: File) => {
      datLoi(null);
      datDangTai(true);
      try {
        const moi = await taiAnhLen(tep, kind, assetId);
        onDoiAnh([...anh, moi]);
      } catch (e) {
        datLoi(e instanceof LoiApi ? e.message : 'Tải ảnh lên thất bại.');
      } finally {
        datDangTai(false);
      }
    },
    [anh, assetId, kind, onDoiAnh],
  );

  async function bamChup(): Promise<void> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((xong) =>
      canvas.toBlob((b) => xong(b), 'image/jpeg', 0.92),
    );
    if (!blob) {
      datLoi('Không lấy được ảnh từ camera.');
      return;
    }
    datMoCamera(false);
    await tai(new File([blob], `chup-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  }

  const dayDu = anh.length >= toiDa;

  return (
    <div className="space-y-2">
      {moTa ? <p className="text-sm text-muted-foreground">{moTa}</p> : null}

      {moCamera ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button size="cham" className="flex-1" onClick={() => void bamChup()} disabled={dangTai}>
              {dangTai ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
              Chụp
            </Button>
            <Button variant="outline" size="cham" onClick={() => datMoCamera(false)}>
              <X aria-hidden />
              Đóng
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="cham"
            disabled={dayDu || dangTai}
            onClick={() => datMoCamera(true)}
          >
            <Camera aria-hidden />
            Mở camera
          </Button>
          <Button
            type="button"
            variant="outline"
            size="cham"
            disabled={dayDu || dangTai}
            onClick={() => oFile.current?.click()}
          >
            {dangTai ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            Chọn ảnh
          </Button>
          <input
            ref={oFile}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(su) => {
              const f = su.target.files?.[0];
              if (f) void tai(f);
              su.target.value = '';
            }}
          />
        </div>
      )}

      {loi ? <Alert variant="destructive">{loi}</Alert> : null}

      {anh.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {anh.map((a) => (
            <li key={a.id} className="relative">
              <AnhBaoMat id={a.id} alt="Ảnh đã chụp" className="size-24 rounded-md border object-cover" />
              <button
                type="button"
                onClick={() => onDoiAnh(anh.filter((x) => x.id !== a.id))}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-destructive text-destructive-foreground shadow"
                aria-label="Bỏ ảnh này"
                title="Bỏ ảnh này"
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-warning-dam">Chưa có ảnh — bắt buộc phải có ít nhất một ảnh.</p>
      )}
    </div>
  );
}
