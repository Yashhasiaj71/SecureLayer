'use strict';

const nodemailer = require('nodemailer');
const config = require('../config/environment');

/**
 * Email OTP Provider — implements the OTP delivery interface via Nodemailer.
 *
 * Interface contract: { sendOTP(email: string, otp: string): Promise<void> }
 *
 * This can be replaced with an SMS provider (Twilio, etc.) by implementing
 * the same interface — OTPService does not need to change.
 *
 * SECURITY: OTP is passed as parameter and used only for email body construction.
 * It is never logged here.
 */

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (config.smtp.host === 'ethereal' || !config.smtp.host) {
    console.log('[Email] Generating Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[Email] Ethereal account ready.');
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password,
    },
  });

  return transporter;
};

const emailProvider = {
  /**
   * Send an OTP email to the specified address.
   * @param {string} email - Recipient email
   * @param {string} otp - 6-digit OTP (used once, in this scope only)
   */
  async sendOTP(email, otp) {
    const transport = await getTransporter();

    const mailOptions = {
      from: config.smtp.from || '"SecureLayer" <noreply@securelayer.test>',
      to: email,
      subject: 'SecureLayer — Your Verification Code',
      text: `Your SecureLayer verification code is: ${otp}\n\nThis code expires in ${config.otp.expiryMinutes} minutes.\n\nIf you did not request this code, please ignore this email.\n\nDo not share this code with anyone.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; border-radius: 12px; color: #e2e8f0;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 12px 24px; border-radius: 8px; font-size: 20px; font-weight: 700; color: white; letter-spacing: 2px;">
              SecureLayer
            </div>
          </div>
          <h2 style="color: #f1f5f9; font-size: 22px; margin-bottom: 8px;">Verification Code</h2>
          <p style="color: #94a3b8; font-size: 15px; margin-bottom: 32px;">Enter the following code to verify your identity:</p>
          <div style="background: #1e293b; border: 2px solid #334155; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: #6366f1; font-family: 'Courier New', monospace;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; text-align: center; margin-bottom: 8px;">
            ⏱ Expires in <strong style="color: #94a3b8;">${config.otp.expiryMinutes} minutes</strong>
          </p>
          <p style="color: #64748b; font-size: 13px; text-align: center;">
            🔒 Do not share this code with anyone. SecureLayer will never ask for your code.
          </p>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
          <p style="color: #475569; font-size: 12px; text-align: center;">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      `,
    };

    try {
      const info = await transport.sendMail(mailOptions);
      if (config.smtp.host === 'ethereal' || !config.smtp.host) {
        console.log('[Email] Preview URL: ' + nodemailer.getTestMessageUrl(info));
      }
      console.log(`[Email] OTP sent successfully to ${email}`);
    } catch (error) {
      console.error('[Email] Failed to send OTP email:', error.message);
      throw Object.assign(new Error('Failed to send verification email. Please verify your email configuration or try again later.'), {
        status: 502,
        code: 'EMAIL_SEND_FAILED'
      });
    }
    // SECURITY: otp is not logged here — it goes out of scope after this function
  },

  /**
   * Send an email notifying a user that someone requested access to their file.
   */
  async sendAccessRequestEmail(ownerEmail, requesterEmail, filename) {
    const transport = await getTransporter();
    const mailOptions = {
      from: config.smtp.from || '"SecureLayer" <noreply@securelayer.test>',
      to: ownerEmail,
      subject: 'SecureLayer — New File Access Request',
      text: `${requesterEmail} has requested access to your file: ${filename}.\n\nPlease log in to your SecureLayer dashboard to approve or deny this request.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; border-radius: 12px; color: #e2e8f0;">
          <h2 style="color: #f1f5f9;">File Access Request</h2>
          <p><strong>${requesterEmail}</strong> has requested access to view your file:</p>
          <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <code style="color: #6366f1;">${filename}</code>
          </div>
          <p>Please log in to your SecureLayer dashboard to approve or deny this request.</p>
        </div>
      `,
    };

    try {
      await transport.sendMail(mailOptions);
    } catch (error) {
      console.error('[Email] Failed to send access request email:', error.message);
    }
  },

  /**
   * Send an email notifying a user that their request was approved.
   */
  async sendAccessGrantedEmail(requesterEmail, ownerEmail, filename) {
    const transport = await getTransporter();
    const mailOptions = {
      from: config.smtp.from || '"SecureLayer" <noreply@securelayer.test>',
      to: requesterEmail,
      subject: 'SecureLayer — File Access Granted',
      text: `${ownerEmail} has granted you access to view the file: ${filename}.\n\nYou can now view this file securely in your SecureLayer dashboard.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; border-radius: 12px; color: #e2e8f0;">
          <h2 style="color: #10b981;">Access Granted</h2>
          <p><strong>${ownerEmail}</strong> has granted you access to view the file:</p>
          <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <code style="color: #6366f1;">${filename}</code>
          </div>
          <p>You can now view this file securely in your SecureLayer Global Files dashboard.</p>
        </div>
      `,
    };

    try {
      await transport.sendMail(mailOptions);
    } catch (error) {
      console.error('[Email] Failed to send access granted email:', error.message);
    }
  },

  /**
   * Verify SMTP connection (used at startup for health check).
   */
  async verify() {
    const transport = await getTransporter();
    return transport.verify();
  },
};

module.exports = emailProvider;
