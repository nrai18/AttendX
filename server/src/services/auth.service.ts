import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt";

export class AuthService {
  static async hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  static async register(data: any) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) throw new Error("Account already exists with this email. Please log in instead.");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: data.name,
      },
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    const hashedRefresh = await this.hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedRefresh,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { user, accessToken, refreshToken };
  }

  static async login(data: any) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.passwordHash) throw new Error("Account does not exist. Please sign up.");

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error("Incorrect password. Please try again.");

    return this.generateTokensForOAuth(user);
  }

  static async generateTokensForOAuth(user: any) {
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    const hashedRefresh = await this.hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedRefresh,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { user, accessToken, refreshToken };
  }

  static async refresh(oldRefreshToken: string) {
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

    const accessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id);
    const hashedNewRefresh = await this.hashToken(newRefreshToken);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedNewRefresh,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
