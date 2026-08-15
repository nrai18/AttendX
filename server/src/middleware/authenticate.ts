import { Request, Response, NextFunction, RequestHandler } from "express";

import { prisma } from "../lib/prisma";

export type AuthenticatedRequest = Request;

let devUserId: string | null = null;

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    if (!devUserId) {
      let user = await prisma.user.findFirst({ where: { email: "dev@iiitu.ac.in" } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: "dev@iiitu.ac.in",
            name: "Developer",
            role: "admin",
          }
        });
      }
      devUserId = user.id;
    }

    req.user = {
      userId: devUserId,
      role: "admin",
    };
    next();
  } catch (error) {
    console.error("Auth bypass error:", error);
    res.status(500).json({ message: "Failed to initialize dev user in database" });
  }
};
