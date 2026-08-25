import React, { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Moon,
  Sun,
  GraduationCap, 
  ArrowRight, 
  CalendarDays, 
  Bell, 
  Users, 
  Code2, 
  Mail, 
  Phone,
  CheckCircle2,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useThemeStore } from "../../stores/themeStore";

export const LandingPage: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const handleContactSubmit = () => {
    if (!contactName || !contactEmail || !contactMessage) {
      toast.error("Please fill out all fields before sending.");
      return;
    }
    
    // Open user's default email client
    const subject = encodeURIComponent("AttendX Contact Form Inquiry");
    const body = encodeURIComponent(`Name: ${contactName}\nEmail: ${contactEmail}\n\nMessage:\n${contactMessage}`);
    window.location.href = `mailto:rai18naman@gmail.com?subject=${subject}&body=${body}`;
    
    toast.success("Message drafted! Opening your email client...");
    
    // Clear form
    setContactName("");
    setContactEmail("");
    setContactMessage("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/attendx_logo_lockup.png" alt="AttendX Logo" className="h-8 w-auto object-contain" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#about" className="hover:text-foreground transition-colors">About Us</a>
            <a href="#contact" className="hover:text-foreground transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted">
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link to="/login">
              <Button variant="ghost" className="text-foreground/80 hover:text-foreground hover:bg-muted rounded-xl">
                Log in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-105 hidden sm:flex">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
        
        <div className="container mx-auto max-w-5xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border text-sm text-primary mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            AttendX 1.0 is live at IIITU
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
            Take Control of Your <br className="hidden md:block" />
            College Attendance.
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            The ultimate smart attendance tracker designed exclusively for IIITU students. Never worry about falling below the 75% threshold again.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button size="lg" className="h-14 px-8 text-base bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl shadow-primary/20 transition-all hover:-translate-y-1 w-full sm:w-auto">
                Join AttendX Now <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base border-border bg-muted/50 hover:bg-muted rounded-2xl transition-all w-full sm:w-auto text-foreground">
                I already have an account
              </Button>
            </Link>
          </div>

          {/* Hero Video Animation */}
          <div className="mt-16 relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 max-w-4xl mx-auto flex justify-center">
            <video 
              src="/logo_animation.mp4" 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full max-w-2xl h-auto object-cover rounded-2xl"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30 relative">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to succeed</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We built AttendX to solve the exact problems we face every semester. Automated, smart, and beautifully designed.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-background border-border overflow-hidden group hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <CalendarDays className="w-6 h-6 text-primary" />
                </div>
                <CardTitle>Smart Timetable</CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Interactive dynamic timetable that knows exactly what classes you have today and automatically calculates absences.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-background border-border overflow-hidden group hover:border-blue-500/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bell className="w-6 h-6 text-blue-500" />
                </div>
                <CardTitle>Absence Predictions</CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Set your target (e.g. 75%) and AttendX will tell you exactly how many more classes you can safely skip.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-background border-border overflow-hidden group hover:border-purple-500/50 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <CardTitle>Classrooms Hub</CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                  Join your batch's classroom to get official announcements, assignments, and notes directly from your CR.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">About the Creator</h2>
              <div className="w-20 h-1 bg-primary rounded-full" />
              <p className="text-lg text-muted-foreground leading-relaxed">
                AttendX was developed by <strong>Naman Rai</strong>, a student at IIITU who was tired of manually calculating attendance percentages and constantly worrying about falling below the mandatory 75% criteria.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our mission is to provide a seamless, stress-free academic experience. By centralizing timetables, attendance tracking, and classroom communication into one beautiful platform, students can focus on what actually matters: learning.
              </p>
              <ul className="space-y-3 pt-4">
                {[
                  "Built with modern web technologies",
                  "Designed exclusively for the IIITU ecosystem",
                  "Open to feedback and continuous improvement"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground/80">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Creator Card */}
            <div className="w-full md:w-[400px]">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <Card className="relative bg-muted/30 border-border rounded-3xl overflow-hidden">
                  <div className="h-32 bg-gradient-to-br from-primary/20 to-blue-600/20" />
                  <CardContent className="pt-0 relative px-8 pb-8 text-center">
                    <div className="w-24 h-24 rounded-full border-4 border-background bg-muted mx-auto -mt-12 mb-4 flex items-center justify-center overflow-hidden shadow-xl">
                      <img
                        src="/developer-photo.jpg"
                        alt="Naman Rai"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                          }
                        }}
                      />
                      <span className="text-3xl font-bold text-foreground hidden">NR</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1 text-foreground">Naman Rai</h3>
                    <p className="text-primary font-medium mb-4">Founder & Developer</p>
                    <p className="text-muted-foreground text-sm mb-6">
                      Passionate about building scalable web applications and solving real-world student problems.
                    </p>
                    <div className="flex justify-center gap-3">
                      <a href="https://github.com/nrai18" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors text-foreground">
                        <Code2 className="w-5 h-5" />
                      </a>
                      <a href="https://mail.google.com/mail/?view=cm&fs=1&to=24247@iiitu.ac.in,rai18naman@gmail.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors text-foreground">
                        <Mail className="w-5 h-5" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-muted/30">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Get in Touch</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Have a feature request, found a bug, or just want to say hi? Reach out directly.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-12">
            {/* Contact Info */}
            <div className="md:col-span-2 space-y-8">
              <div>
                <h3 className="text-xl font-bold mb-6">Contact Information</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Phone</p>
                      <a href="tel:8076408958" className="text-lg text-foreground hover:text-primary transition-colors">
                        +91 80764 08958
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">Email</p>
                      <a href="https://mail.google.com/mail/?view=cm&fs=1&to=24247@iiitu.ac.in,rai18naman@gmail.com" target="_blank" rel="noreferrer" className="text-lg text-foreground hover:text-blue-500 transition-colors">
                        rai18naman@gmail.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Code2 className="w-6 h-6 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground font-medium mb-1">GitHub Repository</p>
                      <a href="https://github.com/nrai18/AttendX" target="_blank" rel="noreferrer" className="text-lg text-foreground hover:text-gray-300 transition-colors break-all">
                        github.com/nrai18/AttendX
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-3">
              <Card className="bg-background border-border rounded-3xl p-2">
                <CardContent className="p-6 md:p-8 space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-muted-foreground">Your Name</Label>
                      <Input 
                        id="name" 
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="bg-muted/50 border-border h-12 rounded-xl focus-visible:ring-primary text-foreground placeholder:text-muted-foreground" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="bg-muted/50 border-border h-12 rounded-xl focus-visible:ring-primary text-foreground placeholder:text-muted-foreground" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-muted-foreground">Message</Label>
                    <textarea 
                      id="message" 
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-xl p-4 min-h-[150px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground resize-none" 
                    />
                  </div>
                  <Button 
                    onClick={handleContactSubmit}
                    className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-lg shadow-primary/20"
                  >
                    Send Message <Send className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-background">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-70">
            <img src="/attendx_logo_lockup.png" alt="AttendX Logo" className="h-6 w-auto object-contain" />
          </div>
          <p className="text-muted-foreground text-sm text-center">
            &copy; {new Date().getFullYear()} Naman Rai. Built for IIITU.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
