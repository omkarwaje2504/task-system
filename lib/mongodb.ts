import { MongoClient } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = { appName: "new-system" };

let client: MongoClient;

if (process.env.NODE_ENV === "development") {
  // Reuse the client across HMR reloads in development.
  const globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient;
  };

  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(uri, options);
  }
  client = globalWithMongo._mongoClient;
} else {
  client = new MongoClient(uri, options);
}

attachDatabasePool(client);

export default client;

export async function connectDB() {
  await client.connect();
  return client.db(process.env.MONGODB_DB || "new-system");
}
