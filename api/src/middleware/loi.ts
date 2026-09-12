import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { LoiHttp } from '../lib/loi-http.js';
import { log, moTaLoi } from '../lib/ghi-log.js';
import { env } from '../env.js';

/** 404 cho đường dẫn không khớp route nào. */
export const khongTimThayRoute: RequestHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    maLoi: 'KHONG_TIM_THAY',
    thongDiep: `Không có endpoint ${req.method} ${req.path}.`,
  });
};

/** Dịch mọi lỗi thành phản hồi JSON tiếng Việt. Phải đăng ký SAU cùng. */
export const xuLyLoi: ErrorRequestHandler = (loi, req, res, _next) => {
  if (loi instanceof LoiHttp) {
    res.status(loi.maHttp).json({
      ok: false,
      maLoi: loi.maLoi,
      thongDiep: loi.message,
      ...(loi.chiTiet ? { chiTiet: loi.chiTiet } : {}),
    });
    return;
  }

  if (loi instanceof ZodError) {
    res.status(400).json({
      ok: false,
      maLoi: 'DU_LIEU_KHONG_HOP_LE',
      thongDiep: 'Dữ liệu gửi lên không hợp lệ.',
      chiTiet: {
        truong: loi.issues.map((v) => ({ duongDan: v.path.join('.'), thongDiep: v.message })),
      },
    });
    return;
  }

  if (loi instanceof Prisma.PrismaClientKnownRequestError) {
    if (loi.code === 'P2002') {
      const truong = (loi.meta?.['target'] as string[] | string | undefined) ?? 'không rõ';
      res.status(409).json({
        ok: false,
        maLoi: 'TRUNG_DU_LIEU',
        thongDiep: 'Giá trị đã tồn tại, không thể ghi trùng.',
        chiTiet: { truong },
      });
      return;
    }
    if (loi.code === 'P2025' || loi.code === 'P2001') {
      res.status(404).json({ ok: false, maLoi: 'KHONG_TIM_THAY', thongDiep: 'Không tìm thấy dữ liệu.' });
      return;
    }
  }

  log.error('Lỗi chưa xử lý', {
    duongDan: `${req.method} ${req.originalUrl}`,
    ...moTaLoi(loi),
  });

  res.status(500).json({
    ok: false,
    maLoi: 'LOI_HE_THONG',
    thongDiep: 'Hệ thống gặp sự cố. Vui lòng thử lại hoặc liên hệ quản trị.',
    ...(env.laSanXuat ? {} : { chiTiet: moTaLoi(loi) }),
  });
};
