import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import authRoutes from "./routes/auth";
import intentRoutes from "./routes/intent";
import hubRoutes from "./routes/hub";
import collectorRoutes from "./routes/collector";
import demandRoutes from "./routes/demand";
import deliveryRoutes from "./routes/delivery";
import bulkRoutes from "./routes/bulk";
import adminRoutes from "./routes/admin";
import { seedDatabase } from "./seed";

export async function createServer() {
  // Seed database on startup
  await seedDatabase();
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth routes
  app.use("/api/auth", authRoutes);

  // Small User routes
  app.use("/api/intent", intentRoutes);

  // Hub routes
  app.use("/api/hub", hubRoutes);

  // Collector routes
  app.use("/api/collector", collectorRoutes);

  // Demand & Recycler routes
  app.use("/api/demand", demandRoutes);

  // Delivery routes
  app.use("/api/delivery", deliveryRoutes);

  // Bulk generator routes
  app.use("/api/bulk", bulkRoutes);

  // Admin routes
  app.use("/api/admin", adminRoutes);

  return app;
}
