import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, Mail, Lock, Loader2, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { useAuthStore } from "../../stores/authStore";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("dev@iiitu.ac.in");
  const [password, setPassword] = useState("password");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { api } = await import("../../lib/api");
      const res = await api.post("/auth/login", { email, password });
      const { user, accessToken } = res.data;
      setAuth(user, accessToken);
      navigate("/today");
    } catch (err: any) {
      console.error("Login Failed:", err);
      // The global API interceptor will display the detailed toast error.
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
          <h1 className="text-3xl font-extrabold tracking-tight">AttendX Dev Mode</h1>
          <p className="text-sm text-muted-foreground">Log in directly to access the dashboard</p>
        </div>

        {/* Card Form */}
        <Card className="bg-[#0c0d12]/90 border-white/10 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Dev Sign In</CardTitle>
              <CardDescription>Bypass backend authentication credentials for quick feature testing</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="dev@iiitu.ac.in"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    className="pl-9 bg-white/5 border-white/10 focus:border-primary text-white"
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
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    className="pl-9 bg-white/5 border-white/10 focus:border-primary text-white"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-4">
              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 rounded-xl">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Dev Login <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
