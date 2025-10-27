const express = require("express");
const DeviceController = require("../controllers/deviceController");

const router = express.Router();

// Device lifecycle management
router.post("/add", DeviceController.addDevice); // Add new device
router.put("/:deviceId", DeviceController.updateDevice); // Update device info
router.post("/:deviceId/retire", DeviceController.retireDevice); // Retire device
router.delete("/:deviceId", DeviceController.deleteDevice); // Delete device
router.get("/:deviceId", DeviceController.getDevice); // Get device info
router.get("/", DeviceController.listDevices); // List all devices

// Bulk operations
router.post("/bulk/add", DeviceController.bulkAddDevices); // Bulk add devices

// Device communication
router.post("/:deviceId/command", DeviceController.sendCommandToDevice); // Send command to device

module.exports = router;
