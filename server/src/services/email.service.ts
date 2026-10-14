import { Resend } from 'resend';
import jwt from 'jsonwebtoken';

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[EmailService] Warning: RESEND_API_KEY is not set in environment.");
    }
    resendClient = new Resend(apiKey || "re_missing_key_fallback");
  }
  return resendClient;
}

const RAW_APP_URL = (
  process.env.PUBLIC_APP_URL ||
  (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes("localhost")
    ? process.env.FRONTEND_URL
    : "https://www.attendx.tech")
)
  .trim()
  .replace(/\/+$/, "");
const APP_URL = RAW_APP_URL.replace(/^https?:\/\/attendx\.tech$/i, "https://www.attendx.tech");
const PRIVACY_URL = `${APP_URL}/privacy`;
const TERMS_URL = `${APP_URL}/terms`;
const APP_DOWNLOAD_URL = (
  process.env.APP_DOWNLOAD_LINK ||
  "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk"
).trim();
const LOGO_URL = "https://www.attendx.tech/attendx_app_icon.png";
const PADLOCK_URL = "https://www.attendx.tech/attendx_app_icon.png"; // Fallback to logo for padlock if not provided, or we can use the original
const DEV_PHOTO_URL = "https://www.attendx.tech/developer-photo.jpg";

// SEC FIX: HTML escape helper to prevent XSS in email templates
function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class EmailService {
  /**
   * Robust email dispatcher with automatic error detection, FailureLog recording,
   * and fallback to verified Resend test domain (onboarding@resend.dev) if custom domain is unverified.
   */
  static async sendEmailSafe(payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    context?: string;
  }): Promise<{ success: boolean; data?: any; error?: any }> {
    console.info(`[EmailService:Attempt] Dispatching "${payload.subject}" to ${payload.to} (Sender: ${payload.from})`);

    try {
      const client = getResendClient();
      const result = await client.emails.send(payload);
      if (result.error) {
        console.warn(`[EmailService:PrimaryFailed] Primary dispatch failed using "${payload.from}":`, {
          statusCode: result.error.statusCode,
          message: result.error.message || result.error,
          name: result.error.name
        });
        
        // Check if error is due to unverified custom domain
        const isDomainError = result.error.statusCode === 400 || 
                              result.error.statusCode === 403 || 
                              String(result.error.message || "").toLowerCase().includes("verified");
        
        if (isDomainError && !payload.from.includes("onboarding@resend.dev")) {
          console.info(`[EmailService:FallbackAttempt] Attempting delivery via verified sender "AttendX <onboarding@resend.dev>" to ${payload.to}...`);
          const fallbackResult = await client.emails.send({
            ...payload,
            from: "AttendX <onboarding@resend.dev>"
          });
          
          if (fallbackResult.error) {
            console.error(`[EmailService:FallbackFailed] Fallback dispatch failed for ${payload.to}:`, {
              statusCode: fallbackResult.error.statusCode,
              message: fallbackResult.error.message,
              name: fallbackResult.error.name
            });

            if (String(fallbackResult.error.message || '').includes("testing emails to your own email address")) {
              console.warn(
                `\n================================================================================\n` +
                `[EmailService:SandboxRestriction] RESEND SANDBOX RESTRICTION:\n` +
                `Delivery to "${payload.to}" was rejected because domain "${payload.from.match(/<([^>]+)>/)?.[1] || payload.from}" is unverified in Resend,\n` +
                `and Resend's sandbox only permits delivery to the registered account owner (rai18naman@gmail.com).\n` +
                `ACTION REQUIRED: Verify DNS records at https://resend.com/domains to send to all student emails.\n` +
                `================================================================================\n`
              );
            }

            try {
              const { FailureLogRecorder } = require("../utils/failureLogRecorder");
              FailureLogRecorder.recordError(fallbackResult.error, undefined, { email: payload.to, subject: payload.subject });
            } catch (e) {}
            return { success: false, error: fallbackResult.error };
          }
          
          console.info(`[EmailService:Success] Successfully delivered email via verified fallback sender to ${payload.to} (ID: ${fallbackResult.data?.id})`);
          return { success: true, data: fallbackResult.data };
        }

        try {
          const { FailureLogRecorder } = require("../utils/failureLogRecorder");
          FailureLogRecorder.recordError(result.error, undefined, { email: payload.to, subject: payload.subject });
        } catch (e) {}
        return { success: false, error: result.error };
      }

      console.info(`[EmailService:Success] Email successfully delivered to ${payload.to} (ID: ${result.data?.id})`);
      return { success: true, data: result.data };
    } catch (err: any) {
      console.error(`[EmailService:Exception] Unexpected error delivering email to ${payload.to}:`, err?.message || err);
      try {
        const { FailureLogRecorder } = require("../utils/failureLogRecorder");
        FailureLogRecorder.recordError(err, undefined, { email: payload.to, subject: payload.subject });
      } catch (e) {}
      return { success: false, error: err };
    }
  }
  static async sendWelcomeEmail(email: string, name: string) {
    const safeName = escapeHtml(name);
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
            <p>Hey ${safeName},</p>
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
                        <td><span style="color: #4b5563; text-decoration: none;">+91 80764 08958</span></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;">Email:</td>
                        <td><a href="mailto:support@attendx.tech" style="color: #6366f1; text-decoration: none; font-weight: 500;">support@attendx.tech</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 20px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div class="links">
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_FROM_EMAIL || 'AttendX <welcome@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Welcome to AttendX! 👋',
      html,
      text: `Welcome to AttendX, ${name}!\n\nWe're thrilled to have you join us. AttendX is designed to make your academic life easier and more organized.\n\nReady to get started? Log in to your dashboard: ${APP_URL}\n\nNeed help? Check out our guides or reply to this email.\n\nBest,\nNaman Rai & The AttendX Team`
    });
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
            <p>Hello,</p>
            <p>We received a request to reset the password for your AttendX account associated with this email address. Please enter the following 6-digit confirmation code in the app to reset your password:</p>
            
            <div style="text-align: center; margin: 28px 0; padding: 20px 8px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; overflow-x: auto;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto; border-collapse: separate; white-space: nowrap;">
                <tr>
                  ${String(otp).replace(/[^0-9]/g, '').split('').map(digit => `
                    <td style="padding: 0 3px;">
                      <div style="width: 38px; height: 52px; line-height: 52px; font-size: 26px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #4f46e5; border: 1.5px solid #cbd5e1; border-radius: 8px; text-align: center; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.06); -webkit-text-size-adjust: none;">${digit}</div>
                    </td>
                  `).join('')}
                </tr>
              </table>
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
                        <td><span style="color: #4b5563; text-decoration: none;">+91 80764 08958</span></td>
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
          <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
          <div>
            <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
            <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
            <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_SECURITY_EMAIL || process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Reset your AttendX password',
      html,
      text: `Reset your AttendX password\n\nHello,\n\nWe received a request to reset your password. Please enter the following 6-digit confirmation code in the app:\n\n${otp}\n\nIf you didn't request this, you can safely ignore this email.\n\nThis code will expire in 15 minutes.`
    });
  }

  static async sendPasswordResetSuccessEmail(email: string, name: string) {
    const safeName = escapeHtml(name);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #10b981; padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: left; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 24px; }
          .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>Password Changed Successfully</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(name)},</p>
            <p>Your AttendX account password has been successfully updated.</p>
            <p>If you made this change, you can safely ignore this email.</p>
            <p><strong>If you did not make this change</strong>, please contact our support team immediately and secure your account.</p>

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
                        <td><span style="color: #4b5563; text-decoration: none;">+91 80764 08958</span></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;">Email:</td>
                        <td><a href="mailto:support@attendx.tech" style="color: #6366f1; text-decoration: none; font-weight: 500;">support@attendx.tech</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 20px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div style="margin-top: 10px;">
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_SECURITY_EMAIL || process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Your password was successfully updated',
      html,
      text: `Password updated\n\nHi ${escapeHtml(name)},\n\nYour AttendX password was successfully updated. If you did not make this change, please contact us immediately.`
    });
  }

  /**
   * Sent when an existing user updates or resets their password through Edit Profile.
   */
  static async sendPasswordChangedEmail(email: string, name: string, timeStr?: string) {
    const safeName = escapeHtml(name || "Student");
    const formattedTime = timeStr || new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 40px 20px; text-align: center; color: white; border-bottom: 4px solid #10b981; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: left; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 20px; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px 20px; margin: 28px 0; color: #991b1b; }
          .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>Password Changed Successfully</h1>
          </div>
          <div class="content">
            <p>Hi ${safeName},</p>
            <p>Your AttendX account password has been successfully updated through your <strong>Edit Profile</strong> settings.</p>
            
            <div class="info-box">
              <table cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px; color: #475569; line-height: 1.8;">
                <tr>
                  <td style="width: 120px; font-weight: 600; color: #1e293b;">Action:</td>
                  <td>Password Updated</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #1e293b;">Timestamp:</td>
                  <td>${escapeHtml(formattedTime)} (IST)</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #1e293b;">Location:</td>
                  <td>Account Settings &rsaquo; Edit Profile</td>
                </tr>
              </table>
            </div>

            <p>If you made this change, your new password is active immediately and you can use it to sign in across all your devices.</p>

            <div class="alert-box">
              <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 15px;">Didn't make this change?</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                If you did not authorize this update, your account may be compromised. Please <a href="${APP_URL}/forgot-password?email=${encodeURIComponent(email)}" style="color: #dc2626; font-weight: 700; text-decoration: underline;">reset your password immediately</a> or reach out to our security desk at <a href="mailto:support@attendx.tech" style="color: #dc2626; font-weight: 700; text-decoration: underline;">support@attendx.tech</a>.
              </p>
            </div>

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
                        <td><span style="color: #4b5563; text-decoration: none;">+91 80764 08958</span></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;">Email:</td>
                        <td><a href="mailto:support@attendx.tech" style="color: #6366f1; text-decoration: none; font-weight: 500;">support@attendx.tech</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 20px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div style="margin-top: 10px;">
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_SECURITY_EMAIL || process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Security Alert: Your AttendX Password Was Changed',
      html,
      text: `Password Updated\n\nHi ${safeName},\n\nYour AttendX account password has been updated through Edit Profile on ${formattedTime} (IST).\n\nIf you made this change, no further action is required. If you did not make this change, please reset your password immediately or contact support@attendx.tech.`
    });
  }

  /**
   * Sent when a user (e.g. Google Sign-In account) creates an account password for the first time.
   */
  static async sendPasswordCreatedEmail(email: string, name: string, timeStr?: string) {
    const safeName = escapeHtml(name || "Student");
    const safeEmail = escapeHtml(email);
    const formattedTime = timeStr || new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #4f46e5; padding: 40px 20px; text-align: center; color: white; border-bottom: 4px solid #818cf8; }
          .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: left; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 20px; }
          .feature-box { background: #eef2ff; border: 1px solid #c7d2fe; border-left: 4px solid #6366f1; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 16px 20px; margin: 28px 0; color: #991b1b; }
          .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>Password Created Successfully</h1>
          </div>
          <div class="content">
            <p>Hi ${safeName},</p>
            <p>You have successfully created a password for your AttendX account via your <strong>Edit Profile</strong> settings.</p>
            
            <div class="feature-box">
              <p style="margin: 0 0 10px 0; font-weight: 700; color: #312e81; font-size: 15px;">Two Ways to Sign In to Your Account</p>
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #4338ca;">
                Because you originally signed up with Google, you now have complete flexibility to log in whenever and wherever you need:
              </p>
              <table cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px; color: #3730a3; line-height: 1.8;">
                <tr>
                  <td style="width: 28px; vertical-align: top; font-weight: 700; color: #4f46e5;">&#10004;</td>
                  <td><strong>Continue with Google:</strong> Instant one-tap sign-in with your Google account.</td>
                </tr>
                <tr>
                  <td style="width: 28px; vertical-align: top; font-weight: 700; color: #4f46e5;">&#10004;</td>
                  <td><strong>Email & Password:</strong> Enter your registered email (<code>${safeEmail}</code>) and your newly created password.</td>
                </tr>
              </table>
            </div>

            <p>This allows you to access AttendX seamlessly across any device, browser, or app environment without requiring active Google authentication.</p>

            <div class="info-box">
              <table cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px; color: #475569; line-height: 1.8;">
                <tr>
                  <td style="width: 120px; font-weight: 600; color: #1e293b;">Account Email:</td>
                  <td>${safeEmail}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #1e293b;">Action:</td>
                  <td>Account Password Created</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #1e293b;">Created At:</td>
                  <td>${escapeHtml(formattedTime)} (IST)</td>
                </tr>
              </table>
            </div>

            <div class="alert-box">
              <p style="margin: 0 0 6px 0; font-weight: 700; font-size: 15px;">Didn't set this password?</p>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                If you did not authorize setting a password for your account, an unauthorized party may have accessed your session. Please <a href="${APP_URL}/forgot-password?email=${encodeURIComponent(email)}" style="color: #dc2626; font-weight: 700; text-decoration: underline;">reset your password</a> or reach out to our team immediately at <a href="mailto:support@attendx.tech" style="color: #dc2626; font-weight: 700; text-decoration: underline;">support@attendx.tech</a>.
              </p>
            </div>

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
                        <td><span style="color: #4b5563; text-decoration: none;">+91 80764 08958</span></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;">Email:</td>
                        <td><a href="mailto:support@attendx.tech" style="color: #6366f1; text-decoration: none; font-weight: 500;">support@attendx.tech</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 20px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div style="margin-top: 10px;">
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_SECURITY_EMAIL || process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Password Created: You Can Now Sign In With Your Password | AttendX',
      html,
      text: `Password Created Successfully\n\nHi ${safeName},\n\nYou have successfully created a password for your AttendX account (${email}) on ${formattedTime} (IST).\n\nYou can now sign in using either 'Continue with Google' or your Email & Password.\n\nIf you did not create this password, please contact support@attendx.tech immediately.`
    });
  }

  static async sendNewDeviceLoginEmail(email: string, name: string, userAgent: string, time: string) {
    const safeName = escapeHtml(name);
    const safeUserAgent = escapeHtml(userAgent);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #f59e0b; padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: left; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 24px; }
          .device-box { background: #fffbeb; border: 1px solid #fde68a; padding: 20px; border-radius: 8px; margin-bottom: 24px; }
          .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>New Login Alert</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(name)},</p>
            <p>We noticed a new login to your AttendX account from a device or location we don't recognize.</p>
            <div class="device-box">
              <p style="margin:0;"><strong>Time:</strong> ${time}</p>
              <p style="margin:8px 0 0 0;"><strong>Device/Browser:</strong> ${userAgent}</p>
            </div>
            <p>If this was you, you can safely ignore this email.</p>
            <p><strong>If this wasn't you</strong>, please <a href="${APP_URL}/forgot-password?email=${encodeURIComponent(email)}" style="color: #dc2626; font-weight: 700; text-decoration: underline;">reset your password immediately</a> to secure your account.</p>

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
                        <td><span style="color: #4b5563; text-decoration: none;">+91 80764 08958</span></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;">Email:</td>
                        <td><a href="mailto:support@attendx.tech" style="color: #6366f1; text-decoration: none; font-weight: 500;">support@attendx.tech</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 20px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div style="margin-top: 10px;">
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_SECURITY_EMAIL || process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Security Alert: New login to your AttendX account',
      html,
      text: `Security Alert: New login to your AttendX account\n\nHi ${escapeHtml(name)},\n\nWe detected a new login to your AttendX account from the following device:\n\nDevice: ${userAgent}\nTime: ${time}\n\nIf this was you, you can ignore this email. If you don't recognize this activity, please reset your password immediately.`
    });
  }


  static async sendAccountDeletionEmail(email: string, name: string) {
    const safeName = escapeHtml(name);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #ef4444; padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: left; color: #374151; line-height: 1.6; }
          .content p { font-size: 16px; margin-bottom: 24px; }
          .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${LOGO_URL}" alt="AttendX Logo" style="height: 64px; margin-bottom: 16px; object-fit: contain;" />
            <h1>Account Deleted</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(name)},</p>
            <p>We're confirming that your AttendX account has been permanently deleted as requested.</p>
            <p>All of your personal data, timetable records, and active sessions have been erased from our servers.</p>
            <p>We're sorry to see you go! If you ever change your mind, you're always welcome back.</p>

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
                        <td><span style="color: #4b5563; text-decoration: none;">+91 80764 08958</span></td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;">Email:</td>
                        <td><a href="mailto:support@attendx.tech" style="color: #6366f1; text-decoration: none; font-weight: 500;">support@attendx.tech</a></td>
                      </tr>
                    </table>

                    <div style="margin-top: 20px;">
                      <a href="https://www.linkedin.com/in/naman-rai-7b139b324/" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                      <a href="https://github.com/nrai18" style="text-decoration: none; margin-right: 12px; display: inline-block;">
                        <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="GitHub" style="width: 22px; height: 22px; vertical-align: middle;" />
                      </a>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div style="margin-top: 10px;">
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_SECURITY_EMAIL || process.env.RESEND_FROM_EMAIL || 'AttendX Security <security@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Account Permanently Deleted',
      html,
      text: `Account Deleted\n\nHi ${escapeHtml(name)},\n\nYour AttendX account and all associated data have been permanently deleted from our servers.\n\nWe're sorry to see you go!`
    });
  }

  static async sendCustomReport(email: string, name: string, stats: any, title: string) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #6366f1; padding: 30px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 30px; text-align: left; color: #374151; line-height: 1.6; }
          .stat-box { background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .stat-value { font-size: 32px; font-weight: 800; color: #4f46e5; margin: 10px 0 0 0; }
          .stat-label { font-size: 14px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
          .grid { display: table; width: 100%; margin-top: 20px; }
          .grid-col { display: table-cell; width: 50%; padding: 10px; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
          .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${escapeHtml(title)}</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(name)},</p>
            <p>Here is your AttendX ${escapeHtml(title.toLowerCase())} for <strong>${stats.dateRange || 'the period'}</strong>.</p>
            
            <div class="stat-box">
              <p class="stat-label">Overall Attendance</p>
              <p class="stat-value">${(stats.overallPercentage ?? 0).toFixed(2)}%</p>
            </div>

            <div class="grid">
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Attended</p>
                  <p class="stat-value" style="color: #10b981;">${stats.attended ?? 0}</p>
                </div>
              </div>
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Missed</p>
                  <p class="stat-value" style="color: #ef4444;">${stats.missed ?? 0}</p>
                </div>
              </div>
            </div>

            <div class="grid">
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Off / Cancelled</p>
                  <p class="stat-value" style="color: #6b7280;">${stats.off ?? 0}</p>
                </div>
              </div>
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Total Classes</p>
                  <p class="stat-value" style="color: #3b82f6;">${stats.total ?? 0}</p>
                </div>
              </div>
            </div>

            <h3 style="margin-top: 30px; font-size: 16px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Daily Breakdown</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px; font-size: 14px; color: #4b5563;">
              ${stats.dailySummaries && stats.dailySummaries.length > 0 
                ? stats.dailySummaries.map((day: any) => `
                  <tr>
                    <td width="110" valign="top" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                      <strong style="color: #1f2937; font-size: 14px; display: block;">${day.date}</strong>
                    </td>
                    <td valign="top" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                      <div style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-bottom: 4px;">${escapeHtml(day.summary)}</div>
                      ${((day.eventObjects && day.eventObjects.length > 0) || (day.remarks && day.remarks.length > 0)) ? `
                        <div style="margin-top: 6px;">
                          ${day.eventObjects && day.eventObjects.length > 0 ? day.eventObjects.map((e: any) => {
                            const type = e.eventType || 'other';
                            // Match colours to app's calendar colour system
                            const style: Record<string, string> = {
                              holiday:            'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;',
                              restricted_holiday: 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
                              vacation:           'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;',
                              fest:               'background:#fdf4ff;color:#7e22ce;border:1px solid #d8b4fe;',
                              institute:          'background:#e0f2fe;color:#0c4a6e;border:1px solid #7dd3fc;',
                              exam:               'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              midsem:             'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              endsem:             'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              ct:                 'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;',
                              lab_exam:           'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;',
                              other:              'background:#f3f4f6;color:#374151;border:1px solid #d1d5db;',
                            };
                            const s = style[type] || style['other'];
                            return `<span style="${s}padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:600;display:block;margin:4px 0;width:fit-content;">${escapeHtml(e.title || e.name || e.eventName || 'Unnamed Event')}</span>`;
                          }).join('') : ''}
                          ${day.remarks && day.remarks.length > 0 ? day.remarks.map((r: string) => `<span style="background:#fef3c7;color:#d97706;border:1px solid #fde68a;padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:600;display:block;margin:4px 0;width:fit-content;">Remark: ${escapeHtml(r)}</span>`).join('') : ''}
                        </div>
                      ` : ''}
                    </td>
                  </tr>
                `).join('') 
                : '<tr><td style="padding: 10px 0;">No classes recorded in this period.</td></tr>'}
            </table>
            
            <div class="signature">
              <p style="margin: 0;"><strong>AttendX AI</strong><br/>Automated Reporting System</p>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div>
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    const from = process.env.RESEND_REPORTS_EMAIL || 'AttendX Reports <reports@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: title,
      html,
      text: `Hi ${name},\n\nHere is your AttendX ${title.toLowerCase()} for ${stats.dateRange || 'the period'}.\n\nOverall Attendance: ${(stats.overallPercentage ?? 0).toFixed(2)}%\nAttended: ${stats.attended ?? 0}\nMissed: ${stats.missed ?? 0}`
    });
  }

  static async sendWeeklyReport(email: string, name: string, stats: any) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #6366f1; padding: 30px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 30px; text-align: left; color: #374151; line-height: 1.6; }
          .stat-box { background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .stat-value { font-size: 32px; font-weight: 800; color: #4f46e5; margin: 10px 0 0 0; }
          .stat-label { font-size: 14px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
          .grid { display: table; width: 100%; margin-top: 20px; }
          .grid-col { display: table-cell; width: 50%; padding: 10px; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
          .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Weekly Attendance Report</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(name)},</p>
            <p>Here is your AttendX weekly summary for <strong>${stats.dateRange || 'the past 7 days'}</strong>.</p>
            
            <div class="stat-box">
              <p class="stat-label">Overall Attendance</p>
              <p class="stat-value">${(stats.overallPercentage ?? 0).toFixed(2)}%</p>
            </div>

            <div class="grid">
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Attended</p>
                  <p class="stat-value" style="color: #10b981;">${stats.attended ?? 0}</p>
                </div>
              </div>
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Missed</p>
                  <p class="stat-value" style="color: #ef4444;">${stats.missed ?? 0}</p>
                </div>
              </div>
            </div>

            <div class="grid">
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Off / Cancelled</p>
                  <p class="stat-value" style="color: #6b7280;">${stats.off ?? 0}</p>
                </div>
              </div>
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Total Classes</p>
                  <p class="stat-value" style="color: #3b82f6;">${stats.total ?? 0}</p>
                </div>
              </div>
            </div>

            <h3 style="margin-top: 30px; font-size: 16px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Daily Breakdown</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px; font-size: 14px; color: #4b5563;">
              ${stats.dailySummaries && stats.dailySummaries.length > 0 
                ? stats.dailySummaries.map((day: any) => `
                  <tr>
                    <td width="110" valign="top" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                      <strong style="color: #1f2937; font-size: 14px; display: block;">${day.date}</strong>
                    </td>
                    <td valign="top" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                      <div style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-bottom: 4px;">${escapeHtml(day.summary)}</div>
                      ${((day.eventObjects && day.eventObjects.length > 0) || (day.remarks && day.remarks.length > 0)) ? `
                        <div style="margin-top: 6px;">
                          ${day.eventObjects && day.eventObjects.length > 0 ? day.eventObjects.map((e: any) => {
                            const type = e.eventType || 'other';
                            // Match colours to app's calendar colour system
                            const style: Record<string, string> = {
                              holiday:            'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;',
                              restricted_holiday: 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
                              vacation:           'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;',
                              fest:               'background:#fdf4ff;color:#7e22ce;border:1px solid #d8b4fe;',
                              institute:          'background:#e0f2fe;color:#0c4a6e;border:1px solid #7dd3fc;',
                              exam:               'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              midsem:             'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              endsem:             'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              ct:                 'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;',
                              lab_exam:           'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;',
                              other:              'background:#f3f4f6;color:#374151;border:1px solid #d1d5db;',
                            };
                            const s = style[type] || style['other'];
                            return `<span style="${s}padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:600;display:block;margin:4px 0;width:fit-content;">${escapeHtml(e.title || e.name || e.eventName || 'Unnamed Event')}</span>`;
                          }).join('') : ''}
                          ${day.remarks && day.remarks.length > 0 ? day.remarks.map((r: string) => `<span style="background:#fef3c7;color:#d97706;border:1px solid #fde68a;padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:600;display:block;margin:4px 0;width:fit-content;">Remark: ${escapeHtml(r)}</span>`).join('') : ''}
                        </div>
                      ` : ''}
                    </td>
                  </tr>
                `).join('') 
                : '<tr><td style="padding: 10px 0;">No classes recorded in this period.</td></tr>'}
            </table>
            
            <div class="signature">
              <p style="margin: 0;"><strong>AttendX AI</strong><br/>Automated Reporting System</p>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div>
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    const from = process.env.RESEND_REPORTS_EMAIL || 'AttendX Reports <reports@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Your Weekly Attendance Report',
      html,
      text: `Hi ${name},\n\nYour weekly attendance report is ready. Please view the full summary in the AttendX app.`
    });
  }

  static async sendMonthlyReport(email: string, name: string, stats: any) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #6366f1; padding: 30px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 30px; text-align: left; color: #374151; line-height: 1.6; }
          .stat-box { background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .stat-value { font-size: 32px; font-weight: 800; color: #4f46e5; margin: 10px 0 0 0; }
          .stat-label { font-size: 14px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
          .grid { display: table; width: 100%; margin-top: 20px; }
          .grid-col { display: table-cell; width: 50%; padding: 10px; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
          .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; display: flex; align-items: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Monthly Attendance Report</h1>
          </div>
          <div class="content">
            <p>Hi ${escapeHtml(name)},</p>
            <p>Here is your AttendX monthly summary for <strong>${stats.dateRange || 'the past 30 days'}</strong>.</p>
            
            <div class="stat-box">
              <p class="stat-label">Overall Attendance</p>
              <p class="stat-value">${(stats.overallPercentage ?? 0).toFixed(2)}%</p>
            </div>

            <div class="grid">
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Attended</p>
                  <p class="stat-value" style="color: #10b981;">${stats.attended ?? 0}</p>
                </div>
              </div>
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Missed</p>
                  <p class="stat-value" style="color: #ef4444;">${stats.missed ?? 0}</p>
                </div>
              </div>
            </div>

            <div class="grid">
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Off / Cancelled</p>
                  <p class="stat-value" style="color: #6b7280;">${stats.off ?? 0}</p>
                </div>
              </div>
              <div class="grid-col">
                <div class="stat-box" style="margin: 0;">
                  <p class="stat-label">Total Classes</p>
                  <p class="stat-value" style="color: #3b82f6;">${stats.total ?? 0}</p>
                </div>
              </div>
            </div>

            <h3 style="margin-top: 30px; font-size: 16px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Daily Breakdown</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px; font-size: 14px; color: #4b5563;">
              ${stats.dailySummaries && stats.dailySummaries.length > 0 
                ? stats.dailySummaries.map((day: any) => `
                  <tr>
                    <td width="110" valign="top" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                      <strong style="color: #1f2937; font-size: 14px; display: block;">${day.date}</strong>
                    </td>
                    <td valign="top" style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                      <div style="color: #4b5563; font-size: 14px; line-height: 1.5; margin-bottom: 4px;">${escapeHtml(day.summary)}</div>
                      ${((day.eventObjects && day.eventObjects.length > 0) || (day.remarks && day.remarks.length > 0)) ? `
                        <div style="margin-top: 6px;">
                          ${day.eventObjects && day.eventObjects.length > 0 ? day.eventObjects.map((e: any) => {
                            const type = e.eventType || 'other';
                            const style: Record<string, string> = {
                              holiday:            'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;',
                              restricted_holiday: 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;',
                              vacation:           'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;',
                              fest:               'background:#fdf4ff;color:#7e22ce;border:1px solid #d8b4fe;',
                              institute:          'background:#e0f2fe;color:#0c4a6e;border:1px solid #7dd3fc;',
                              exam:               'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              midsem:             'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              endsem:             'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;',
                              ct:                 'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;',
                              lab_exam:           'background:#fff7ed;color:#9a3412;border:1px solid #fdba74;',
                              other:              'background:#f3f4f6;color:#374151;border:1px solid #d1d5db;',
                            };
                            const s = style[type] || style['other'];
                            return `<span style="${s}padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:600;display:block;margin:4px 0;width:fit-content;">${escapeHtml(e.title || e.name || e.eventName || 'Unnamed Event')}</span>`;
                          }).join('') : ''}
                          ${day.remarks && day.remarks.length > 0 ? day.remarks.map((r: string) => `<span style="background:#fef3c7;color:#d97706;border:1px solid #fde68a;padding:5px 12px;border-radius:9999px;font-size:12px;font-weight:600;display:block;margin:4px 0;width:fit-content;">Remark: ${escapeHtml(r)}</span>`).join('') : ''}
                        </div>
                      ` : ''}
                    </td>
                  </tr>
                `).join('') 
                : '<tr><td style="padding: 10px 0;">No classes recorded in this period.</td></tr>'}
            </table>
            
            <div class="signature">
              <p style="margin: 0;"><strong>AttendX AI</strong><br/>Automated Reporting System</p>
            </div>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div>
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    const from = process.env.RESEND_REPORTS_EMAIL || 'AttendX Reports <reports@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: 'Your Monthly Attendance Report',
      html,
      text: `Hi ${name},\n\nYour monthly attendance report is ready. Please view the full summary in the AttendX app.`
    });
  }

  static async sendFeedbackReceipt(email: string, name: string, feedback: { type: string; description: string; issue?: string }): Promise<{ success: boolean; data?: any; error?: any }> {
    const safeName = escapeHtml(name);
    const safeType = escapeHtml(feedback.type || "AttendX");
    const safeDesc = escapeHtml(feedback.description);
    const safeIssue = escapeHtml(feedback.issue || feedback.type || 'Submission');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: #6366f1; padding: 30px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
          .content { padding: 30px; text-align: left; color: #374151; line-height: 1.6; }
          .quote { background: #f3f4f6; border-left: 4px solid #6366f1; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
          .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Feedback Received</h1>
          </div>
          <div class="content">
            <p>Hi ${safeName},</p>
            <p>Thank you for submitting your feedback regarding <strong>${safeType}</strong>.</p>
            <div class="quote">
              <p style="margin: 0; font-style: italic;">"${safeDesc}"</p>
            </div>
            <p>Our engineering team has received your submission and is actively reviewing it. Your input helps us make AttendX better for everyone.</p>
            <p>Best regards,<br/>Naman Rai & The AttendX Team</p>
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <div>
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_FROM_EMAIL || 'AttendX Support <support@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: `AttendX Feedback Received: ${safeIssue}`,
      html,
      text: `Feedback Received\n\nHi ${safeName},\n\nWe received your ${safeType}:\n"${safeDesc}"\n\nOur team is reviewing it. Thank you!`
    });
  }

  static async sendBirthdayGreeting(email: string, name: string): Promise<{ success: boolean; data?: any; error?: any }> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Inter', -apple-system, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center; color: white; }
          .header h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; text-align: center; color: #374151; line-height: 1.6; }
          .content p { font-size: 18px; margin-bottom: 24px; }
          .cake { font-size: 64px; margin-bottom: 20px; }
          .footer { background: #f9fafb; padding: 30px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Happy Birthday, ${name}! 🎉</h1>
          </div>
          <div class="content">
            <div class="cake">🎂</div>
            <p>On behalf of the entire AttendX team (and your AI Copilot), we want to wish you a very happy birthday!</p>
            <p>We hope you have an amazing day filled with joy, celebration, and hopefully a day off from classes! 🎈</p>
            <p>Thank you for being an amazing part of our community.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} AttendX. All rights reserved.</p>
            <p>Naman Rai & The AttendX Team</p>
            <div style="margin-top: 10px;">
              <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
              <a href="${TERMS_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
              <a href="${APP_DOWNLOAD_URL}" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none; margin: 0 10px; font-weight: 500;">Download App</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const from = process.env.RESEND_FROM_EMAIL || 'AttendX Team <team@mail.attendx.tech>';
    return await this.sendEmailSafe({
      from,
      to: email,
      subject: `Happy Birthday from AttendX, ${name}! 🎂`,
      html,
      text: `Happy Birthday, ${name}! On behalf of the entire AttendX team, we want to wish you a very happy birthday! Have an amazing day!`
    });
  }
}
