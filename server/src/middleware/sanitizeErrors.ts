import { Request, Response, NextFunction } from 'express';

export const sanitizeErrorsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  const originalSend = res.send;

  // In production, we aggressively mask all error details to prevent leaking backend code or DB queries.
  const isProd = process.env.NODE_ENV === "production";

  res.json = function (body) {
    if (res.statusCode >= 400 && isProd) {
      if (body && typeof body === 'object') {
        body = { message: body.message || "An unexpected error occurred. (Error sanitized for security)" };
      }
    }
    return originalJson.call(this, body);
  };

  res.send = function (body) {
    if (res.statusCode >= 400 && isProd) {
      if (typeof body === 'string') {
        try {
          let parsed = JSON.parse(body);
          parsed = { message: parsed.message || "An unexpected error occurred." };
          return originalSend.call(this, JSON.stringify(parsed));
        } catch (e) {
          body = "An unexpected error occurred. (Error sanitized for security)";
        }
      } else if (typeof body === 'object') {
          body = { message: body.message || "An unexpected error occurred." };
      }
    }
    return originalSend.call(this, body);
  };

  next();
};
