const nodemailer = require('nodemailer');

class SmtpService {
    constructor(email, password) {
        this.transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: process.env.MAIL_SECURE === 'true',
            auth: {
                user: email,
                pass: password
            },
            tls: {
                rejectUnauthorized: false
            }
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
