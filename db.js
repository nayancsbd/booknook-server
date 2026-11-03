import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Cached MongoDB Connection Helper (compatible with serverless & long-running containers)
let cached = globalThis.__mongo;
if (!cached) {
  cached = globalThis.__mongo = { client: null, db: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.client && cached.db) {
    return { client: cached.client, db: cached.db };
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  if (!cached.promise) {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });

    cached.promise = client.connect().then((connectedClient) => {
      cached.client = connectedClient;
      cached.db = connectedClient.db();
      return { client: cached.client, db: cached.db };
    });
  }

  await cached.promise;
  return { client: cached.client, db: cached.db };
}

