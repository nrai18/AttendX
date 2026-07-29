import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Developer Auth Bypass: instantly attach dummy developer user and skip verification
  req.user = {
    userId: "dev-user-id", // Dummy Dev ID
    role: "admin",         // Dev Role
  };
  next();
};
