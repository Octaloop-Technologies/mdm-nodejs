const express = require("express");
const mqttRoutes = require("./mqttRoutes");
const deviceRoutes = require("./deviceRoutes");

const router = express.Router();

// API Info
router.get("/", (req, res) => {
  res.json({
    name: "MDM ActiveMQ MQTT API",
    version: "2.0.0",
    description:
      "API for managing devices through ActiveMQ Artemis MQTT broker",
    endpoints: {
      health: "GET /health",
      mqtt: {
        status: "GET /api/mqtt/status",
        publish: "POST /api/mqtt/publish",
        subscribe: "POST /api/mqtt/subscribe",
        unsubscribe: "DELETE /api/mqtt/subscribe",
        subscriptions: "GET /api/mqtt/subscriptions",
        createQueue: "POST /api/mqtt/queue/create",
        broadcast: "POST /api/mqtt/broadcast",
      },
      devices: {
        list: "GET /api/devices",
        add: "POST /api/devices/add",
        get: "GET /api/devices/:deviceId",
        update: "PUT /api/devices/:deviceId",
        retire: "POST /api/devices/:deviceId/retire",
        delete: "DELETE /api/devices/:deviceId",
        bulkAdd: "POST /api/devices/bulk/add",
        sendCommand: "POST /api/devices/:deviceId/command",
      },
    },
    deviceQueueStructure: {
      inQueue: "octaloop-mdm-in-{deviceId}",
      outQueue: "octaloop-mdm-out-{deviceId}",
      description: "IN queues: Device→Server, OUT queues: Server→Device",
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use("/mqtt", mqttRoutes);
router.use("/devices", deviceRoutes);

module.exports = router;
