import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuthStore } from "../../stores/authStore";
import { API_BASE_URL, api } from "../../lib/api";
import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password State
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    // Initialize GoogleSignIn on native platforms
    if (Capacitor.isNativePlatform()) {
      GoogleSignIn.initialize({
        clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com', 
      }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const err = params.get("error");
    
    if (err) {
      setError("Google Sign-In failed. Please try again.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token) {
      setLoading(true);
      api.get("/users/me", { headers: { Authorization: `Bearer ${token}` } })
          .then(res => {
            setAuth(res.data, token);
            navigate("/today");
          })
          .catch(e => {
            console.error(e);
            setError("Failed to verify Google Login.");
            setLoading(false);
          });
    }
  }, [navigate, setAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/login", { email, password });
      setAuth(res.data.user, res.data.accessToken);
      navigate("/today");
    } catch (e: any) {
      setError(e.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      // Simulate delay for UI purposes since there is no email provider yet
      await new Promise(resolve => setTimeout(resolve, 1000));
      setResetEmailSent(true);
    } catch (e: any) {
      setError(e.response?.data?.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        setLoading(true);
        setError(null);
        const result = await GoogleSignIn.signIn();
        
        // Send the idToken to our backend to generate our own JWT
        const res = await api.post("/auth/google/native", {
          idToken: result.idToken
        });
        
        setAuth(res.data.user, res.data.accessToken);
        navigate("/today");
      } catch (err: any) {
        console.error("Native Google Login failed:", err);
        // User canceled if err.message contains 'canceled'
        if (err.message && !err.message.toLowerCase().includes("canceled")) {
           setError("Google Sign-In failed.");
        }
      } finally {
        setLoading(false);
      }
    } else {
      window.location.href = `${API_BASE_URL}/auth/google`;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden text-foreground antialiased">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
      
      <Button 
        variant="ghost" 
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground z-20"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back
      </Button>

      <div className="w-full max-w-md z-10 space-y-6">
        <div className="text-center space-y-2">
          <img src="/attendx_logo_lockup.png" alt="AttendX Logo" className="h-10 w-auto object-contain mx-auto mb-6" />
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">Log in to manage your attendance</p>
        </div>

        <Card className="bg-card/90 border-border shadow-2xl backdrop-blur-xl">
          {forgotPasswordMode ? (
            <form onSubmit={handleForgotPassword}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Reset Password</CardTitle>
                <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium text-center">
                    {error}
                  </div>
                )}
                
                {resetEmailSent ? (
                  <div className="flex flex-col items-center justify-center py-4 space-y-3 text-center">
                    <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      We've sent a password reset link to <br/>
                      <span className="font-semibold text-foreground">{email}</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
                        className="pl-9 bg-background/50 border-border focus:border-primary text-foreground"
                        placeholder="your.email@iiitu.ac.in"
                      />
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-2">
                {!resetEmailSent && (
                  <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 rounded-xl">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
                  </Button>
                )}
                
                <button 
                  type="button" 
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setResetEmailSent(false);
                    setError(null);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to login
                </button>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Sign In</CardTitle>
                <CardDescription>Enter your credentials to access your account</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium flex items-center justify-between">
                    <span>{error}</span>
                    {error.includes("Account does not exist") && (
                      <Link to="/signup" className="text-rose-300 underline hover:text-rose-200 shrink-0 ml-2">
                        Sign Up Now
                      </Link>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      required
                      className="pl-9 bg-background/50 border-border focus:border-primary text-foreground"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button 
                      type="button" 
                      onClick={() => {
                        setForgotPasswordMode(true);
                        setError(null);
                      }}
                      className="text-xs text-primary hover:underline hover:text-primary/80 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                      required
                      className="pl-9 pr-10 bg-background/50 border-border focus:border-primary text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-4">
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 rounded-xl">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Log In <ArrowRight className="w-4 h-4 ml-2" /></>}
                </Button>
                
                <div className="relative w-full py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-11 rounded-xl border-border hover:bg-background/50 font-semibold text-foreground bg-transparent"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account? <Link to="/signup" className="text-primary hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

