require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { sequelize } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const mailRoutes = require('./routes/mail');
const contactRoutes = require('./routes/contacts');
const folderRoutes = require('./routes/folders');
const aliasRoutes = require('./routes/alias');
const templateRoutes = require('./routes/templates');
const snoozeRoutes = require('./routes/snooze');

const SnoozedEmail = require('./models/SnoozedEmail');
const User = require('./models/User');
const ImapService = require('./services/imapService');

const scheduleRoutes = require('./routes/schedule');

const ScheduledEmail = require('./models/ScheduledEmail');
const SmtpService = require('./services/smtpService');

// Define Model Associations
User.hasMany(SnoozedEmail, { foreignKey: 'userId' });
SnoozedEmail.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(ScheduledEmail, { foreignKey: 'userId' });
ScheduledEmail.belongsTo(User, { foreignKey: 'userId' });

const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow all origins (for dev/docker flexibility)
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/alias', aliasRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/snooze', snoozeRoutes);
app.use('/api/schedule', scheduleRoutes);

// ... (health check, error handler, snooze worker)

// Background worker for scheduled emails
const processScheduledEmails = async () => {
  try {
    const { Op } = require('sequelize');
    const now = new Date();

    const scheduled = await ScheduledEmail.findAll({
      where: {
        scheduledTime: { [Op.lte]: now },
        status: 'pending'
      },
      include: [{ model: User, as: 'User' }]
    });

    for (const email of scheduled) {
      try {
        // Fetch user if not included (ScheduledEmail association needed)
        const user = await User.findByPk(email.userId);
        if (!user) continue;

        const password = Buffer.from(user.imapPassword, 'base64').toString('utf-8');
        const smtpService = new SmtpService(user.email, password);

        await smtpService.sendMail({
          to: email.to,
          cc: email.cc,
          bcc: email.bcc,
          subject: email.subject,
          html: email.html,
          text: email.text,
          attachments: email.attachments,
          inReplyTo: email.inReplyTo,
          references: email.references
        });

        // Also save to Sent folder via IMAP
        try {
          const imapService = new ImapService(user.email, password);
          // Construct raw message or append similar content
          // IMAP append requires raw message. Nodemailer can generate it but we just sent it.
          // For simplicity, we might skip append or try to append a basic structure.
          // Ideally SMTP service returns raw or we build it.
          // Let's postpone append to Sent for scheduled emails or implement if critical.
          // Users expect to see it in Sent.

          // Simple append
          const raw = `From: ${user.email}\r\nTo: ${Array.isArray(email.to) ? email.to.join(', ') : email.to}\r\nSubject: ${email.subject}\r\n\r\n${email.text || ' (HTML Content) '}`;
          await imapService.appendToSent(raw);

        } catch (imapErr) {
          console.error('Failed to save scheduled email to Sent:', imapErr);
        }

        email.status = 'sent';
        await email.save();
        console.log(`Sent scheduled email ${email.id}`);

      } catch (err) {
        console.error(`Failed to send scheduled email ${email.id}:`, err);
        email.status = 'failed';
        email.errorMessage = err.message;
        await email.save();
      }
    }
  } catch (error) {
    console.error('Schedule worker error:', error);
  }
};




// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BaknusMail API is running' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

// Background worker for snoozed emails
const processSnoozedEmails = async () => {
  try {
    const { Op } = require('sequelize');
    const now = new Date();

    const snoozed = await SnoozedEmail.findAll({
      where: {
        snoozeUntil: { [Op.lte]: now },
        processed: false
      },
      include: [{ model: User, as: 'User' }] // Ensure association exists or fetch user manually
    });

    for (const item of snoozed) {
      try {
        // Fetch user if not included
        const user = await User.findByPk(item.userId);
        if (!user) continue;

        const password = Buffer.from(user.imapPassword, 'base64').toString('utf-8');
        const imapService = new ImapService(user.email, password);

        // Move back to INBOX
        // We attempt to move from 'Snoozed' or 'Archive'. 
        // Since we don't know for sure where it ended up, we might need to search or just try 'Snoozed'.
        let newInboxUid = null;
        try {
          newInboxUid = await imapService.moveMessage(item.messageUid, 'Snoozed', 'INBOX');
        } catch (e1) {
          try {
            newInboxUid = await imapService.moveMessage(item.messageUid, 'Archive', 'INBOX');
          } catch (e2) {
            console.error(`Failed to move snoozed message ${item.messageUid}:`, e2.message);
          }
        }

        if (newInboxUid) {
          // Mark unread (remove \Seen)
          await imapService.toggleFlag('INBOX', newInboxUid, '\\Seen', false);
        }

        item.processed = true;
        await item.save();
        console.log(`Unsnoozed message ${item.messageUid} for user ${user.email}`);

      } catch (err) {
        console.error(`Error processing snoozed item ${item.id}:`, err);
      }
    }
  } catch (error) {
    console.error('Snooze worker error:', error);
  }
};

// Sync database and start server
sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database synced successfully');

    // Start snooze worker (every 60 seconds)
    setInterval(processSnoozedEmails, 60000);
    setInterval(processScheduledEmails, 60000); // Check scheduled emails every minute

    app.listen(PORT, () => {
      console.log(`BaknusMail API running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database sync error:', err);
  });
