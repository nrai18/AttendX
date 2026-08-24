import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, Mail, Lock, User as UserIcon, Loader2, ArrowRight, Check, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { api, API_BASE_URL } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Frontend Validations
    if (!email.endsWith("@iiitu.ac.in") && !email.endsWith("@gmail.com")) {
      setError("Please use an @iiitu.ac.in or @gmail.com email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/auth/register", { name, email, password });
      const { user, accessToken } = res.data;
      setAuth(user, accessToken);
      navigate("/today");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to register. Email may already exist.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-backgroundackground text-foreground flex items-center justify-center p-4 antialiased relative">
      <Button 
        variant="ghost" 
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back
      </Button>
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex rounded-2xl bg-white p-2 shadow-xl shadow-indigo-500/25 mb-2 overflow-hidden">
            <img src="/attendx_logo.png" alt="AttendX Logo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Create Account</h1>
          <p className="text-sm text-muted-foreground">Join AttendX to organize your academic schedule</p>
        </div>

        {/* Card Form */}
        <Card className="bg-[#0c0d12]/90 border-border shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Sign Up</CardTitle>
              <CardDescription>Enter your details to create your student account</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-medium flex items-center justify-between">
                  <span>{error}</span>
                  {error.includes("log in instead") && (
                    <Link to="/login" className="text-rose-300 underline hover:text-rose-200 shrink-0 ml-2">
                      Log In
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    type="text"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    required
                    className="pl-9 bg-white/5 border-border focus:border-primary text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    autoComplete="username email"
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    className="pl-9 bg-white/5 border-border focus:border-primary text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-9 bg-white/5 border-border focus:border-primary text-white"
                  />
                </div>
                
                {password.length > 0 && (
                  <div className="pt-3 pb-2 pl-1 space-y-2 text-xs">
                    <div className={`flex items-center gap-2 ${password.length >= 6 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {password.length >= 6 ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      <span>At least 6 characters</span>
                    </div>
                    <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {/[A-Z]/.test(password) ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      <span>At least 1 uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {/[0-9]/.test(password) ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      <span>At least 1 number</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-4">
              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 rounded-xl">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Get Started <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>

              <div className="relative w-full py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#09090b] px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl border-border hover:bg-white/5 font-semibold text-white bg-transparent"
                onClick={() => window.location.href = `${API_BASE_URL}/auth/google`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </Button>

              <div className="text-center text-xs text-muted-foreground pt-2">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Sign In
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
