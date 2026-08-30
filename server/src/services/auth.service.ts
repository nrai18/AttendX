import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt";

export class AuthService {
  static async hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  static async register(data: any, req?: any) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    
    if (existingUser) {
      if (!existingUser.passwordHash) {
        // User exists but has no password (likely from an old Google Login attempt or manual insertion)
        // Allow them to set a password now.
        const passwordHash = await bcrypt.hash(data.password, 10);
        const user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            name: data.name || existingUser.name,
          },
        });
        
        return this.generateTokensForOAuth(user, req);
      }
      
      throw new Error("Account already exists with this email. Please log in instead.");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: data.name,
      },
    });

    return this.generateTokensForOAuth(user, req);
  }

  static async login(data: any, req?: any) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.passwordHash) {
      throw new Error("Account does not exist. Please sign up.");
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error("Incorrect password. Please try again.");

    return this.generateTokensForOAuth(user, req);
  }

  static async googleNativeLogin(idToken: string, req?: any) {
    const { OAuth2Client } = require("google-auth-library");
    // Some setups use a separate Android client ID, but verification usually uses the Web Client ID
    const client = new OAuth2Client(); 
    
    // We verify the token signature and get the payload
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Google token payload");

    const email = payload.email?.toLowerCase().trim();
    if (!email) throw new Error("No email found in Google token");

    if (!email.endsWith("@iiitu.ac.in") && !email.endsWith("@gmail.com")) {
      throw new Error("Only @iiitu.ac.in or @gmail.com emails are allowed.");
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          name: payload.name || "User",
          avatarUrl: payload.picture || null,
        },
      });
    } else {
      // Sync Google data if missing
      const updates: any = {};
      if (!user.googleId) updates.googleId = payload.sub;
      if (!user.avatarUrl && payload.picture) updates.avatarUrl = payload.picture;
      if (user.name === "User" && payload.name) updates.name = payload.name;

      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    }

    return this.generateTokensForOAuth(user, req);
  }

  static async generateTokensForOAuth(user: any, req?: any) {
    const { v4: uuidv4 } = require("uuid"); const sessionId = uuidv4(); const accessToken = generateAccessToken(user.id, user.role, sessionId);
    const refreshToken = generateRefreshToken(user.id);
    const hashedRefresh = await this.hashToken(refreshToken);

    const { getDeviceDetails } = require("../utils/device");
    const { userAgent, ipAddress, location, os, browser, deviceType } = await getDeviceDetails(req);
    
    // Auto-terminate inactive sessions on login
    if (user.autoTerminateMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - user.autoTerminateMonths);
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id, lastActive: { lt: cutoffDate } }
      });
    }

    await prisma.refreshToken.create({
      data: {
        id: sessionId, userId: user.id,
        token: hashedRefresh,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent,
        ipAddress,
        location,
        os,
        browser,
        deviceType
      },
    });

    const { passwordHash, ...safeUser } = user;
    const userWithHasPassword = { ...safeUser, hasPassword: !!passwordHash };

    return { user: userWithHasPassword, accessToken, refreshToken };
  }

  static async refresh(oldRefreshToken: string, req?: any) {
    const payload = verifyRefreshToken(oldRefreshToken);
    const hashedOldRefresh = await this.hashToken(oldRefreshToken);

    // Check if token exists in DB (not revoked or already used)
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: hashedOldRefresh },
    });

    if (!tokenRecord) {
      // Security measure: if token was already used, revoke all tokens for this user
      await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
      throw new Error("Invalid refresh token. Please login again.");
    }

    // Delete the old token (rotation)
    await prisma.refreshToken.delete({ where: { token: hashedOldRefresh } });

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new Error("User not found");

    const { v4: uuidv4 } = require("uuid"); const sessionId = uuidv4(); const accessToken = generateAccessToken(user.id, user.role, sessionId);
    const newRefreshToken = generateRefreshToken(user.id);
    const hashedNewRefresh = await this.hashToken(newRefreshToken);

    const { getDeviceDetails } = require("../utils/device");
    const { userAgent, ipAddress, location, os, browser, deviceType } = await getDeviceDetails(req);
    
    // Auto-terminate inactive sessions on login
    if (user.autoTerminateMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - user.autoTerminateMonths);
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id, lastActive: { lt: cutoffDate } }
      });
    }

    await prisma.refreshToken.create({
      data: {
        id: sessionId, userId: user.id,
        token: hashedNewRefresh,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent,
        ipAddress,
        location,
        os,
        browser,
        deviceType
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const hashedRefresh = await this.hashToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: hashedRefresh } });
  }
}
