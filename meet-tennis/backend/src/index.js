import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import courtsRouter from './routes/courts.js';
import profileRouter from './routes/profile.js';
import rankingRouter from './routes/ranking.js';
import availabilityRouter from './routes/availability.js';
import matchesRouter from './routes/matches.js';
import matchmakingRouter from './routes/matchmaking.js';
import notificationsRouter from './routes/notifications.js';
import reviewsRouter from './routes/reviews.js';
import chatRouter from './routes/chat.js';
import productsRouter from './routes/products.js';
import monitoringRouter from './routes/monitoring.js';
import { registrar } from './lib/requestMetrics.js';
import { crearRateLimit } from './middleware/rateLimit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Detrás de un proxy (Render, Vercel) la IP real del cliente llega en
// X-Forwarded-For; sin esto el rate limit vería siempre la IP del proxy.
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// CORS: en producción solo se permiten los orígenes explícitos de
// CORS_ORIGIN (separados por coma). Sin lista configurada se deniegan
// las peticiones cross-origin; las del mismo origen no necesitan CORS.
const origenesPermitidos = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  : null;

app.use(
  cors({
    origin(origin, callback) {
      // Peticiones sin header Origin (mismo origen, curl, health checks).
      if (!origin) return callback(null, true);
      if (!origenesPermitidos) {
        return callback(null, process.env.NODE_ENV !== 'production');
      }
      return callback(null, origenesPermitidos.includes(origin));
    },
  }),
);

// Headers de seguridad básicos (sin dependencias externas).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(self), camera=(), microphone=(), payment=()',
  );
  next();
});

app.use(express.json());

// Rate limit general de la API (por IP): frena abuso y spam en rutas
// autenticadas. Login y registro conservan sus límites propios, más
// estrictos.
const limitarApi = crearRateLimit({
  ventanaMs: 60 * 1000,
  max: 120,
  mensaje: 'Demasiadas peticiones. Intenta de nuevo en un minuto.',
});
app.use('/api', limitarApi);

// Logging de peticiones: método, ruta, status y duración.
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`,
    );
    registrar(req, res, duration);
  });

  next();
});

app.use('/api/auth', authRouter);
app.use('/api/courts', courtsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/ranking', rankingRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/matchmaking', matchmakingRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/products', productsRouter);
app.use('/api/monitoring', monitoringRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok' },
    error: null,
  });
});

// 404 para rutas no registradas.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: 'Ruta no encontrada.',
  });
});

// Manejador global de errores de Express (debe conservar los 4 parámetros).
app.use((err, req, res, _next) => {
  console.error('[ExpressError]', err);
  res.status(500).json({
    success: false,
    data: null,
    error: 'Error interno del servidor.',
  });
});

// Blindaje del proceso: evita caídas silenciosas por promesas o excepciones no manejadas.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

app.listen(PORT, () => {
  console.log(`MeetTennis backend running on port ${PORT}`);
});
