import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GraduationCap, Mail, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { neon } from "../../lib/neon";
import { toast } from "sonner";

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await neon.auth.forgetPassword({ 
        email,
        redirectTo: window.location.origin + "/reset-password"
      });
      
      if (error) {
        toast.error(error.message || "Failed to send reset link");
      } else {
        setIsSent(true);
      }
    } catch (err: any) {
      toast.error("An unexpected error occurred");
      console.error("Forgot Password Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="inline-flex p-4 rounded-full bg-primary/20 text-primary mb-4">
            <Mail className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="text-muted-foreground">
            We've sent a password reset link to <strong>{email}</strong>.
          </p>
          <div className="pt-6">
            <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
              Return to Login
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
              <CardTitle className="text-xl">Reset password</CardTitle>
              <CardDescription>Enter your email and we'll send you a link to reset your password.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@iiitu.ac.in"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    className="pl-9 bg-white/5 border-white/10 focus:border-primary text-white"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 pt-4">
              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 font-semibold h-11 rounded-xl">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send reset link <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-white flex items-center justify-center">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to sign in
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};
