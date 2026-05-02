require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const antifraudRoutes = require('./routes/antifraud');
const ledgerRoutes = require('./routes/ledger');

const PORT = Number(process.env.PORT || 9001);
const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.SESSION_SECRET || 'default-secret'));
app.use(cors({ origin: true, credentials: true }));
app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, try again later.' }
});
app.use(limiter);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/antifraud', antifraudRoutes);
app.use('/api/ledger', ledgerRoutes);

app.use(express.static(path.join(__dirname)));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/api/geo', (req, res) => {
  const remoteIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  return res.json({ ip: remoteIp, country: 'desconhecido', country_name: 'desconhecido', region: '', city: '', org: '' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.listen(PORT, () => {
  console.log(`✅ Backend seguro rodando em http://localhost:${PORT}`);
});
