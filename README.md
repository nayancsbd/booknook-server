# BookNook Server

BookNook is an online library web application designed to help readers explore literature, borrow books, and manage collections. This repository hosts the Express.js REST API powered by the native MongoDB driver and secured with BetterAuth JWT verification (`jose`).

## Tech Stack
- **Runtime**: Node.js (ESM)
- **Framework**: Express.js 5
- **Database**: MongoDB (Native Driver 7.x)
- **Authentication**: JWT verification with `jose` against BetterAuth JWKS URL
- **CORS & Environment**: `cors`, `dotenv`

## API Routes Overview
The Express server is scoped strictly to 8 endpoints plus health monitoring:
- `GET /` - Health check and service status
- `GET /books` - Retrieve all available library books
- `GET /books/:id` - Fetch details for a specific book
- `POST /books` - Add a new book to the catalog (Authenticated)
- `PATCH /books/:id` - Update book details (Authenticated)
- `DELETE /books/:id` - Remove a book from the catalog (Authenticated)
- `POST /borrows` - Borrow a book (Authenticated)
- `GET /borrows` - View user's borrowed books (Authenticated)
- `DELETE /borrows/:id` - Return a borrowed book (Authenticated)

## Getting Started

### 1. Installation
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

### 3. Run Development Server
```bash
npm run dev
```

The server runs by default on `http://localhost:5000`.

