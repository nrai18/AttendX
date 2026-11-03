import React, { useEffect } from 'react';
import { ArrowLeft, Shield, Lock, Bell, Mic, VolumeX, MapPin, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isUserAuthenticated } from '../../stores/authStore';
import { useBackHandlerStore } from '../../stores/backHandlerStore';

export function PrivacyPage() {
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
          <Shield className="w-5 h-5 text-emerald-500" />
          <h1 className="text-xl md:text-2xl font-bold">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-12 py-12 prose prose-invert prose-violet">
        <p className="text-slate-600 dark:text-slate-50/60 text-sm">Last updated: November 03, 2026</p>

        <p className="lead text-lg mt-6">
          At <strong>AttendX</strong>, we believe your academic data is entirely yours. Our foundational promise is: <strong>Your data is private, cryptographically secured, and never monetized or sold.</strong>
        </p>
        <p>
          This Privacy Policy outlines how AttendX collects, safeguards, and processes data across our Web application (https://www.attendx.tech) and Android mobile builds (v4.3.0).
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946] flex items-center gap-2">
          <Database className="w-5 h-5 inline text-[#E63946]" /> 1. Information We Collect & Why
        </h2>
        <p>To deliver an intelligent, offline-first attendance companion across web and Android, we collect and process the following information:</p>

        <h3 className="text-xl font-semibold mt-6 mb-2">A. Account & Authentication Credentials</h3>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>What we collect:</strong> Your name, official university email (@iiitu.ac.in) or Google account address, encrypted passwords, and profile picture avatar.</li>
          <li><strong>Why we need it:</strong> To create and authenticate your account securely, identify your student profile, and personalize your timetable view.</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2">B. Academic & Timetable Data</h3>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>What we collect:</strong> Course subjects, timetable lecture/lab slots, room numbers, attendance records (attended, missed, cancelled, extra classes), assignments, and custom calendar milestones.</li>
          <li><strong>Why we need it:</strong> This is the functional core of AttendX. Data is processed locally and in our PostgreSQL database to calculate attendance percentages, compute bunk runway cushions, and alert you before falling below 75%.</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 inline text-amber-500" /> C. Device Sessions & Location Data
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>What we collect:</strong> IP address, device model (e.g., Nothing Phone, Pixel, Windows Chrome), operating system, browser version, and approximate location coordinates when permission is explicitly granted.</li>
          <li><strong>Why we need it:</strong> Powers the <strong>Linked Devices & Active Sessions</strong> security hub. Labeling sessions by city (e.g., "Delhi, India") allows you to verify active logins and remotely terminate unauthorized sessions on shared university lab computers. <em>AttendX never continuously tracks or stores background location routes.</em></li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2 flex items-center gap-2">
          <Mic className="w-4 h-4 inline text-purple-500" /> D. Voice Mode & Microphone Input
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>What we collect:</strong> Transient spoken audio processed on-device during active Voice Mode or hands-free copilot interactions.</li>
          <li><strong>Why we need it:</strong> To transcribe conversational student queries (e.g., "Can I bunk Digital Comm?", "What's my next class?"). Microphone access is only requested upon tapping Voice Mode. <em>Audio recordings are never stored on persistent storage or used to train public models.</em></li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2 flex items-center gap-2">
          <VolumeX className="w-4 h-4 inline text-rose-500" /> E. Do Not Disturb (DND) & Audio Management
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Permissions used:</strong> <code>ACCESS_NOTIFICATION_POLICY</code> and <code>MODIFY_AUDIO_SETTINGS</code>.</li>
          <li><strong>Why we need it:</strong> To automatically silence your mobile phone's ringer during active class lectures and automatically restore previous ringer volume when the period ends. No other system audio settings are modified.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946] flex items-center gap-2">
          <Bell className="w-5 h-5 inline text-[#E63946]" /> 2. Notifications & Communications
        </h2>
        <p>AttendX provides notifications exclusively designed to keep your academic schedule on track:</p>
        <ol className="list-decimal pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Class Heads-Up Reminders:</strong> Local device alarms scheduled 5, 10, or 15 minutes before your class begins with classroom location tags.</li>
          <li><strong>Multi-Frequency Academic Summaries:</strong> Daily Briefings, Weekly Reviews, Monthly Summaries, and Yearly Wrap-ups delivered at your independently configured delivery times.</li>
          <li><strong>Section Broadcasts:</strong> Urgent lecture room changes and Class Representative announcements pushed via Firebase Cloud Messaging (FCM) strictly to enrolled peers of your classroom section.</li>
          <li><strong>Opt-Out:</strong> All notification channels and email summaries can be toggled on or off at any time in Settings.</li>
        </ol>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946] flex items-center gap-2">
          <Lock className="w-5 h-5 inline text-[#E63946]" /> 3. Data Protection & Cryptography
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Password Security:</strong> Passwords are never stored in plain text. They are salted and cryptographically hashed with industry-standard <code>bcrypt</code>.</li>
          <li><strong>Encrypted Transport:</strong> All API communication between mobile/web clients and our backend is strictly encrypted via TLS 1.3 / HTTPS.</li>
          <li><strong>Offline-First Sandbox:</strong> Offline caches and exported ZIP archives reside in your private device application sandbox and cache directories.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946]">4. Third-Party Infrastructure</h2>
        <p>AttendX relies on minimal, enterprise-grade cloud infrastructure to deliver services:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Google OAuth:</strong> For secure one-tap Google single sign-on.</li>
          <li><strong>Firebase Cloud Messaging (Google FCM):</strong> For real-time notification dispatch to Android devices.</li>
          <li><strong>Neon PostgreSQL:</strong> Encrypted serverless database hosting student records with automatic connection pooling.</li>
          <li><strong>Resend:</strong> Secure transactional delivery for verification codes, password resets, and academic summaries.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946]">5. Data Ownership & Deletion Rights</h2>
        <p>You maintain full ownership of your data at all times:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Export:</strong> Download your entire semester dataset into a portable ZIP archive containing structured CSV files at any time via Settings.</li>
          <li><strong>Account Deletion:</strong> You may wipe individual subjects, clear semester logs, or request complete account erasure. Upon account deletion, all sessions, timetable records, and user identifiers are permanently purged from our database.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-[#E63946]">6. Developer Contact</h2>
        <p>If you have any questions regarding this Privacy Policy or wish to request data deletion, contact us:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-600 dark:text-slate-50/60">
          <li><strong>Email:</strong> support@mail.attendx.tech</li>
          <li><strong>Phone:</strong> +91 80764 08958</li>
          <li><strong>Repository:</strong> <a href="https://github.com/nrai18/AttendX" className="text-[#E63946] hover:underline" target="_blank" rel="noreferrer">github.com/nrai18/AttendX</a></li>
        </ul>
      </main>
    </div>
  );
}
