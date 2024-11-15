import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import validationRoutes from './routes/validation.js';
import { proxyManager } from './lib/proxyManager.js';
import debug from 'debug';

const log = debug('email:server');
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;

// Initialize proxy manager
try {
  const proxyPath = path.join(__dirname, 'proxies.txt');
  await proxyManager.loadProxies(proxyPath);
  log('Proxies loaded successfully');
} catch (error) {
  log('Warning: Could not load proxies:', error.message);
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// API routes
app.use('/api', validationRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling
app.use((err, req, res, next) => {
  log('Server error:', err);
  
  if (req.file) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      log('Failed to clean up file:', e);
    }
  }

  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  log(`Server running on port ${port}`);
}).on('error', (error) => {
  log('Failed to start server:', error);
  process.exit(1);
});

// Configure timeouts
server.timeout = 300000;
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// Graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});