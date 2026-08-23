import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuthStore } from "../../stores/authStore";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.endsWith("@iiitu.ac.in") && !email.endsWith("@gmail.com")) {
      setError("Please use an @iiitu.ac.in or @gmail.com email address.");
      return;
    }

    setLoading(true);

    try {
      const { api } = await import("../../lib/api");
      const res = await api.post("/auth/login", { email, password });
      const { user, accessToken } = res.data;
      setAuth(user, accessToken);
      navigate("/today");
    } catch (err: any) {
      console.error("Login Failed:", err);
      setError(err.response?.data?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 antialiased relative">
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
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">Log in to manage your attendance</p>
        </div>

        {/* Card Form */}
        <Card className="bg-[#0c0d12]/90 border-border shadow-2xl backdrop-blur-xl">
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
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    className="pl-9 bg-white/5 border-border focus:border-primary text-white"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-4">
              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 rounded-xl">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Log In <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
              <div className="text-center text-sm text-muted-foreground mt-4">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
