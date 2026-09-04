import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

const APP_URL = process.env.FRONTEND_URL || "https://attendx.app";
const LOGO_URL = "https://drive.google.com/uc?export=view&id=1TzH4-HmFy5r11SC1H3Ryoa5zBhWF0FnT"; // Replace with AttendX logo if available

export class EmailService {
  static async sendWelcomeEmail(email: string, name: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #6366f1; padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: left; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 24px; }
          .button-container { text-align: center; margin: 40px 0; }
          .button { background: #8b5cf6; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 14px 0 rgba(139,92,246,0.39); }
          .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
          .links a { color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <!-- Icon placeholder -->
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>Welcome to AttendX!</h1>
          </div>
          <div class="content">
            <p>Hey ${name},</p>
            <p>I'm thrilled you've joined AttendX! We built this platform to help you track your attendance effortlessly, stay above your target percentage, and never worry about missing a class again.</p>
            <p>You can start adding your subjects, importing your timetable, and syncing with your peers today.</p>
            <div class="button-container">
              <a href="${APP_URL}" class="button">Get Started Now</a>
            </div>
            <p>If you have any questions, just reply to this email. We're always here to help.</p>
            <p>Best,<br>The AttendX Team</p>
          </div>
          <div class="footer">
            <div class="links">
              <a href="${APP_URL}">Website</a>
              <a href="${APP_URL}/download">Download App</a>
            </div>
            <p style="margin-top: 20px;">ï¿½ ${new Date().getFullYear()} AttendX. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'AttendX <welcome@attendx.app>',
        to: email,
        subject: 'Welcome to AttendX! ??',
        html,
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }
  }

  static async sendPasswordResetEmail(email: string, resetToken: string) {
    const resetLink = `${APP_URL}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #111827; padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: left; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 24px; }
          .button-container { text-align: center; margin: 40px 0; }
          .button { background: #ef4444; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; }
          .warning { font-size: 14px; color: #6b7280; text-align: center; background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 32px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset the password for your AttendX account associated with this email address.</p>
            <p>Click the secure link below to choose a new password. This link will expire in 15 minutes for your security.</p>
            <div class="button-container">
              <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            <div class="warning">
              If you did not request a password reset, you can safely ignore this email. Your account remains completely secure.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@attendx.app>',
        to: email,
        subject: 'Reset your AttendX password',
        html,
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  }
}

