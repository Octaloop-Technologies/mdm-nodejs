require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mqttService = require("./services/mqttService");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api", apiRoutes);

// MQTT Event Handlers
mqttService.on("connected", () => {
  console.log("🚀 MQTT service connected and ready");
});

mqttService.on("disconnected", () => {
  console.log("⚠️ MQTT service disconnected");
});

mqttService.on("error", (error) => {
  console.error("❌ MQTT service error:", error);
});

mqttService.on("deviceMessage", (data) => {
  console.log("📱 Device message received:", data);
  // Handle device messages here
  // You can save to database, trigger notifications, etc.
});

mqttService.on("commandMessage", (data) => {
  console.log("🎮 Command message received:", data);
  // Handle command messages here
  // You can execute device commands, update status, etc.
});

mqttService.on("message", (data) => {
  if (data.topic == "octaloop-mdm-in") {
    console.log("📨 Generic message received:", data);
  }
  // Handle all other messages here
});
mqttService.on("octaloop-mdm-in", (data) => {
  console.log("📨 Octaloop MDM IN:", data);
  // Handle all other messages here
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Express error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT. Graceful shutdown...");
  mqttService.disconnect();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM. Graceful shutdown...");
  mqttService.disconnect();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    // Initialize MQTT connection
    await mqttService.connect();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
