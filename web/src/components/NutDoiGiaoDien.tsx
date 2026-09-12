import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apDungCheDo, docCheDo, type CheDo } from '@/lib/giao-dien';

export function NutDoiGiaoDien() {
  const [cheDo, datCheDo] = useState<CheDo>(() => docCheDo());

  useEffect(() => {
    apDungCheDo(cheDo);
  }, [cheDo]);

  const sangTiepTheo = cheDo === 'toi';
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => datCheDo(sangTiepTheo ? 'sang' : 'toi')}
      aria-label={sangTiepTheo ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      title={sangTiepTheo ? 'Chế độ sáng' : 'Chế độ tối'}
    >
      {sangTiepTheo ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
