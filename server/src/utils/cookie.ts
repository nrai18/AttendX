import { Response } from "express";

export const setRefreshCookie = (res: Response, refreshToken: string) => {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Prevents JS access (XSS protection)
    secure: isProd, // Must be true for SameSite=None
    sameSite: isProd ? "none" : "lax", // None required for cross-site (Vercel -> Render)
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days (sliding)
    path: "/api/auth/refresh", // Only sent to refresh endpoint
  });
};

export const clearRefreshCookie = (res: Response) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth/refresh",
  });
};
