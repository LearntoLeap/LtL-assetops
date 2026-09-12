import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 không tự bắt lỗi từ handler async. Bọc mọi handler async bằng hàm
 * này để lỗi đi đúng vào middleware xử lý lỗi thay vì thành unhandledRejection.
 */
export function batAsync(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
