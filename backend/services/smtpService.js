const nodemailer = require('nodemailer');

class SmtpService {
    constructor(email, password) {
        // Fallback to the school Mailcow host if MAIL_HOST is unset or still pointing to obsolete titan placeholder
        let host = process.env.MAIL_HOST;
        if (!host || host === 'imap.titan.email' || host === 'smtp.titan.email') {
            host = 'mail.smk.baktinusantara666.sch.id';
        }

        const port = parseInt(process.env.SMTP_PORT) || 587;
        const secure = process.env.MAIL_SECURE === 'true' || port === 465;

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure,
            auth: {
                user: email,
                pass: password
            },
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 15000,
            greetingTimeout: 10000,
            socketTimeout: 30000
        });
        this.email = email;
    }

    async sendMail({ to, cc, bcc, subject, text, html, attachments, inReplyTo, references }) {
        const mailOptions = {
            from: this.email,
            sender: this.email,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            text,
            html,
            envelope: {
                from: this.email,
                to: Array.isArray(to) ? to.join(', ') : to,
            },
        };

        if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
        if (bcc) mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
        if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
        if (references) mailOptions.references = references;

        if (attachments && attachments.length > 0) {
            mailOptions.attachments = attachments.map(att => ({
                filename: att.filename,
                content: att.content,
                encoding: 'base64',
                contentType: att.contentType
            }));
        }

        const info = await this.transporter.sendMail(mailOptions);
        return info;
    }

    async verify() {
        return this.transporter.verify();
    }
}

module.exports = SmtpService;
