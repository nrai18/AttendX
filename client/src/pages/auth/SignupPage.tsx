import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { api, API_BASE_URL } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoCoords, setGeoCoords] = useState<{lat: number, lon: number} | null>(null);

  React.useEffect(() => {
    // Initialize GoogleSignIn on native platforms
    if (Capacitor.isNativePlatform()) {
      GoogleSignIn.initialize({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com', 
      }).catch(console.error);
    }
  }, []);

  const handleGoogleLogin = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        setLoading(true);
        setError(null);
        const result = await GoogleSignIn.signIn();
        
        // Send the idToken to our backend to generate our own JWT
        const res = await api.post("/auth/google/native", { idToken: result.idToken }, {
          headers: geoCoords ? { 'x-attendx-lat': geoCoords.lat, 'x-attendx-lon': geoCoords.lon } : {}
        });
        
        setAuth(res.data.user, res.data.accessToken);
        navigate("/today");
      } catch (err: any) {
        console.error("Native Google Login failed:", err);
        if (err.message && !err.message.toLowerCase().includes("canceled")) {
           setError("Google Sign-In failed.");
        }
      } finally {
        setLoading(false);
      }
    } else {
      window.location.href = `${API_BASE_URL}/auth/google` + (geoCoords ? `?lat=${geoCoords.lat}&lon=${geoCoords.lon}` : "");
    }
  };

  React.useEffect(() => {
    let mounted = true;
    const fetchLoc = async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        if (Capacitor.isNativePlatform()) {
          const hasPerms = await Geolocation.checkPermissions();
          if (hasPerms.location !== 'granted') await Geolocation.requestPermissions();
        }
        const pos = await Geolocation.getCurrentPosition({ timeout: 15000, maximumAge: 300000, enableHighAccuracy: false });
        if (mounted) setGeoCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      } catch(e) {}
    };
    fetchLoc();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 flex items-center justify-center p-4 antialiased relative">
      <Button 
        variant="ghost" 
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-slate-600 dark:text-slate-50/60 hover:text-slate-900 dark:text-slate-50"
      >
        <ArrowLeft className="w-4 h-4" />
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
              className="w-full h-11 rounded-xl border-slate-300 dark:border-[#333333] hover:bg-slate-50 dark:bg-[#050505]/50 font-semibold text-slate-900 dark:text-slate-50 bg-transparent"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </>
              )}
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
