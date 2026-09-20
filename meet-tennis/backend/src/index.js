import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Logging de peticiones: método, ruta, status y duración.
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
});

app.use('/api/auth', authRouter);

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
app.use((err, req, res, next) => {
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
