import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')
      || this.configService.get<string>('MAIL_PASSWORD') || '';
    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>('MAIL_FROM')
      || this.configService.get<string>('SMTP_FROM')
      || 'Scholaro <noreply@scholaro.app>';
  }

  private renderTemplate(name: string, context: Record<string, any>): string {
    let template = this.templateCache.get(name);
    if (!template) {
      // Works in both dev (dist/src/mail/) and prod (dist/src/mail/)
      const paths = [
        join(__dirname, 'templates', `${name}.hbs`),
        join(__dirname, '..', '..', 'mail', 'templates', `${name}.hbs`),
      ];
      let html = '';
      for (const p of paths) {
        try { html = readFileSync(p, 'utf-8'); break; } catch { /* try next */ }
      }
      if (!html) {
        this.logger.warn(`Template ${name}.hbs not found, using plain text fallback`);
        return JSON.stringify(context);
      }
      template = Handlebars.compile(html);
      this.templateCache.set(name, template);
    }
    return template(context);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
  }

  async sendWelcomeEmail(
    email: string,
    studentName: string,
    schoolName: string,
    tempPassword: string,
    schoolCode?: string,
  ): Promise<void> {
    const loginUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    const subject = `${studentName}'s school ${schoolName} is now on Scholaro! 🎉`;

    try {
      const html = this.renderTemplate('welcome', { email, studentName, schoolName, tempPassword, loginUrl, schoolCode: schoolCode || '' });
      await this.send(email, subject, html);
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send welcome email to ${email}: ${err.message}`,
      );
    }
  }

  async sendStaffWelcomeEmail(
    email: string,
    name: string,
    roleName: string,
    schoolName: string,
    schoolCode: string,
    tempPassword: string,
  ): Promise<void> {
    const loginUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    const subject = roleName === 'School Admin'
      ? `Your School ${schoolName} is now live on Scholaro! 🚀`
      : `Welcome to ${schoolName} on Scholaro — ${roleName} Account`;

    try {
      const html = this.renderTemplate('staff-welcome', { email, name, roleName, schoolName, schoolCode, tempPassword, loginUrl });
      await this.send(email, subject, html);
      this.logger.log(`Staff welcome email sent to ${email} (${roleName})`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send staff welcome email to ${email}: ${err.message}`,
      );
    }
  }

  async sendResetPasswordEmail(
    email: string,
    token: string,
    schoolName: string,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const subject = `Password Reset — ${schoolName}`;

    try {
      const html = this.renderTemplate('reset-password', { email, token, resetUrl, schoolName });
      await this.send(email, subject, html);
      this.logger.log(`Reset email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send reset email to ${email}: ${err.message}`,
      );
    }
  }
}
