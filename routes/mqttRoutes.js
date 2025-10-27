const express = require("express");
const MQTTController = require("../controllers/mqttController");

const router = express.Router();

// MQTT status
router.get("/status", MQTTController.getStatus);

// Publish message
router.post("/publish", MQTTController.publishMessage);

// Subscribe to topic
router.post("/subscribe", MQTTController.subscribeToTopic);

// Unsubscribe from topic
router.delete("/subscribe", MQTTController.unsubscribeFromTopic);

// Get current subscriptions
router.get("/subscriptions", MQTTController.getSubscriptions);

// Create queue
router.post("/queue/create", MQTTController.createQueue);

// Broadcast to all devices
router.post("/broadcast", MQTTController.broadcastAlldevices);

module.exports = router;
