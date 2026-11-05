# BookNook – A Small Online Library (Server API)

BookNook is an online library management system built around the core concept: **"Add a book, borrow a book, return a book."**

This repository contains the backend REST API developed with Express.js (ESM) and the native MongoDB driver. It implements BetterAuth JWT verification via `jose` and JWKS, atomic stock tracking, duplicate borrow prevention, and role-based ownership authorization.

- **Client Repository**: [BookNook Client](https://github.com/nayancsbd/booknook-client)
- **Live Client Application**: `https://booknook-client.vercel.app` *(update with your production URL)*
- **Live Server API**: `https://booknook-server.vercel.app` *(update with your production URL)*

---

## Key Website Features

1. **Dynamic Catalog & Search Engine**: Real-time case-insensitive keyword search across book titles and authors, genre category filtering (Fiction, Science, History, Kids, Others), and sorting newest arrivals first.
2. **Stateless JWT Security via JWKS**: Cryptographic token verification utilizing `jose`'s remote JWKS resolver against BetterAuth, eliminating shared secret management and database lookups for session verification.
3. **Atomic Inventory Tracking**: Concurrency-safe `$inc: { copies: -1, quantity: -1 }` on borrow with automatic rollback if a record insertion fails, preventing negative stock or overselling.
4. **Active Loan Duplicate Prevention**: Database-level compound unique index on `{ bookId: 1, userEmail: 1 }` in the `borrows` collection ensuring no patron can have two simultaneous active loans of the exact same title.
5. **Role-Based Ownership Authorization**: Edit (`PATCH /books/:id`) and Delete (`DELETE /books/:id`) operations are cryptographically verified and restricted strictly to the user who added the book.
6. **Serverless & Long-Running Dual Compatibility**: Full support for Vercel Serverless Functions via `api/index.js` and `vercel.json`, alongside standard Node/Render long-running servers with cached MongoDB connection pooling.

---

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express.js 5
- **Database**: MongoDB (Native Driver 7.x)
- **Authentication**: `jose` with remote JWKS verification against BetterAuth
- **Utilities**: `cors`, `dotenv`

---

## Environment Variables

Configure these variables in your `.env` file (see `.env.example`):

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster0.mongodb.net/booknook?retryWrites=true&w=majority` |
| `CLIENT_URL` | Yes | Permitted client origin(s), comma-separated | `http://localhost:3000,https://booknook.vercel.app` |
| `AUTH_JWKS_URL` | Yes | BetterAuth JWKS public key endpoint | `http://localhost:3000/api/auth/jwks` |
| `PORT` | No | Local listening port (defaults to 5000) | `5000` |
| `AUTH_ISSUER` | No | Optional issuer verification claim | `http://localhost:3000` |
| `AUTH_AUDIENCE` | No | Optional audience verification claim | `booknook-api` |

---

## Authentication & Authorization

All private/protected endpoints require an `Authorization` header containing a valid Bearer token issued by BetterAuth:

```http
Authorization: Bearer <better-auth-jwt>
```

- Verified using `createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URL))`.
- Attaches the authenticated user payload (`id`, `email`, `name`) to `req.user`.
- Missing, expired, or invalid tokens return HTTP 401 with a clean `{ message }` payload suitable for client toast notifications.

---

## API Routes Specification

The server exposes strictly the **8 required endpoints** plus a root health check. All error responses provide a consistent `{ message }` string.

### Health Route
- **`GET /`** (Public)
  - Returns service status, operational state, and timestamp.

---

### Book Management (`/books`)

#### 1. `GET /books`
- **Access**: Public
- **Description**: Returns all books matching query filters as an array.
- **Query Parameters**:
  - `limit` *(number)*: Maximum books to return (e.g. `limit=6` for New Arrivals).
  - `sort` *(string)*: `'newest'` sorts by `createdAt` descending.
  - `addedBy` *(string)*: Case-insensitive filter by contributor email.
  - `category` *(string)*: Filter by category (`Fiction`, `Science`, `History`, `Kids`, `Others`).
  - `search` *(string)*: Case-insensitive search against title and author.

#### 2. `GET /books/:id`
- **Access**: Public
- **Description**: Returns a single book by its 24-character hex `ObjectId`.
- **Responses**: `200 OK` (book document), `404 Not Found` (`{ message: "Book not found with the specified identifier." }`).

#### 3. `POST /books`
- **Access**: Protected (Requires Bearer token)
- **Description**: Adds a new book to the library catalog. Contributor identity (`addedBy`, `userEmail`, `userName`) is extracted strictly from the verified JWT.
- **Body**:
  ```json
  {
    "title": "The Midnight Library",
    "author": "Matt Haig",
    "category": "Fiction",
    "image": "https://images.example.com/cover.jpg",
    "description": "Between life and death there is a library...",
    "totalCopies": 5
  }
  ```
- **Responses**: `201 Created` with full book document, `400 Bad Request` with `{ message, errors }`.

#### 4. `PATCH /books/:id`
- **Access**: Protected (Requires Bearer token)
- **Description**: Modifies allowed book fields. Returns `403 Forbidden` unless the authenticated user is the book's creator.
- **Allowed Fields**: `title`, `author`, `category`, `image`, `description`, `totalCopies`, `copies`, `quantity`.
- **Responses**: `200 OK` with updated book document, `403 Forbidden`, `404 Not Found`.

#### 5. `DELETE /books/:id`
- **Access**: Protected (Requires Bearer token)
- **Description**: Removes a book from the library catalog. Returns `403 Forbidden` unless the authenticated user is the book's creator.
- **Responses**: `200 OK` (`{ success: true, message: "Book successfully deleted..." }`), `403 Forbidden`, `404 Not Found`.

---

### Borrowing & Return System (`/borrows`)

#### 6. `POST /borrows`
- **Access**: Protected (Requires Bearer token)
- **Description**: Borrows a copy of a book.
- **Workflow & Rules**:
  - Rejects if `copies <= 0` (HTTP 400 Out of Stock).
  - Rejects with HTTP 409 Conflict if this user already has an active borrow of this book.
  - Decrements copies atomically via `updateOne({ _id, copies: { $gt: 0 } }, { $inc: { copies: -1, quantity: -1 } })`.
  - Inserts borrow record with `borrowDate = now` and `returnDate = now + 7 days`.
  - Automatically restores copy count if insert fails.
- **Body**:
  ```json
  {
    "bookId": "651a2b3c4d5e6f7a8b9c0d1e"
  }
  ```
- **Responses**: `201 Created`, `400 Bad Request`, `409 Conflict`.

#### 7. `GET /borrows`
- **Access**: Protected (Requires Bearer token)
- **Description**: Returns an array of all active loans belonging strictly to the authenticated user (`req.user.email`), sorted newest first.
- **Responses**: `200 OK` (array of borrow records).

#### 8. `DELETE /borrows/:id`
- **Access**: Protected (Requires Bearer token)
- **Description**: Returns a borrowed book to the library. Enforces ownership: only the user who borrowed the book can return it.
- **Workflow**:
  - Deletes the borrow record from the `borrows` collection.
  - Atomically increments book inventory by `+1` (`$inc: { copies: 1, quantity: 1 }`).
- **Responses**: `200 OK` (`{ success: true, message: "\"...\" has been successfully returned..." }`), `403 Forbidden`, `404 Not Found`.

---

## Local Development & Seeding

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Fill in your `MONGODB_URI`, `CLIENT_URL`, and `AUTH_JWKS_URL`.

### 3. Seed Initial Library Catalog
Populate the database with curated literature across all 5 categories:
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```

---

## Deployment

### Vercel (Serverless)
Configured via [`vercel.json`](./vercel.json) and [`api/index.js`](./api/index.js).
1. Import repository into Vercel.
2. Set Environment Variables: `MONGODB_URI`, `CLIENT_URL`, `AUTH_JWKS_URL`.
3. Deploy.

### Render (Container / VM)
1. Build Command: `npm install`
2. Start Command: `npm start`
3. Configure environment variables in the Render dashboard.
