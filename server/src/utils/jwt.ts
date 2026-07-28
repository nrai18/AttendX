import jwt from "jsonwebtoken";

const getSecret = (type: "access" | "refresh") => {
  const secret = type === "access" ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error(`Missing JWT_${type.toUpperCase()}_SECRET in env`);
  return secret;
};

export const generateAccessToken = (userId: string, role: string) => {
  return jwt.sign({ userId, role }, getSecret("access"), {
    expiresIn: "15m", // Short-lived access token
  });
};

export const generateRefreshToken = (userId: string) => {
  return jwt.sign({ userId }, getSecret("refresh"), {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, getSecret("access")) as { userId: string; role: string };
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, getSecret("refresh")) as { userId: string };
};
