import { Response } from "express";

export const setRefreshCookie = (res: Response, refreshToken: string) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Prevents JS access (XSS protection)
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // Prevents CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth/refresh", // Only sent to refresh endpoint
  });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
  });
};
