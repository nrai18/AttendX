import React from "react";
import { Link } from "react-router-dom";
import { 
  GraduationCap, 
  ArrowRight, 
  Calendar, 
  ShieldCheck, 
  Calculator, 
  BookOpen, 
  FileText,
  Lock,
  ChevronRight,
  Sparkles,
  Check
} from "lucide-react";
import { Button } from "../../components/ui/button";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Institutional Top Banner */}
      <div className="bg-muted/60 border-b border-border py-2 px-4 text-center text-xs font-medium text-muted-foreground flex items-center justify-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>Official Academic Companion for Indian Institute of Information Technology Una (IIITUGORD02)</span>
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 w-full z-50 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight leading-none text-foreground">AttendX</span>
              <span className="text-[10px] text-muted-foreground font-mono mt-0.5">IIIT Una Edition</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <a href="#ordinance-rules" className="hover:text-foreground transition-colors">Ordinance Rules</a>
            <a href="#core-capabilities" className="hover:text-foreground transition-colors">Capabilities</a>
            <a href="#ai-rag" className="hover:text-foreground transition-colors">Policy AI</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Engineering</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-xs font-semibold rounded-lg px-3.5">
                Sign In
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg shadow-sm px-4">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-28 px-6 border-b border-border bg-gradient-to-b from-background via-muted/10 to-background">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-medium text-muted-foreground mx-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>Strictly Compliant with B.Tech Ordinances (IIITUGORD02)</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.15]">
            Academic Intelligence & Attendance Governance for IIIT Una
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Eliminate attendance uncertainty with automated 75% threshold enforcement, predictive shortage grading protection, and vector-grounded ordinance intelligence.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full h-11 px-6 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                Launch AttendX Console <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full h-11 px-6 text-sm font-semibold rounded-lg border-border bg-card hover:bg-accent">
                Sign In to Existing Account
              </Button>
            </Link>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-10 max-w-3xl mx-auto text-left">
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground font-medium">Mandatory Threshold</p>
              <p className="text-xl font-bold font-mono text-foreground mt-1">75.00%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Section 6.1 Compliance</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground font-medium">Shortage Warning</p>
              <p className="text-xl font-bold font-mono text-amber-500 mt-1">55% - 75%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">L Grade Makeup Rule</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground font-medium">Severe Shortage</p>
              <p className="text-xl font-bold font-mono text-rose-500 mt-1">&lt; 55.00%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">R Grade Year Repeat</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-xs text-muted-foreground font-medium">End-Sem Passing</p>
              <p className="text-xl font-bold font-mono text-emerald-500 mt-1">&ge; 30.00%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Section 13.3 Mandate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities Section */}
      <section id="core-capabilities" className="py-20 px-6 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Engineered for Academic Precision
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            AttendX is not a generic to-do list. Every calculation directly reflects IIIT Una's Senate-approved evaluation standards.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Algorithmic Buffer & Safe Leave Calculator</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Calculates real-time safe leave margins and recovery requirements for every enrolled course, accounting for target attendance percentages and conducted lectures.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">Continuous Margin Math</span>
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">Lab & Theory Weightages</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Interactive Timetable & Dynamic Overrides</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Manage slot swaps, extra classes, medical leave waivers, and on-duty (OD) entries with automated Redis cache invalidation for zero stale reads.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">Section 6.8 On-Duty Counted as Present</span>
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">Ad-hoc Slot Rescheduling</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">RAG AI Policy Advisor (IIITUGORD02)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Powered by Google GenAI's 3072-dimensional vector embeddings and Gemini 3.6 Flash. Ask questions on 9-day medical leave limits, hostel roll call extensions, and mess rebate formulas with exact clause citations.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">gemini-embedding-2 Vector DB</span>
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">100% Policy Grounded</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">LightGBM Drop Risk Forecasting</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Machine learning engine that analyzes consecutive absences, lab class strictness, and day-of-week risk factors to alert students before reaching critical shortage thresholds.
            </p>
            <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">Trained LightGBM Classifier</span>
              <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">Proactive Warning Alerts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Ordinance Quick Reference Section */}
      <section id="ordinance-rules" className="py-20 px-6 border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Essential B.Tech Ordinance Clauses
            </h2>
            <p className="text-sm text-muted-foreground">
              Key academic and administrative regulations every IIIT Una student must follow:
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div className="p-5 rounded-xl bg-card border border-border space-y-2.5">
              <span className="text-xs font-mono font-bold text-primary">Section 6.5</span>
              <h4 className="font-bold text-foreground">Short Absence (up to 9 Days)</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Submit medical application to HoD. If approved, the leave period is deducted from the total held classes in the attendance denominator. Admissible once per semester.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border space-y-2.5">
              <span className="text-xs font-mono font-bold text-primary">Section 11.17</span>
              <h4 className="font-bold text-foreground">Mess Rebate Formula (N - 2)</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apply 3 days in advance with Warden approval for vacations or official leaves. Rebate is credited for (N - 2) days where N is the total number of days absent.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border space-y-2.5">
              <span className="text-xs font-mono font-bold text-primary">Section 18</span>
              <h4 className="font-bold text-foreground">B.Tech with Honors (172 Credits)</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Requires SGPA $\ge 8.0$ in first 4 semesters, CGPA $\ge 8.5$ in all 8 semesters, and 4 approved NPTEL/MOOC Elite certificates (12 extra credits).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Engineering & Developer Note */}
      <section id="architecture" className="py-20 px-6 max-w-4xl mx-auto border-t border-border">
        <div className="p-8 rounded-2xl bg-card border border-border space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
              NR
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Developed by Naman Rai</h3>
              <p className="text-xs text-muted-foreground font-mono">B.Tech Student & Software Engineer — IIIT Una</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            AttendX was engineered to solve the persistent anxiety surrounding university attendance math and ordinance navigation. Built as a distributed full-stack system on Node.js/Express, PostgreSQL, Redis, FastAPI, Celery background workers, and LangGraph RAG intelligence.
          </p>

          <div className="flex items-center gap-4 text-xs font-semibold text-primary pt-2">
            <a href="https://github.com/nrai18/AttendX" target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
              GitHub Repository <ChevronRight className="w-3.5 h-3.5" />
            </a>
            <span className="text-muted-foreground/30">•</span>
            <a href="mailto:rai18naman@gmail.com" className="hover:underline">
              rai18naman@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="border-t border-border py-12 px-6 bg-muted/10 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">AttendX Platform</span>
            <span>— Indian Institute of Information Technology Una</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <a href="https://www.iiitu.ac.in" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">IIIT Una Official</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
