import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import booksRouter from './routes/books.routes.js';
import { connectToDatabase } from './db.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allowed origins for CORS (CLIENT_URL and localhost:3000)
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, '') : null,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, or same-server requests)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, '');
    if (
      allowedOrigins.includes(origin) ||
      allowedOrigins.includes(normalizedOrigin)
    ) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Mount routes
app.use('/books', booksRouter);

// Health route
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'BookNook API',
    message: 'Welcome to BookNook API. The library catalog and borrowing system are online.',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}. Route not found.`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred while processing your library request.',
  });
});

// Start listener for standalone/local development
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`BookNook server running smoothly on port ${PORT}`);
  });
}

export { connectToDatabase };
export default app;
