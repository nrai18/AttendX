import React, { useEffect } from 'react';
import { ArrowLeft, FileText, AlertTriangle, ShieldCheck, Scale, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isUserAuthenticated } from '../../stores/authStore';
import { useBackHandlerStore } from '../../stores/backHandlerStore';

export function TermsPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    const isAuth = isUserAuthenticated();
    const hasInternalHistory = Boolean(
      window.history.state &&
      typeof window.history.state.idx === 'number' &&
      window.history.state.idx > 0
    );
    if (hasInternalHistory) {
      navigate(-1);
    } else {
      // Deterministic fallback for cold-boot or memory-evicted instances
      navigate(isAuth ? "/settings" : "/", { replace: true });
    }
  };

  useEffect(() => {
    const unregister = useBackHandlerStore.getState().register(() => {
      handleBack();
      return true;
    });
    return unregister;
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-900 dark:text-slate-50 pb-24 selection:hidden">
      <header className="pt-8 pb-4 px-6 md:px-12 bg-slate-50 dark:bg-[#050505]/95 backdrop-blur-md sticky top-0 z-10 border-b border-slate-300 dark:border-[#333333] flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-muted rounded-full transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-indigo-500" />
          <h1 className="text-xl md:text-2xl font-bold">Terms of Service</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-12 py-12 prose prose-invert prose-violet">
        <p className="text-slate-600 dark:text-slate-50/60 text-sm">Last updated: November 03, 2026</p>

        <p className="lead text-lg mt-6">
          Welcome to <strong>AttendX</strong>. By accessing our Website (https://www.attendx.tech) or using our Android Mobile Application (v4.3.0), you agree to be bound by these Terms of Service.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946] flex items-center gap-2">
          <Scale className="w-5 h-5 inline text-[#E63946]" /> 1. Description of Service
        </h2>
        <p className="text-slate-600 dark:text-slate-50/60">
          AttendX is an autonomous, offline-first personal academic utility designed to assist university students in tracking class attendance, managing timetables, organizing calendar milestones, and monitoring academic eligibility.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 inline text-amber-500" /> 2. Independent Utility & Disclaimer
        </h2>
        <p><strong>AttendX is an independent student utility and is NOT affiliated with, endorsed by, or integrated into official university administrative ERP portals.</strong></p>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Data Source:</strong> Attendance percentages, bunk runway projections, and alerts reflect the timetable slots, syllabus dates, and attendance markings you enter or import.</li>
          <li><strong>No Official Guarantee:</strong> AttendX makes no warranty that calculations will identical-match internal faculty registers or administrative ERP sheets.</li>
          <li><strong>Limitation of Liability:</strong> Under no circumstances shall AttendX or its developers be held liable for academic debarment, attendance penalties, or loss of marks. Always confirm critical attendance margins with your professors or official university portals.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946] flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 inline text-[#E63946]" /> 3. User Accounts & Session Security
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Registration:</strong> Accounts are intended for enrolled students with institutional (@iiitu.ac.in) or verified Google email addresses.</li>
          <li><strong>Shared Computers:</strong> When using AttendX on communal college laboratory systems, you are responsible for signing out. You may use the <em>Linked Devices</em> dashboard in Settings to remotely terminate open sessions.</li>
          <li><strong>Password Integrity:</strong> You are responsible for maintaining the secrecy of your login credentials and password reset verification codes.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946]">4. Acceptable Conduct & Classrooms Hub</h2>
        <p className="text-slate-600 dark:text-slate-50/60">You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li>Attempt to disrupt, reverse-engineer, or overload the AttendX backend API, database, or WebSocket servers.</li>
          <li>Broadcast false, misleading, or abusive announcements to classmates within shared Classroom sections.</li>
          <li>Attempt to impersonate Class Representatives or bypass section broadcast permissions.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946]">5. Automated Features & Hardware Integrations</h2>
        <p className="text-slate-600 dark:text-slate-50/60">
          AttendX includes optional automation features designed for mobile convenience:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Do Not Disturb (DND) Auto-Mute:</strong> With your permission, AttendX temporarily suppresses ringer volume during ongoing lectures. You can enable or disable DND automation at any time in Settings.</li>
          <li><strong>Conversational Voice Mode:</strong> Utilizes device microphone access during active voice sessions. Voice mode may be dismissed or stopped at any moment.</li>
          <li><strong>Local Alarm Scheduling:</strong> Reminders and summaries are scheduled directly into Android's native alarm manager to ensure punctuality even when offline.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946]">6. Service Availability & Modifications</h2>
        <p className="text-slate-600 dark:text-slate-50/60">
          AttendX is provided free of charge to the student community. While we maintain a 99.9% uptime architecture with offline-first synchronization, we reserve the right to deploy updates, perform maintenance, or adjust features without liability.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946] flex items-center gap-2">
          <Mail className="w-5 h-5 inline text-[#E63946]" /> 7. Contact Information
        </h2>
        <p>For questions regarding these Terms of Service, contact:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Email:</strong> support@mail.attendx.tech</li>
          <li><strong>Phone:</strong> +91 80764 08958</li>
        </ul>
      </main>
    </div>
  );
}
