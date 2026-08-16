import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";

export const TermsPage: React.FC = () => {
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
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">AttendX Academic Operating System — Effective August 2026</p>
          </div>
        </div>
      </div>

      <div className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">1. Institutional Scope & Acceptance</h2>
          <p>
            AttendX is an academic tracking, timetable management, and policy compliance platform created for students, faculty, and administrators of the Indian Institute of Information Technology Una (IIIT Una). By registering an account or accessing the services, you agree to comply with these Terms of Service and the official Institute Ordinances (IIITUGORD02).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">2. Academic Integrity & Regulations Alignment</h2>
          <p>
            All calculations, safe leave metrics, buffer formulas, and attendance forecasts provided by AttendX are strictly derived from the official B.Tech Ordinances & Regulations. AttendX serves as a decision-support tool. Official attendance records maintained by the Academic Section and individual Course Instructors remain the authoritative record of academic eligibility.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">3. User Responsibilities & Account Security</h2>
          <p>
            Users are responsible for safeguarding their login credentials. Any automated scraping, unauthorized tampering with attendance logs, or exploitation of classroom feeds is strictly prohibited and subject to institutional disciplinary actions under Section 20 & 21 of the IIIT Una Disciplinary Code.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">4. System Availability & Maintenance</h2>
          <p>
            We strive to ensure continuous availability of AttendX. Scheduled maintenance, updates to academic calendars, and syllabus revisions may occur periodically in coordination with Institute Senate decisions.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">5. Contact & Institutional Redressal</h2>
          <p>
            For inquiries regarding these Terms or academic policy interpretations, contact the development and administrative team at <span className="text-primary font-mono">rai18naman@gmail.com</span>.
          </p>
        </section>
      </div>
    </div>
  );
};
