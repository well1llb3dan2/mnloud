import { Resend } from 'resend';
import config from '../config/index.js';

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

export const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  if (!resend) {
    console.warn('Resend API key not configured — skipping email send');
    return;
  }

  const { data, error } = await resend.emails.send({
    from: `MN Loud <${config.resend.fromEmail}>`,
    replyTo: config.resend.fromEmail,
    to: toEmail,
    subject: 'Reset Your Password',
    text: `Password Reset\n\nWe received a request to reset your password. Click the link below to choose a new one. This link will expire in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="margin-bottom: 16px;">Password Reset</h2>
        <p style="margin-bottom: 24px; color: #555;">
          We received a request to reset your password. Click the button below to choose a new one.
          This link will expire in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #7c3aed; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Reset Password
        </a>
        <p style="margin-top: 24px; font-size: 13px; color: #888;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error('Resend email error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  console.log('Password reset email sent:', data?.id);
};
