import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import { EmailService } from "../services/email.service";

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
        
        const name = profile.displayName || profile.name?.givenName || "Student";
        const avatarUrl = profile.photos?.[0]?.value || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}`;

        let user = await prisma.user.findUnique({ where: { email } });
        
        if (!user) {
          // New User
          user = await prisma.user.create({
            data: {
              email,
              googleId: profile.id,
              name,
              avatarUrl,
              role: "student",
            }
          });
          
          // Fire welcome email asynchronously
          EmailService.sendWelcomeEmail(user.email, user.name);
        } else {
          // Existing User - just update Google info
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: profile.id,
              // Only update avatar if they didn't have one
              avatarUrl: user.avatarUrl ? user.avatarUrl : avatarUrl,
            }
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, false);
      }
    }
  )
);

export default passport;
