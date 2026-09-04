import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary/20">
      <header className="pt-8 pb-4 px-6 md:px-12 bg-background/95 backdrop-blur-md sticky top-0 z-10 border-b border-border flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl md:text-2xl font-bold">Terms of Service</h1>
      </header>
      
      <main className="max-w-4xl mx-auto px-6 md:px-12 py-12 prose prose-invert prose-violet">
        <p className="text-muted-foreground text-sm">Last updated: September 03, 2026</p>
        
        <p className="lead text-lg mt-6">
          Welcome to AttendX! By accessing or using our Website (https://attend-x-eta.vercel.app) and Mobile Application, you agree to be bound by these Terms of Service.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">1. Description of Service</h2>
        <p className="text-muted-foreground">
          AttendX is a personal utility tool designed to help students (specifically at IIITU) track their college attendance, manage timetables, and monitor assignments.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">2. Not an Official Record (Disclaimer)</h2>
        <p><strong>AttendX is an independent student utility and is NOT affiliated with the official IIITU administration or ERP systems.</strong></p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>The attendance percentages, alerts, and calculations shown in AttendX rely entirely on the accuracy of the data you manually input.</li>
          <li>We make no guarantees that the data in AttendX will perfectly match the official college records.</li>
          <li><strong>Limitation of Liability:</strong> Under no circumstances shall AttendX or its developer be held liable for academic penalties, debarment, or loss of marks resulting from a discrepancy between AttendX and your official college attendance records. Always verify critical attendance data with your professors or the official college portal.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">3. User Accounts & Security</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Eligibility:</strong> You must use a valid email address (restricted to @iiitu.ac.in and @gmail.com) to register.</li>
          <li><strong>Responsibility:</strong> You are responsible for maintaining the confidentiality of your password and for all activities that occur under your account.</li>
          <li><strong>Shared Devices:</strong> If you use AttendX on a shared college laboratory computer, you are responsible for logging out. You may use the "Active Sessions" feature in settings to remotely revoke access if you forget.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>Use the service for any illegal purpose or in violation of any local laws.</li>
          <li>Attempt to hack, reverse engineer, or disrupt the AttendX servers, database, or API.</li>
          <li>Create automated bots to spam or overload the service.</li>
        </ul>
        <p className="mt-4 text-muted-foreground">We reserve the right to suspend or terminate any account that violates these terms or poses a security threat to the platform.</p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">5. Communications</h2>
        <p className="text-muted-foreground">
          By creating an account, you consent to receive account-related emails (such as weekly summaries, password resets, and welcome emails) and mobile push notifications. You can opt out of weekly summary emails and push notifications at any time via the Settings page.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">6. Modifications to the Service</h2>
        <p className="text-muted-foreground">
          We reserve the right to modify, suspend, or discontinue the service (or any part thereof) at any time, with or without notice. As this is a free tool built for the student community, we cannot guarantee 100% uptime, though we strive to provide a highly reliable experience.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">7. Contact Information</h2>
        <p>If you have any questions about these Terms, please contact us at:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Email:</strong> rai18naman@gmail.com</li>
          <li><strong>Phone:</strong> +91 80764 08958</li>
        </ul>
      </main>
    </div>
  );
}
