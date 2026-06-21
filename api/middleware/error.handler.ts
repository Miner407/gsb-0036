import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  console.error('Error:', err.message);
  console.error(err.stack);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    error: err.message || '服务器内部错误',
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: `找不到 ${req.originalUrl} 路由`,
  });
};

export default errorHandler;
