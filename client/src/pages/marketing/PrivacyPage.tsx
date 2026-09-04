import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-24 selection:bg-primary/20">
      <header className="pt-8 pb-4 px-6 md:px-12 bg-background/95 backdrop-blur-md sticky top-0 z-10 border-b border-border flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl md:text-2xl font-bold">Privacy Policy</h1>
      </header>
      
      <main className="max-w-4xl mx-auto px-6 md:px-12 py-12 prose prose-invert prose-violet">
        <p className="text-muted-foreground text-sm">Last updated: September 03, 2026</p>
        
        <p className="lead text-lg mt-6">
          At <strong>AttendX</strong>, we believe your academic data is entirely yours. Our fundamental principle is: <strong>Your data is safe, secure, and never sold.</strong> 
        </p>
        <p>
          This Privacy Policy explains exactly what data we collect across our Website and Mobile Application, why we collect it, and how we protect it.
        </p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">1. Information We Collect</h2>
        <p>To provide you with a seamless attendance tracking experience across web and mobile, we collect the following types of information:</p>
        
        <h3 className="text-xl font-semibold mt-6 mb-2">A. Account & Identity Information</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>What we collect:</strong> Your name, email address (specifically @iiitu.ac.in or @gmail.com), encrypted passwords, and your profile picture (either generated or retrieved via Google OAuth).</li>
          <li><strong>Why we need it:</strong> To authenticate you securely, create your account, and personalize your dashboard.</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2">B. Academic & App Data</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>What we collect:</strong> Your subjects, timetable, attendance logs (present, absent, cancelled), assignments, deadlines, and reminder preferences.</li>
          <li><strong>Why we need it:</strong> This is the core of AttendX. We use this data strictly to calculate your attendance percentages, alert you before you drop below the 75% threshold, and manage your academic schedule.</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2">C. Device, Security & Session Data</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>What we collect:</strong> IP addresses, operating system, browser type, device identifiers, and timezones.</li>
          <li><strong>Why we need it:</strong> To provide the <strong>"Active Sessions"</strong> security feature. This allows you to see exactly which laptops or phones are logged into your account and lets you remotely revoke access if you leave your account logged in on a public lab computer.</li>
        </ul>

        <h3 className="text-xl font-semibold mt-6 mb-2">D. Location Data (Mobile App)</h3>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>What we collect:</strong> Approximate location data (if permissions are granted on the mobile app) or timezone-based location inference on the web.</li>
          <li><strong>Why we need it:</strong> We use this strictly to label your Active Sessions (e.g., "Logged in from Delhi, India") so you can easily recognize your own logins and spot suspicious activity. We do not track your continuous physical movements.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">2. How We Use Your Information</h2>
        <p>We do not sell, rent, or trade your personal information. Your data is used exclusively to:</p>
        <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
          <li>Provide, operate, and maintain the AttendX platform.</li>
          <li>Send you automated weekly attendance summary reports via email.</li>
          <li>Send push notifications to your mobile device for upcoming classes, pending assignments, or low attendance warnings.</li>
          <li>Protect your account from unauthorized access.</li>
        </ol>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">3. How We Protect Your Data</h2>
        <p>Your data security is our highest priority:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Password Encryption:</strong> We never store plain-text passwords. All passwords are cryptographically hashed using industry-standard <code>bcrypt</code>.</li>
          <li><strong>Secure Sessions:</strong> We use secure JSON Web Tokens (JWT) to authenticate your devices, meaning your credentials are not continuously passed over the network.</li>
          <li><strong>Isolated Data:</strong> Your academic data is isolated to your account and cannot be viewed by other students.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">4. Third-Party Services</h2>
        <p>We use a select few trusted third-party services to keep AttendX running:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Google:</strong> For users who choose to log in via Google OAuth.</li>
          <li><strong>Email Providers:</strong> To reliably deliver your password reset links and weekly summary reports.</li>
          <li><strong>Capacitor/Firebase:</strong> To deliver push notifications reliably to your Android device.</li>
        </ul>
        <p className="mt-4">These providers only receive the absolute minimum data required to perform their specific function.</p>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">5. Data Retention and Deletion</h2>
        <p>We keep your data only as long as you have an active account with AttendX.</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Your Rights:</strong> You have complete control over your data. You can request a full deletion of your account, attendance logs, and personal information at any time by contacting us. Upon request, your data will be permanently wiped from our databases.</li>
        </ul>

        <h2 className="text-2xl font-bold mt-10 mb-4 text-primary">6. Contact Us</h2>
        <p>If you have any questions or concerns about your privacy, or if you wish to delete your data, please contact the developer:</p>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li><strong>Email:</strong> rai18naman@gmail.com</li>
          <li><strong>Phone:</strong> +91 80764 08958</li>
          <li><strong>GitHub:</strong> <a href="https://github.com/nrai18/AttendX" className="text-primary hover:underline">github.com/nrai18/AttendX</a></li>
        </ul>
      </main>
    </div>
  );
}
