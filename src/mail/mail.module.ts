import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join, dirname } from 'path';
import { MailService } from './mail.service';

// Node 22 enforces package exports — resolve adapter via filesystem path
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HandlebarsAdapter } = require(
  join(dirname(require.resolve('@nestjs-modules/mailer')), 'adapters', 'handlebars.adapter'),
);

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('MAIL_HOST') || config.get<string>('SMTP_HOST');
        const user = config.get<string>('MAIL_USER') || config.get<string>('SMTP_USER');
        const pass = config.get<string>('MAIL_PASSWORD') || config.get<string>('SMTP_PASS');
        const from = config.get<string>('MAIL_FROM') || config.get<string>('SMTP_FROM') || 'noreply@scholaro.app';
        const port = Number(config.get('SMTP_PORT')) || 587;

        const transport =
          host && user && pass
            ? { host, port, secure: port === 465, auth: { user, pass } }
            : { jsonTransport: true };

        return {
          transport,
          defaults: { from: `"Scholaro" <${from}>` },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
