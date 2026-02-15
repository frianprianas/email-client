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

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/alias', aliasRoutes);

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

// Sync database and start server
sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database synced successfully');
    app.listen(PORT, () => {
      console.log(`BaknusMail API running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database sync error:', err);
  });
