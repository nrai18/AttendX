import React from "react";
import { GraduationCap, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export const TermsPage: React.FC = () => {
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
          <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        </div>

        <div className="prose prose-invert max-w-none prose-p:text-white/70 prose-headings:text-white">
          <p className="lead text-xl text-white/80 mb-8">
            Welcome to AttendX. By accessing or using our platform, you agree to be bound by these Terms of Service. Please read them carefully.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">1. Acceptance of Terms</h2>
          <p>
            By registering for an AttendX account, you agree to comply with and be bound by these Terms. If you do not agree to these Terms, you may not access or use the service.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">2. Description of Service</h2>
          <p>
            AttendX is an academic organization tool designed primarily for students at IIITU. It provides tools for tracking attendance, managing timetables, and communicating within classroom groups. We reserve the right to modify or discontinue any feature at any time without prior notice.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">3. User Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate, current, and complete information during registration. You are solely responsible for the accuracy of the attendance and academic data you input into the platform.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">4. Acceptable Use</h2>
          <p>
            You agree not to use the platform for any unlawful purpose, or to upload or share any content that is offensive, harmful, or violates the rights of others. This includes maintaining respectful communication within Classrooms and Social feeds.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">5. Disclaimer of Warranties</h2>
          <p>
            AttendX is provided on an "as is" and "as available" basis. While we strive for accuracy, we do not guarantee that the predictive attendance calculations or system logs are completely error-free. It is your responsibility to verify your official attendance records with your academic institution.
          </p>

          <div className="mt-16 pt-8 border-t border-white/10 text-white/40 text-sm">
            Last Updated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};
