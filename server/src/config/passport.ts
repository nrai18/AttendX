import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "../lib/prisma";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "placeholder_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_client_secret",
      callbackURL: `${process.env.BACKEND_URL || "http://localhost:3000"}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(new Error("No email found from Google profile"));
        }
        
        if (!email.endsWith("@iiitu.ac.in")) {
          return done(new Error("Only @iiitu.ac.in emails are allowed to sign in."));
        }

        // Try to find the user by googleId
        let user = await prisma.user.findUnique({
          where: { googleId: profile.id },
        });

        if (!user) {
          // If not found by googleId, try to find by email (to link accounts)
          user = await prisma.user.findUnique({
            where: { email },
          });

          if (user) {
            // Link the existing account to Google
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id },
            });
          } else {
            // Create a new user
            user = await prisma.user.create({
              data: {
                googleId: profile.id,
                email: email,
                name: profile.displayName || "Google User",
                avatarUrl: profile.photos?.[0]?.value || null,
                role: "student",
              },
            });
          }
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

export default passport;
