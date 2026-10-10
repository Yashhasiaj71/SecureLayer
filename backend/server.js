'use strict';

// Load environment variables first — before any other imports
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./src/config/environment');
const connectDB = require('./src/config/database');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { errorHandler, notFound } = require('./src/middleware/errorHandler');

// Routes
const authRoutes = require('./src/routes/authRoutes');
const fileRoutes = require('./src/routes/fileRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const shareRoutes = require('./src/routes/shareRoutes');
const camRoutes = require('./src/routes/camRoutes');

const app = express();

// ─── Security Headers (Helmet) ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Needed for file streaming
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// ─── CORS Configuration ───────────────────────────────────────────────────────
// SECURITY: Explicit origin — NEVER use wildcard (*) for authenticated app
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from configured frontend URL, or no origin (server-to-server)
      const allowedOrigins = [config.cors.frontendUrl, 'http://localhost:3000', 'http://localhost:5173'];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true, // Required for HttpOnly cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
  })
);

// ─── Request Parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser()); // Parse cookies for refresh token

// ─── Logging ─────────────────────────────────────────────────────────────────
// In production, use 'combined' for standard access log format
// SECURITY: Do not log request bodies (may contain sensitive data)
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cam', camRoutes);

// Health check (no auth — for load balancers)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();

  app.listen(config.port, () => {
    console.log(`[Server] Running on port ${config.port} (${config.nodeEnv})`);
    if (!config.isProduction) {
      console.log(`[Server] API: http://localhost:${config.port}/api`);
    }
  });
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
  process.exit(1);
});

start().catch((err) => {
  console.error('[Startup] Failed:', err.message);
  process.exit(1);
});
