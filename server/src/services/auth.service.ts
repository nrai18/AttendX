import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { EmailService } from "./email.service";
import jwt from "jsonwebtoken";

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
        
        // Send welcome email
        EmailService.sendWelcomeEmail(user.email, user.name);
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
          avatarUrl: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(data.name)}`,
          targetAttendance: parseInt(process.env.DEFAULT_TARGET_ATTENDANCE || "75"),
      },
    });

    EmailService.sendWelcomeEmail(user.email, user.name);

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
    const client = new OAuth2Client();

    // SEC-01 FIX: NEVER read audience from the unverified token itself.
    // The audience MUST be a hardcoded list of client IDs we own.
    // Reading it from the token lets an attacker self-declare our client ID
    // on a token minted for any other app, bypassing verification entirely.
    const trustedAudiences = [
      process.env.GOOGLE_CLIENT_ID,          // Web OAuth client ID
      process.env.GOOGLE_ANDROID_CLIENT_ID,  // Android client ID
    ].filter(Boolean) as string[];           // Drop undefined if env var not set

    if (trustedAudiences.length === 0) {
      throw new Error("Server misconfiguration: No Google client IDs configured.");
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience: trustedAudiences,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Google token payload");

    const email = payload.email?.toLowerCase().trim();
    if (!email) throw new Error("No email found in Google token");

    
    const allowedDomainsStr = process.env.ALLOWED_DOMAINS || "iiitu.ac.in,gmail.com";
    const allowedDomains = allowedDomainsStr.split(",").map(d => d.trim());
    const emailDomain = email.split("@")[1];
    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      throw new Error("Only " + allowedDomainsStr.replace(",", " or ") + " emails are allowed.");
    }


    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          googleId: payload.sub,
          name: payload.name || "User",
            avatarUrl: payload.picture || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(payload.name || "User")}`,
            targetAttendance: parseInt(process.env.DEFAULT_TARGET_ATTENDANCE || "75"),
        },
      });

      EmailService.sendWelcomeEmail(user.email, user.name);
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
    
    let finalLocation = location;
    if (!location || location === "Unknown Location" || location === "Local Network" || location.includes("Asia")) {
      // New sessions do not have a prior location
    }
    
    
    // Check if this is a new device by looking for existing sessions with the same userAgent
    const existingSession = await prisma.refreshToken.findFirst({
      where: { userId: user.id, userAgent }
    });
    
    if (!existingSession) {
      const timeStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const deviceName = `${browser} on ${os}`;
      EmailService.sendNewDeviceLoginEmail(user.email, user.name, deviceName, timeStr);
    }

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
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
    const hashedOldRefresh = await this.hashToken(oldRefreshToken);
    
    let payload;
    try {
      payload = verifyRefreshToken(oldRefreshToken);
    } catch (error) {
      console.error("Refresh token verification failed:", error);
      await prisma.refreshToken.deleteMany({ where: { token: hashedOldRefresh } });
      throw new Error("Invalid or expired refresh token. Please login again.");
    }

    // Check if token exists in DB (not revoked or already used)
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: hashedOldRefresh },
    });

    if (!tokenRecord) {
      // SEC-H06 FIX: Security measure: if token was already used, revoke all tokens for this user
      // A legitimate client would have the latest refresh token. If we see an old valid one, it's stolen.
      await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
      throw new Error("Security alert: Token reuse detected. All sessions revoked. Please login again.");
    }

    const sessionId = tokenRecord.id;

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new Error("User not found");

    // SEC-H06 FIX: Rotate tokens on every refresh!
    const newRefreshToken = generateRefreshToken(user.id);
    const hashedNewRefresh = await this.hashToken(newRefreshToken);
    const accessToken = generateAccessToken(user.id, user.role, sessionId);

    const { getDeviceDetails } = require("../utils/device");
    const { userAgent, ipAddress, location, os, browser, deviceType } = await getDeviceDetails(req);
    let finalLocation = location;
    if (!location || location === "Unknown Location" || location === "Local Network" || location.includes("Asia")) {
      if (typeof tokenRecord !== 'undefined' && tokenRecord && tokenRecord.location && tokenRecord.location !== "Unknown Location") {
        finalLocation = tokenRecord.location;
      }
    }
    // Auto-terminate inactive sessions on login
    if (user.autoTerminateMonths) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - user.autoTerminateMonths);
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id, lastActive: { lt: cutoffDate } }
      });
    }

    await prisma.refreshToken.update({
      where: { id: sessionId },
      data: {
        token: hashedNewRefresh, // SEC-H06 FIX: Update the DB with the new token
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // SEC-M09 FIX: Keep consistent 30-day inactivity timeout
        lastActive: new Date(),
        userAgent,
        ipAddress,
        location: finalLocation,
        os,
        browser,
        deviceType
      },
    });

    return { accessToken, refreshToken: newRefreshToken }; // Return the rotated refresh token
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const hashedRefresh = await this.hashToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: hashedRefresh } });
  }
  static async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    
    // Generate a 6 digit OTP
    const crypto = require('crypto');
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(otp).digest('hex');

    // SEC-H03 FIX: Use a constant-time secret pattern to avoid timing differences.
    // We sign with the global secret for the reset envelope.
    const secret = process.env.JWT_SECRET as string;
    
    if (!user) {
      // Simulate email sending time to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 500));
      // Return a fake token to prevent user enumeration, signed with the real secret
      const fakeToken = require('jsonwebtoken').sign({ id: 'fake', otpHash }, secret, { expiresIn: '15m' });
      return { token: fakeToken };
    }

    // Embed the user's password hash in the payload so we can check if it changed later
    const token = require('jsonwebtoken').sign({ id: user.id, otpHash, passHash: user.passwordHash?.substring(0, 10) }, secret, { expiresIn: '15m' });
    
    // Send the plain OTP via email!
    await EmailService.sendPasswordResetEmail(user.email, otp);
    return { token };
  }

  static async validateOtp(token: string, otp: string) {
    const crypto = require('crypto');
    if (!otp) throw new Error("OTP is required");
    if (!token) throw new Error("Invalid token");
    
    const secret = process.env.JWT_SECRET as string;
    let decoded;
    try {
      // SEC-H01 FIX: Verify the signature BEFORE looking up the user ID
      decoded = jwt.verify(token, secret) as { id: string, otpHash: string, passHash?: string };
    } catch (e) {
      throw new Error("Invalid or expired reset token");
    }
    
    if (!decoded.id || decoded.id === 'fake') {
      // Fake tokens pass JWT verify, but we reject them here without a DB hit
      throw new Error("Invalid or expired reset token");
    }
    
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new Error("User not found");
    
    // Ensure the password hasn't already been reset since this token was issued
    if (decoded.passHash && user.passwordHash?.substring(0, 10) !== decoded.passHash) {
       throw new Error("Invalid or expired reset token");
    }
    
    const providedHash = crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(otp).digest('hex');
    if (providedHash !== decoded.otpHash) throw new Error("Invalid OTP");
    return true;
  }

  static async resetPassword(token: string, otp: string, newPassword: string) {
    const crypto = require('crypto');
    if (!otp) throw new Error("OTP is required");
    if (!token) throw new Error("Invalid token");
    if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    
    const secret = process.env.JWT_SECRET as string;
    let decoded;
    try {
      // SEC-H01 FIX: Verify the signature BEFORE looking up the user ID
      decoded = jwt.verify(token, secret) as { id: string, otpHash: string, passHash?: string };
    } catch (e) {
      throw new Error("Invalid or expired reset token");
    }
    
    if (!decoded.id || decoded.id === 'fake') throw new Error("Invalid or expired reset token");
    
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new Error("User not found");
    
    // Ensure the password hasn't already been reset since this token was issued
    if (decoded.passHash && user.passwordHash?.substring(0, 10) !== decoded.passHash) {
       throw new Error("Invalid or expired reset token");
    }
    
    const providedHash = crypto.createHmac('sha256', process.env.JWT_SECRET as string).update(otp).digest('hex');
    if (providedHash !== decoded.otpHash) throw new Error("Invalid OTP");
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    
    EmailService.sendPasswordResetSuccessEmail(user.email, user.name);
  }

}



