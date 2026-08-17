import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { GraduationCap, Lock, Loader2, ArrowRight, Check, X, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { neon } from "../../lib/neon";
import { toast } from "sonner";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const rules = useMemo(() => {
    return [
      { id: "length", label: "At least 8 characters", valid: password.length >= 8 },
      { id: "upper", label: "One uppercase letter", valid: /[A-Z]/.test(password) },
      { id: "number", label: "One number", valid: /[0-9]/.test(password) },
      { id: "symbol", label: "One special character", valid: /[^A-Za-z0-9]/.test(password) },
    ];
  }, [password]);

  const isPasswordValid = rules.every(r => r.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return;
    if (!token) {
      toast.error("Missing reset token");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await neon.auth.resetPassword({ 
        newPassword: password,
        token 
      });
      
      if (error) {
        toast.error(error.message || "Failed to reset password");
      } else {
        setIsSuccess(true);
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred");
      console.error("Reset Password Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="inline-flex p-4 rounded-full bg-amber-500/20 text-amber-500 mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Invalid Reset Link</h2>
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <div className="pt-6">
            <Button className="w-full" onClick={() => navigate("/forgot-password")}>
              Request New Link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="inline-flex p-4 rounded-full bg-emerald-500/20 text-emerald-500 mb-4">
            <Check className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Password Reset Successful</h2>
          <p className="text-muted-foreground">
            Your password has been changed successfully. You can now sign in with your new password.
          </p>
          <div className="pt-6">
            <Button className="w-full" onClick={() => navigate("/login")}>
              Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-4 antialiased relative">
      <Link 
        to="/" 
        className="absolute top-8 left-8 inline-flex items-center text-sm text-white/50 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </Link>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-500/25 mb-2">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">AttendX</h1>
        </div>

        <Card className="bg-[#0c0d12]/90 border-white/10 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Create new password</CardTitle>
              <CardDescription>Your new password must meet the security requirements.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    required
                    className="pl-9 bg-white/5 border-white/10 focus:border-primary text-white"
                  />
                </div>

                {password.length > 0 && (
                  <div className="pt-2 space-y-1.5">
                    {rules.map(rule => (
                      <div key={rule.id} className="flex items-center gap-2 text-xs">
                        {rule.valid ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-muted-foreground/50" />
                        )}
                        <span className={rule.valid ? "text-emerald-500/90" : "text-muted-foreground"}>
                          {rule.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-4">
              <Button 
                type="submit" 
                disabled={loading || (password.length > 0 && !isPasswordValid)} 
                className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 rounded-xl"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Reset Password <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
