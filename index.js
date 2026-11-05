import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import booksRouter from './routes/books.routes.js';
import borrowsRouter from './routes/borrows.routes.js';
import { connectToDatabase } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const envOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:3000',
  ...envOrigins,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, '');
    let isVercelDomain = false;
    try {
      const hostname = new URL(origin).hostname;
      isVercelDomain = hostname.endsWith('.vercel.app');
    } catch {
      isVercelDomain = false;
    }

    if (
      allowedOrigins.includes(normalizedOrigin) ||
      isVercelDomain ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/books', booksRouter);
app.use('/borrows', borrowsRouter);
app.use('/api/books', booksRouter);
app.use('/api/borrows', borrowsRouter);

app.get('/', async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    await db.command({ ping: 1 });
    res.status(200).json({
      status: 'ok',
      service: 'BookNook API',
      database: 'connected',
      message: 'Welcome to BookNook API. The library catalog and borrowing system are online.',
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(200).json({
      status: 'ok',
      service: 'BookNook API',
      database: 'standby',
      message: 'Welcome to BookNook API. The library catalog and borrowing system are online.',
      timestamp: new Date().toISOString(),
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl}. Route not found.`,
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'An unexpected error occurred while processing your library request.',
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`BookNook server running smoothly on port ${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = 5001;
      console.log(`Port ${PORT} in use, switching to port ${fallbackPort}...`);
      app.listen(fallbackPort, () => {
        console.log(`BookNook server running smoothly on port ${fallbackPort}`);
      });
    } else {
      console.error('Server listen error:', err);
    }
  });
}

export { connectToDatabase };
export default app;
