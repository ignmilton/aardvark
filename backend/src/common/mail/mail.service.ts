import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Mail service for sending emails.
 * Uses SMTP transport configured via environment variables.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private fromName: string;
  private fromEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
    this.fromName = this.configService.get<string>('mail.fromName', 'Aardvark');
    this.fromEmail = this.configService.get<string>('mail.fromEmail', 'noreply@aardvark.local');
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port');
    const secure = this.configService.get<boolean>('mail.secure');
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');

    if (!host) {
      this.logger.warn('SMTP host not configured - emails will not be sent');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });

      // Verify connection on startup
      this.transporter.verify().then(() => {
        this.logger.log(`Mail service connected to ${host}:${port}`);
      }).catch((error) => {
        this.logger.error(`Mail service failed to connect: ${error.message}`);
        this.transporter = null;
      });
    } catch (error) {
      this.logger.error(`Failed to initialize mail transporter: ${error.message}`);
      this.transporter = null;
    }
  }

  /**
   * Send an email
   */
  async send(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Email not sent to ${options.to} - mail service not configured`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, resetUrl: string): Promise<boolean> {
    return this.send({
      to: email,
      subject: 'Reset Your Aardvark Password',
      text: `You requested a password reset. Click this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>You requested a password reset for your Aardvark account.</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification(email: string, verifyUrl: string): Promise<boolean> {
    return this.send({
      to: email,
      subject: 'Verify Your Aardvark Email',
      text: `Welcome to Aardvark! Please verify your email by clicking this link: ${verifyUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Aardvark!</h2>
          <p>Thanks for signing up. Please verify your email address to get started.</p>
          <p>
            <a href="${verifyUrl}" style="display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Verify Email
            </a>
          </p>
        </div>
      `,
    });
  }

  /**
   * Check if mail service is configured
   */
  isConfigured(): boolean {
    return this.transporter !== null;
  }
}
