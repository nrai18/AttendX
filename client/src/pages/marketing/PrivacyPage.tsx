import React from "react";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050508] text-white antialiased">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-sm text-white/50 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
        </Link>
        
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert max-w-none prose-p:text-white/70 prose-headings:text-white">
          <p className="lead text-xl text-white/80 mb-8">
            At AttendX, we take your privacy seriously. This Privacy Policy outlines how we collect, use, and protect your personal and academic information.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">1. Information We Collect</h2>
          <p>
            When you create an account, we collect your name, email address (including college email), and a secure hashed representation of your password. We also securely store academic data such as your class timetable, attendance records, target attendance goals, and classroom activity to provide our service.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">2. How We Use Your Information</h2>
          <p>
            We use your information exclusively to provide the AttendX service. This includes calculating attendance percentages, sending predictive attendance alerts, syncing calendars, and managing classroom communication. We do not sell your personal data to third parties.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">3. Data Security & Storage</h2>
          <p>
            Your account is secured using industry-standard identity management (Neon Auth). All sensitive data is transmitted over encrypted connections (HTTPS) and stored in secure cloud databases. We do not store raw passwords; all passwords are cryptographically hashed.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">4. Academic Data Policy</h2>
          <p>
            AttendX is built for the IIITU ecosystem. The academic data you input (such as timetables and attendance logs) is private to your account unless explicitly shared within a Classroom group.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">5. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or how your data is handled, please reach out via the Contact section on our homepage or email rai18naman@gmail.com.
          </p>

          <div className="mt-16 pt-8 border-t border-white/10 text-white/40 text-sm">
            Last Updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};
