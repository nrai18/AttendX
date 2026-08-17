import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { prisma } from "../lib/prisma";

const client = jwksClient({
  jwksUri: "https://ep-wispy-rice-azhgaqup.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth/.well-known/jwks.json",
});

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!header.kid) {
    return callback(new Error("No kid in header"));
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) return callback(err || new Error("Key not found"));
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    role: string;
  };
};

export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, getKey, {}, async (err, decoded: any) => {
      if (err || !decoded) {
        return res.status(401).json({ message: "Invalid or expired access token" });
      }

      // Sync user to local database based on email or subject
      try {
        const email = decoded.email || `${decoded.sub}@neon-auth.com`;
        const name = decoded.name || "Neon User";
        
        let user = await prisma.user.findFirst({ where: { email } });
        
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name,
              role: "student",
            },
          });
        }

        req.user = { userId: user.id, role: user.role };
        next();
      } catch (dbErr) {
        console.error("Failed to sync Neon Auth user to local DB", dbErr);
        res.status(500).json({ message: "Internal server error during auth sync" });
      }
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid authentication request" });
  }
};
