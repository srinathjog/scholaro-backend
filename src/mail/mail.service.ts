import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendWelcomeEmail(
    email: string,
    studentName: string,
    schoolName: string,
    tempPassword: string,
  ): Promise<void> {
    const loginUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    const subject = `Welcome to Scholaro! Access ${studentName}'s Daily Updates at ${schoolName}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template: 'welcome',
        context: { email, studentName, schoolName, tempPassword, loginUrl },
      });
      this.logger.log(`Welcome email sent to ${email}`);
    } catch (err: any) {
      // Log but don't throw — email failure should not block the import
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

    const subject = `Welcome to Scholaro — ${roleName} Account at ${schoolName}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        subject,
        template: 'staff-welcome',
        context: {
          email,
          name,
          roleName,
          schoolName,
          schoolCode,
          tempPassword,
          loginUrl,
        },
      });
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
      await this.mailerService.sendMail({
        to: email,
        subject,
        template: 'reset-password',
        context: { email, token, resetUrl, schoolName },
      });
      this.logger.log(`Reset email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to send reset email to ${email}: ${err.message}`,
      );
    }
  }
}
