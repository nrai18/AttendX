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

    if (!user) {
      throw new Error("Account does not exist. Please sign up.");
    }
    if (!user.passwordHash) {
      throw new Error("You created this account using Google. Please click 'Continue with Google' below.");
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
    const allowedDomains = allowedDomainsStr.split(",").map(d => d.trim().toLowerCase());
    const emailDomain = email.split("@")[1];
    if (!emailDomain || (!allowedDomains.includes("*") && !allowedDomains.includes(emailDomain))) {
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

    // Check if token exists in DB and fetch user in a single query
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: hashedOldRefresh },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new Error("Invalid or expired refresh token. Please login again.");
    }

    const sessionId = tokenRecord.id;
    const user = tokenRecord.user;
    if (!user) throw new Error("User not found");

    // Disable strict token rotation to prevent flaky mobile network logouts (Token Reuse false positives)
    const accessToken = generateAccessToken(user.id, user.role, sessionId);

    // Update session metadata & clean up old sessions asynchronously in the background so /auth/refresh returns immediately
    (async () => {
      try {
        const { getDeviceDetails } = require("../utils/device");
        const { userAgent, ipAddress, location, os, browser, deviceType } = await getDeviceDetails(req);
        let finalLocation = location;
        if (!location || location === "Unknown Location" || location === "Local Network" || location.includes("Asia")) {
          if (tokenRecord.location && tokenRecord.location !== "Unknown Location") {
            finalLocation = tokenRecord.location;
          }
        }

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
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            lastActive: new Date(),
            userAgent,
            ipAddress,
            location: finalLocation,
            os,
            browser,
            deviceType
          },
        });
      } catch {
        // Ignore background metadata update errors
      }
    })();

    return { accessToken, refreshToken: oldRefreshToken };
  }

  static async logout(refreshToken: string) {
    if (!refreshToken) return;
    const hashedRefresh = await this.hashToken(refreshToken);
    await prisma.refreshToken.deleteMany({ where: { token: hashedRefresh } });
  }
  private static otpAttempts = new Map<string, { count: number; expiresAt: number }>();

  private static getResetSigningSecret(): string {
    const base = process.env.JWT_SECRET as string;
    return crypto.createHmac("sha256", base).update("attendx_pwd_reset_jwt_secret_v2").digest("hex");
  }

  private static getResetEncryptionKey(): Buffer {
    const base = process.env.JWT_SECRET as string;
    return crypto.createHmac("sha256", base).update("attendx_pwd_reset_aes_key_v2").digest();
  }

  private static computePassDigest(passwordHash?: string | null): string {
    const base = process.env.JWT_SECRET as string;
    return crypto.createHmac("sha256", base).update(passwordHash || "NO_PASSWORD").digest("hex").slice(0, 32);
  }

  private static encryptResetData(data: { uid: string; fake: number; otpHash: string; passDigest: string; jti: string }): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.getResetEncryptionKey(), iv);
    const plaintext = JSON.stringify(data);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
  }

  private static decryptResetData(blob: string): { uid: string; fake: number; otpHash: string; passDigest: string; jti: string } {
    const parts = (blob || "").split(".");
    if (parts.length !== 3) throw new Error("Invalid or expired reset token");
    const iv = Buffer.from(parts[0], "base64url");
    const encrypted = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.getResetEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted);
  }

  private static checkAndRecordOtpAttempt(jti: string, success: boolean): void {
    const now = Date.now();
    // Opportunistic cleanup of expired attempt records
    if (this.otpAttempts.size > 500) {
      for (const [k, v] of this.otpAttempts.entries()) {
        if (v.expiresAt < now) this.otpAttempts.delete(k);
      }
    }
    const record = this.otpAttempts.get(jti);
    if (record && record.expiresAt > now && record.count >= 5) {
      throw new Error("Too many invalid OTP attempts. Please request a new code.");
    }
    if (!success) {
      const nextCount = (record && record.expiresAt > now ? record.count : 0) + 1;
      this.otpAttempts.set(jti, { count: nextCount, expiresAt: now + 15 * 60 * 1000 });
      if (nextCount >= 5) {
        throw new Error("Too many invalid OTP attempts. Please request a new code.");
      }
    }
  }

  static async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    
    // Generate a 6 digit OTP (100000 to 999999 inclusive)
    const otp = crypto.randomInt(100000, 1000000).toString();
    const resetSecret = this.getResetSigningSecret();
    const jti = crypto.randomBytes(8).toString("hex");
    const otpHash = crypto.createHmac("sha256", resetSecret).update(`${jti}:${otp}`).digest("hex");

    const otpForLog = process.env.NODE_ENV === "production" ? "[REDACTED]" : otp;
    console.log(`[AUTH] Password reset requested for "${normalizedEmail}". OTP: ${otpForLog} (User found: ${Boolean(user)})`);

    if (!user) {
      console.warn(`[AUTH] User "${normalizedEmail}" not found in database. Issued simulated token for enumeration defense.`);
      // Simulate email sending time to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 500));
      const encryptedFake = this.encryptResetData({
        uid: crypto.randomUUID(),
        fake: 1,
        otpHash,
        passDigest: this.computePassDigest("FAKE_USER_NO_PASSWORD"),
        jti,
      });
      const fakeToken = jwt.sign({ purpose: "password_reset", p: encryptedFake }, resetSecret, { expiresIn: "15m" });
      return { token: fakeToken };
    }

    // Embed full-hash HMAC digest so any password change immediately invalidates outstanding tokens
    const passDigest = this.computePassDigest(user.passwordHash);
    const encryptedReal = this.encryptResetData({
      uid: user.id,
      fake: 0,
      otpHash,
      passDigest,
      jti,
    });
    const token = jwt.sign({ purpose: "password_reset", p: encryptedReal }, resetSecret, { expiresIn: "15m" });
    
    // Send the plain OTP via email
    const emailRes = await EmailService.sendPasswordResetEmail(user.email, otp);
    console.info(`[AuthService] Password reset OTP sent to ${normalizedEmail}: success=${emailRes.success}`, emailRes.data?.id || emailRes.error);
    return { token, emailDispatched: emailRes.success };
  }

  static async validateOtp(token: string, otp: string) {
    const cleanOtp = String(otp || "").trim();
    if (!cleanOtp) throw new Error("OTP is required");
    if (!token) throw new Error("Invalid token");
    
    const resetSecret = this.getResetSigningSecret();
    let outer: { purpose?: string; p?: string };
    try {
      outer = jwt.verify(token, resetSecret) as { purpose?: string; p?: string };
    } catch (e) {
      throw new Error("Invalid or expired reset token");
    }

    if (outer.purpose !== "password_reset" || !outer.p) {
      throw new Error("Invalid or expired reset token");
    }

    const decoded = this.decryptResetData(outer.p);
    // Check brute-force counter first (even for fake tokens so behavior is uniform)
    this.checkAndRecordOtpAttempt(decoded.jti, true);

    const providedHash = crypto.createHmac("sha256", resetSecret).update(`${decoded.jti}:${cleanOtp}`).digest("hex");
    const isHashMatch =
      providedHash.length === decoded.otpHash.length &&
      crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(decoded.otpHash));

    if (decoded.fake === 1 || !decoded.uid) {
      this.checkAndRecordOtpAttempt(decoded.jti, false);
      throw new Error("Invalid OTP");
    }
    
    const user = await prisma.user.findUnique({ where: { id: decoded.uid } });
    if (!user) {
      this.checkAndRecordOtpAttempt(decoded.jti, false);
      throw new Error("Invalid or expired reset token");
    }
    
    // Ensure the password hasn't already been reset since this token was issued
    const currentPassDigest = this.computePassDigest(user.passwordHash);
    if (decoded.passDigest && currentPassDigest !== decoded.passDigest) {
      throw new Error("Invalid or expired reset token");
    }
    
    if (!isHashMatch) {
      this.checkAndRecordOtpAttempt(decoded.jti, false);
      throw new Error("Invalid OTP");
    }
    return true;
  }

  static async resetPassword(token: string, otp: string, newPassword: string) {
    const cleanOtp = String(otp || "").trim();
    if (!cleanOtp) throw new Error("OTP is required");
    if (!token) throw new Error("Invalid token");
    if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    
    const resetSecret = this.getResetSigningSecret();
    let outer: { purpose?: string; p?: string };
    try {
      outer = jwt.verify(token, resetSecret) as { purpose?: string; p?: string };
    } catch (e) {
      throw new Error("Invalid or expired reset token");
    }

    if (outer.purpose !== "password_reset" || !outer.p) {
      throw new Error("Invalid or expired reset token");
    }

    const decoded = this.decryptResetData(outer.p);
    this.checkAndRecordOtpAttempt(decoded.jti, true);

    const providedHash = crypto.createHmac("sha256", resetSecret).update(`${decoded.jti}:${cleanOtp}`).digest("hex");
    const isHashMatch =
      providedHash.length === decoded.otpHash.length &&
      crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(decoded.otpHash));

    if (decoded.fake === 1 || !decoded.uid) {
      this.checkAndRecordOtpAttempt(decoded.jti, false);
      throw new Error("Invalid or expired reset token");
    }
    
    const user = await prisma.user.findUnique({ where: { id: decoded.uid } });
    if (!user) {
      this.checkAndRecordOtpAttempt(decoded.jti, false);
      throw new Error("User not found");
    }
    
    // Ensure the password hasn't already been reset since this token was issued
    const currentPassDigest = this.computePassDigest(user.passwordHash);
    if (decoded.passDigest && currentPassDigest !== decoded.passDigest) {
      throw new Error("Invalid or expired reset token");
    }
    
    if (!isHashMatch) {
      this.checkAndRecordOtpAttempt(decoded.jti, false);
      throw new Error("Invalid OTP");
    }

    // Consume this reset token JTI so it cannot be replayed
    this.otpAttempts.set(decoded.jti, { count: 999, expiresAt: Date.now() + 15 * 60 * 1000 });
    
    const hadExistingPassword = !!user.passwordHash;
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    
    // Revoke all existing sessions to secure account
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    if (hadExistingPassword) {
      EmailService.sendPasswordResetSuccessEmail(user.email, user.name);
    } else {
      EmailService.sendPasswordCreatedEmail(user.email, user.name);
    }
  }

}



