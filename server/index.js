import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo.js";
import authRoutes from "./routes/auth.js";
import intentRoutes from "./routes/intent.js";
import hubRoutes from "./routes/hub.js";
import collectorRoutes from "./routes/collector.js";
import demandRoutes from "./routes/demand.js";
import deliveryRoutes from "./routes/delivery.js";
import bulkRoutes from "./routes/bulk.js";
import adminRoutes from "./routes/admin.js";
import recyclerRoutes from "./routes/recycler.js";
import notificationRoutes from "./routes/notifications.js";
import earningsRoutes from "./routes/earnings.js";
import disputesRoutes from "./routes/disputes.js";
import { ensureSchema, hydrateAll } from "./lib/pgStore.js";
import { persistAll } from "./middleware/persistAll.js";
import { presignResponses } from "./middleware/presignResponses.js";

export async function createServer() {
  // Apply additive column migrations, then load all collections into memory
  await ensureSchema();
  await hydrateAll();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Flush all collections to Postgres after every mutating request
  app.use(persistAll);

  // Replace S3 object URLs in any JSON response with short-lived presigned URLs
  app.use(presignResponses);

  app.get("/api/ping", (_req, res) => {
    res.json({ message: process.env.PING_MESSAGE ?? "ping" });
  });
  app.get("/api/demo", handleDemo);

  app.use("/api/auth", authRoutes);
  app.use("/api/intent", intentRoutes);
  app.use("/api/hub", hubRoutes);
  app.use("/api/collector", collectorRoutes);
  app.use("/api/demand", demandRoutes);
  app.use("/api/delivery", deliveryRoutes);
  app.use("/api/bulk", bulkRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/recycler", recyclerRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/earnings", earningsRoutes);
  app.use("/api/disputes", disputesRoutes);

  return app;
}
