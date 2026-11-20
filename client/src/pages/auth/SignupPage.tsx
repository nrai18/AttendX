import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { API_BASE_URL } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { Capacitor } from "@capacitor/core";
import { hapticMedium, hapticSuccess, hapticError } from "../../utils/haptics";
import { SoundFX } from "../../utils/soundEffects";
import {
  ensureGoogleSignInInitialized,
  getCachedLocationHeaders,
  isGoogleSignInCanceledError,
  signInWithNativeGoogle,
  warmUpAuthServer,
} from "../../utils/nativeGoogleAuth";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [loading, setLoading] = useState(false);
  const [googleStatus, setGoogleStatus] = useState("Connecting to Google...");
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    // Wake Render backend & pre-initialize GoogleSignIn while user is on Signup screen
    warmUpAuthServer();
    if (Capacitor.isNativePlatform()) {
      ensureGoogleSignInInitialized().catch(console.error);
    }
  }, []);

  const handleGoogleLogin = async () => {
    hapticMedium();
    if (Capacitor.isNativePlatform()) {
      try {
        setLoading(true);
        setGoogleStatus("Opening Google...");
        setError(null);
        const authResult = await signInWithNativeGoogle((status) => setGoogleStatus(status));

        hapticSuccess();
        SoundFX.playLoginChimeSound();
        setAuth(authResult.user, authResult.accessToken, authResult.refreshToken);
        let target = "/today";
        try {
          const saved = sessionStorage.getItem("post_login_redirect");
          if (saved && saved.startsWith("/")) {
            sessionStorage.removeItem("post_login_redirect");
            target = saved;
          }
        } catch {}
        navigate(target);
      } catch (err: any) {
        hapticError();
        console.error("Native Google Signup failed:", err);
        if (!isGoogleSignInCanceledError(err)) {
          const isNetworkOrTimeout = !err?.response || err?.code === "ECONNABORTED" || err?.response?.status >= 500;
          setError(
            err?.response?.data?.message ||
              (isNetworkOrTimeout
                ? "Server is taking longer than usual to wake up. Tap Continue with Google to retry."
                : err?.message || "Google Sign-In failed. Please try again.")
          );
        }
      } finally {
        setLoading(false);
        setGoogleStatus("Connecting to Google...");
      }
    } else {
      const cached = getCachedLocationHeaders();
      const qs = cached["x-attendx-lat"] && cached["x-attendx-lon"]
        ? `?lat=${cached["x-attendx-lat"]}&lon=${cached["x-attendx-lon"]}`
        : "";
      window.location.href = `${API_BASE_URL}/auth/google${qs}`;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 flex items-center justify-center p-4 antialiased relative">
      <Button 
        variant="ghost" 
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-slate-600 dark:text-slate-50/60 hover:text-slate-900 dark:text-slate-50 transition-all duration-300 active:scale-90 hover:gap-3 cursor-pointer z-20"
      >
        <ArrowLeft className="w-4 h-4 transition-transform duration-300" />
        Back to Home
      </Button>

      <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in relative z-10">
        <div className="text-center space-y-2">
          <img src="/attendx_logo_lockup.png" alt="AttendX Logo" className="h-16 w-auto object-contain mx-auto mb-6 dark:brightness-0 dark:invert" />
          <h1 className="text-3xl font-extrabold tracking-tight">Create Account</h1>
          <p className="text-sm text-slate-600 dark:text-slate-50/60">Join AttendX to organize your academic schedule</p>
        </div>

        <Card className="bg-white dark:bg-[#111111] rounded-none border-slate-300 dark:border-[#333333] shadow-2xl backdrop-blur-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign Up</CardTitle>
            <CardDescription>Use your university or Google account to join.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium text-center">
                {error}
              </div>
            )}
            
            <div className="p-4 bg-slate-100 dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#333333] rounded-xl mb-4 text-center">
               <p className="text-sm font-medium text-slate-700 dark:text-slate-300">To ensure a secure environment and prevent spam, AttendX exclusively supports Google Sign-In with verified domains.</p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-0">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full h-11 rounded-xl border-slate-300 dark:border-[#333333] hover:bg-slate-50 dark:bg-[#050505]/50 font-semibold text-slate-900 dark:text-slate-50 bg-transparent transition-all duration-300 relative overflow-hidden group"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span>{googleStatus}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center w-full"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </motion.div>
                )}
              </AnimatePresence>
            </Button>

            <div className="text-center text-xs text-slate-600 dark:text-slate-50/60 pt-2">
              Already have an account?{" "}
              <Link to="/login" className="text-[#E63946] font-semibold hover:underline">
                Sign In
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};


