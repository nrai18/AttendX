import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "mock-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-client-secret",
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email || !email.endsWith("@iiitu.ac.in")) {
          return done(new Error("Only @iiitu.ac.in emails are allowed."), false);
        }
        
        // This is where you would lookup or create the user in the database
        // For now, we pass the profile
        return done(null, profile as any);
      } catch (error) {
        return done(error as Error, false);
      }
    }
  )
);

export default passport;
