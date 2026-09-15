import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./authenticate";

export const authorizeRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: "Forbidden: You do not have the required permissions to access this resource." 
      });
    }

    next();
  };
};
