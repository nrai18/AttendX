import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "mock-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-client-secret",
      callbackURL: process.env.NODE_ENV === "production" 
        ? "/api/auth/google/callback" 
        : "http://localhost:3000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email || (!email.endsWith("@iiitu.ac.in") && !email.endsWith("@gmail.com"))) {
          return done(new Error("Only @iiitu.ac.in or @gmail.com emails are allowed."), false);
        }
        
        // Import Prisma directly from our lib to ensure driver adapter is used
        const { prisma } = require("../lib/prisma");
        
        // Upsert User
        const user = await prisma.user.upsert({
          where: { email },
          update: {
            googleId: profile.id,
            name: profile.displayName || profile.name?.givenName || "Student",
            avatarUrl: profile.photos?.[0]?.value || null,
          },
          create: {
            email,
            googleId: profile.id,
            name: profile.displayName || profile.name?.givenName || "Student",
            avatarUrl: profile.photos?.[0]?.value || null,
            role: "student",
          }
        });

        return done(null, user);
      } catch (error) {
        return done(error as Error, false);
      }
    }
  )
);

export default passport;
