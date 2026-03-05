/** Type declaration for optional nodemailer. Install with: pnpm add nodemailer */
declare module 'nodemailer' {
  interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  }
  interface SendMailOptions {
    from?: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }
  interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>;
  }
  function createTransport(opts: TransportOptions): Transporter;
}
