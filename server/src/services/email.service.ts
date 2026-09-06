import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

const APP_URL = process.env.FRONTEND_URL || "https://attendx.app";
const LOGO_URL = process.env.LOGO_URL || "https://drive.google.com/uc?export=view&id=1TzH4-HmFy5r11SC1H3Ryoa5zBhWF0FnT";
const PADLOCK_URL = process.env.PADLOCK_URL || "https://drive.google.com/uc?export=view&id=1gzfUdkZdazWSs-mE0LAkIYjXQ0y_LjL4";
const DEV_PHOTO_URL = process.env.DEV_PHOTO_URL || "https://github.com/nrai18.png";
 // Replace with AttendX logo if available

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
            
            <!-- Signature Block -->
            <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: left;">
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="width: 90px; vertical-align: top; padding-right: 20px;">
                    <img src="${DEV_PHOTO_URL}" alt="Naman Rai" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover;" />
                  </td>
                  <td style="vertical-align: top; border-left: 3px solid #6366f1; padding-left: 20px;">
                    <h3 style="margin: 0 0 4px 0; font-size: 18px; color: #111827; font-family: sans-serif;">Naman Rai</h3>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6366f1; font-weight: 600; font-family: sans-serif;">Creator & Developer, AttendX</p>
                    
                    <table cellpadding="0" cellspacing="0" style="font-size: 13px; color: #4b5563; line-height: 1.6; font-family: sans-serif;">
                      <tr>
                        <td style="padding-right: 8px; color: #6366f1;"><strong>W:</strong></td>
                        <td><a href="https://attendx.tech" style="color: #4b5563; text-decoration: none;">attendx.tech</a></td>
                      </tr>
                      <tr>
                        <td style="padding-right: 8px; color: #6366f1;"><strong>P:</strong></td>
                        <td><a href="tel:+918076408958" style="color: #4b5563; text-decoration: none;">+91 80764 08958</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 16px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <span style="display: inline-block; border-left: 1px solid #d1d5db; height: 20px; vertical-align: middle; margin-right: 12px;"></span>
                      <img src="${LOGO_URL}" alt="AttendX" style="height: 22px; vertical-align: middle; object-fit: contain;" />
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div class="footer">
            <div class="links">
              <a href="${APP_URL}">Website</a>
              <a href="${APP_URL}/download">Download App</a>
            </div>
            <p style="margin-top: 20px;">&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'AttendX <welcome@mail.attendx.tech>',
        to: email,
        subject: 'Welcome to AttendX! 🎉',
        html,
      });
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }
  }

  static async sendPasswordResetEmail(email: string, otp: string) {
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
          .content { padding: 40px; text-align: center; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 24px; text-align: left; }
          .otp-container { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; margin: 32px auto; display: inline-block; }
          .otp-code { font-size: 42px; font-weight: 900; letter-spacing: 8px; color: #111827; margin: 0; }
          .warning { font-size: 14px; color: #6b7280; text-align: left; background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 32px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <img src="${PADLOCK_URL}" alt="Security Lock" style="width: 140px; height: auto; margin: 0 auto 24px auto; display: block;" />
            <p>Hello,</p>
            <p>We received a request to reset the password for your AttendX account associated with this email address. Please enter the following 6-digit confirmation code in the app to reset your password:</p>
            
            <div style="text-align: center; margin: 36px 0; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
              ${otp.split('').map(digit => `<span style="display: inline-block; width: 48px; height: 60px; line-height: 60px; font-size: 32px; font-weight: 700; color: #4f46e5; border: 1.5px solid #cbd5e1; border-radius: 8px; margin: 0 4px; text-align: center; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">${digit}</span>`).join('')}
            </div>
            
            <p>This code will expire in 15 minutes for your security.</p>
            
            <!-- Signature Block -->
            <div style="margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 24px; text-align: left;">
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="width: 90px; vertical-align: top; padding-right: 20px;">
                    <img src="${DEV_PHOTO_URL}" alt="Naman Rai" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover;" />
                  </td>
                  <td style="vertical-align: top; border-left: 3px solid #6366f1; padding-left: 20px;">
                    <h3 style="margin: 0 0 4px 0; font-size: 18px; color: #111827; font-family: sans-serif;">Naman Rai</h3>
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #6366f1; font-weight: 600; font-family: sans-serif;">Creator & Developer, AttendX</p>
                    
                    <table cellpadding="0" cellspacing="0" style="font-size: 13px; color: #4b5563; line-height: 1.6; font-family: sans-serif;">
                      <tr>
                        <td style="padding-right: 8px; color: #6366f1;"><strong>W:</strong></td>
                        <td><a href="https://attendx.tech" style="color: #4b5563; text-decoration: none;">attendx.tech</a></td>
                      </tr>
                      <tr>
                        <td style="padding-right: 8px; color: #6366f1;"><strong>P:</strong></td>
                        <td><a href="tel:+918076408958" style="color: #4b5563; text-decoration: none;">+91 80764 08958</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 16px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <span style="display: inline-block; border-left: 1px solid #d1d5db; height: 20px; vertical-align: middle; margin-right: 12px;"></span>
                      <img src="${LOGO_URL}" alt="AttendX" style="height: 22px; vertical-align: middle; object-fit: contain;" />
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <div class="warning">
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </div>
          </div>
        </div>
        <div style="text-align: center; margin-top: 24px; color: #9ca3af; font-size: 12px;">
          &copy; ${new Date().getFullYear()} AttendX. All rights reserved.
        </div>
      </body>
      </html>
    `;

    try {
      await resend.emails.send({
        from: process.env.RESEND_SECURITY_EMAIL || process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@mail.attendx.tech>',
        to: email,
        subject: 'Reset your AttendX password',
        html,
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
    }
  }
}
