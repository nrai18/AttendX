import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { Button } from "../../components/ui/button";

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-6 sm:px-12 max-w-4xl mx-auto">
      <div className="mb-8">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Button>
        </Link>
      </div>

      <div className="border-b border-border pb-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">AttendX Data Governance & Privacy Architecture — August 2026</p>
          </div>
        </div>
      </div>

      <div className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. Data Collection & Academic Context</h2>
          <p>
            AttendX collects only the essential academic data required to provide personalized attendance tracking, timetable planning, and ordinance compliance. This includes:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Student institutional identification (Name, Roll Number, IIIT Una Email address).</li>
            <li>Enrolled semester schedules, subjects, and elective choices.</li>
            <li>Daily lecture attendance logs and marked overrides (medical leave, on-duty).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. Use of Information</h2>
          <p>
            Your information is exclusively used to:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Compute continuous attendance percentages and safe leave margins.</li>
            <li>Deliver predictive absence risk warnings based on LightGBM machine learning models.</li>
            <li>Power the RAG Policy Advisor for instantaneous answers to institute academic ordinances.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. Data Security & Storage</h2>
          <p>
            All network communication is encrypted via TLS 1.3. User passwords are protected using industry-standard salted bcrypt hashing. Data is stored on enterprise-grade PostgreSQL with isolated tenant security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. Zero Third-Party Monetization</h2>
          <p>
            AttendX does not sell, rent, or monetize student data with third-party advertisers. All analytical processing occurs strictly within the AttendX infrastructure.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">5. Data Deletion & Export</h2>
          <p>
            Under the Settings page, students have the full right to export their complete attendance history in ZIP/CSV format or permanently delete and reset their records at any time.
          </p>
        </section>
      </div>
    </div>
  );
};
