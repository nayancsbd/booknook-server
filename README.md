# BookNook Server

BookNook Server is the Express.js REST API powering the BookNook online library management system. Built with modern ECMAScript Modules (ESM) and the native MongoDB Node.js driver, it features stateless JSON Web Token (JWT) cryptographic verification against BetterAuth's JWKS endpoint, atomic stock synchronization, and robust concurrency protections.

---

## Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express.js 5
- **Database**: MongoDB (Native Driver 7.x) with cached connection pooling
- **Security & Auth**: `jose` with remote JWKS verification, `cors`, `dotenv`
- **Validation**: Custom validation utilities with unified `{ message }` error schemas

---

## Environment Variables

Configure the following variables in `.env` (refer to `.env.example`):

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | Yes | MongoDB Atlas or local connection string | `mongodb+srv://user:pass@cluster0.mongodb.net/booknook?retryWrites=true&w=majority` |
| `CLIENT_URL` | Yes | Client origin URL permitted by CORS | `http://localhost:3000` |
| `AUTH_JWKS_URL` | Yes | BetterAuth JSON Web Key Set (JWKS) URL | `http://localhost:3000/api/auth/jwks` |
| `PORT` | No | Server listening port (defaults to 5000) | `5000` |
| `AUTH_ISSUER` | No | Optional issuer (`iss`) claim verification | `http://localhost:3000` |
| `AUTH_AUDIENCE` | No | Optional audience (`aud`) claim verification | `booknook-api` |

---

## Authentication Flow

Protected endpoints require an `Authorization` header containing a valid Bearer token issued by BetterAuth's JWT plugin:

```http
Authorization: Bearer <better-auth-jwt>
```

- Tokens are verified cryptographically via `jose`'s `createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URL))`.
- Decoded user identity (`id`, `email`, `name`) is attached to `req.user`.
- Missing, expired, or invalid tokens return HTTP 401 with a consistent `{ message }` payload suitable for toast alerts.

---

## API Routes Specification

The server exposes strictly 8 core endpoints plus a root health check. All error responses consistently provide a `{ message }` string.

### Health Route
- **`GET /`**
  - **Auth**: Public
  - **Description**: Returns server status, library catalog availability, and timestamp.

---

### Book Catalog Routes (`/books`)

#### 1. `GET /books`
- **Auth**: Public
- **Description**: Retrieves books matching optional query parameters. Returns an array of book documents.
- **Query Parameters**:
  - `limit` *(number)*: Maximum books to return.
  - `sort` *(string)*: Pass `'newest'` to sort by `createdAt` descending.
  - `addedBy` *(string)*: Filter by contributor email.
  - `category` *(string)*: Filter by genre (`Fiction`, `Science`, `History`, `Kids`, `Others`).
  - `search` *(string)*: Case-insensitive search on `title` or `author`.

#### 2. `GET /books/:id`
- **Auth**: Protected (Requires Bearer token)
- **Description**: Fetches a single book by its 24-character hex `ObjectId`.
- **Responses**:
  - `200 OK`: Book object.
  - `404 Not Found`: `{ message: "Book not found with the specified identifier." }`

#### 3. `POST /books`
- **Auth**: Protected (Requires Bearer token)
- **Description**: Adds a new book to the catalog. Owner identity is extracted directly from the verified token (`req.user`).
- **Body (`application/json`)**:
  ```json
  {
    "title": "To Kill a Mockingbird",
    "author": "Harper Lee",
    "category": "Fiction",
    "image": "https://images.example.com/mockingbird.jpg",
    "description": "A timeless exploration of courage and justice in the American South.",
    "totalCopies": 5
  }
  ```
- **Stored Fields**: `copies` (set to `totalCopies`), `createdAt` (`new Date()`), `addedBy`, `addedByEmail`, `userEmail`, `addedByName`, `userName`.
- **Responses**:
  - `201 Created`: The created book document including `_id`.
  - `400 Bad Request`: `{ message: "Validation error explanation" }`

#### 4. `PATCH /books/:id`
- **Auth**: Protected (Requires Bearer token)
- **Description**: Updates permitted fields of an existing book. Only the member who added the book can update it.
- **Allowed Fields**: `title`, `author`, `category`, `image`, `description`, `totalCopies`, `copies`.
- **Responses**:
  - `200 OK`: Updated book document.
  - `400 Bad Request`: Validation failure or no valid fields provided.
  - `403 Forbidden`: `{ message: "Access denied. You can only modify books that you added to the library." }`
  - `404 Not Found`: Book does not exist.

#### 5. `DELETE /books/:id`
- **Auth**: Protected (Requires Bearer token)
- **Description**: Removes a book from the catalog. Only the member who added the book can delete it.
- **Responses**:
  - `200 OK`: `{ success: true, message: "Book successfully deleted from the library catalog." }`
  - `403 Forbidden`: `{ message: "Access denied. You can only remove books that you added to the library." }`
  - `404 Not Found`: Book does not exist.

---

### Borrowing & Loans Routes (`/borrows`)

#### 6. `POST /borrows`
- **Auth**: Protected (Requires Bearer token)
- **Description**: Borrows a copy of a book.
- **Rules**:
  - Rejects if `copies <= 0` (400 Bad Request).
  - Rejects if the user already has an active loan of this book (409 Conflict).
  - Enforces database unique compound index on `{ bookId: 1, userEmail: 1 }`.
  - Atomically decrements copies via `updateOne({ _id, copies: { $gt: 0 } }, { $inc: { copies: -1 } })`.
  - Stores `borrowDate` (now) and `returnDate` (now + 7 days).
  - Automatically restores the book copy if record insertion fails.
- **Body (`application/json`)**:
  ```json
  {
    "bookId": "651a2b3c4d5e6f7a8b9c0d1e"
  }
  ```
- **Responses**:
  - `201 Created`: `{ success: true, message: "Successfully borrowed...", borrow: { ... } }`
  - `400 Bad Request`: Invalid ID or book out of stock.
  - `409 Conflict`: `{ message: "You already have an active loan for \"...\"." }`

#### 7. `GET /borrows`
- **Auth**: Protected (Requires Bearer token)
- **Description**: Returns all active borrowed books for the authenticated user, sorted by loan date descending.
- **Responses**:
  - `200 OK`: Array of borrow records.

#### 8. `DELETE /borrows/:id`
- **Auth**: Protected (Requires Bearer token)
- **Description**: Returns a borrowed book. Only the user who borrowed the book can return it.
- **Rules**:
  - Deletes the borrow document.
  - Atomically increments the book's available `copies` by `+1`.
- **Responses**:
  - `200 OK`: `{ success: true, message: "\"Book Title\" has been successfully returned to the library. Thank you!" }`
  - `403 Forbidden`: `{ message: "Access denied. You can only return books that were borrowed under your account." }`
  - `404 Not Found`: Borrow record not found.

---

## Deployment

### Vercel (Serverless)
A [`vercel.json`](./vercel.json) configuration routes all incoming requests to the exported Express app in `index.js`.
1. Connect repository to Vercel.
2. Set Environment Variables (`MONGODB_URI`, `CLIENT_URL`, `AUTH_JWKS_URL`).
3. Deploy.

### Render / Virtual Machines (Long-running)
1. Set Build Command: `npm install`
2. Set Start Command: `npm start`
3. Configure Environment Variables in the Render dashboard.
