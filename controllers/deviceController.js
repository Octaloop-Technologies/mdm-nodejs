const mqttService = require("../services/mqttService");

class DeviceController {
  /**
   * Add a new device and create its queues
   */
  static async addDevice(req, res) {
    try {
      const { deviceId, deviceInfo = {} } = req.body;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: "Device ID is required",
        });
      }

      // Validate deviceId format (alphanumeric, hyphens, underscores)
      if (!/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
        return res.status(400).json({
          success: false,
          error:
            "Device ID can only contain letters, numbers, hyphens, and underscores",
        });
      }

      console.log(`📱 Adding new device: ${deviceId}`);

      // Create device queue names
      const inQueue = `octaloop-mdm-in-${deviceId}`;
      const outQueue = `octaloop-mdm-out-${deviceId}`;

      // Create both queues for the device
      const queueCreationResults = [];

      try {
        // Create IN queue (for device to server communication)
        console.log(`🔨 Creating IN queue: ${inQueue}`);
        const inQueueResult = await mqttService.createQueue(inQueue, {
          qos: 1,
          durable: true,
        });
        queueCreationResults.push({
          queue: inQueue,
          type: "in",
          status: "created",
          result: inQueueResult,
        });

        // Create OUT queue (for server to device communication)
        console.log(`🔨 Creating OUT queue: ${outQueue}`);
        const outQueueResult = await mqttService.createQueue(outQueue, {
          qos: 1,
          durable: true,
        });
        queueCreationResults.push({
          queue: outQueue,
          type: "out",
          status: "created",
          result: outQueueResult,
        });

        // Store device information (in a real app, this would go to a database)
        const deviceRecord = {
          deviceId,
          inQueue,
          outQueue,
          deviceInfo,
          status: "active",
          createdAt: new Date().toISOString(),
          lastSeen: null,
          queuesCreated: true,
        };

        console.log(
          `✅ Device ${deviceId} added successfully with queues created`
        );

        res.json({
          success: true,
          message: `Device '${deviceId}' added successfully`,
          data: {
            device: deviceRecord,
            queuesCreated: queueCreationResults,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (queueError) {
        console.error(
          `❌ Failed to create queues for device ${deviceId}:`,
          queueError
        );

        res.status(500).json({
          success: false,
          error: "Failed to create device queues",
          details: queueError.message,
          partialResults: queueCreationResults,
        });
      }
    } catch (error) {
      console.error("Error adding device:", error);
      res.status(500).json({
        success: false,
        error: "Failed to add device",
        details: error.message,
      });
    }
  }

  /**
   * Update device information
   */
  static async updateDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const { deviceInfo } = req.body;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: "Device ID is required",
        });
      }

      console.log(`📝 Updating device: ${deviceId}`);

      // In a real application, you would update the device in the database
      const updatedDevice = {
        deviceId,
        deviceInfo,
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        message: `Device '${deviceId}' updated successfully`,
        data: {
          device: updatedDevice,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error updating device:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update device",
        details: error.message,
      });
    }
  }

  /**
   * Retire a device (mark as inactive but keep queues)
   */
  static async retireDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const { reason = "Manual retirement" } = req.body;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: "Device ID is required",
        });
      }

      console.log(`📴 Retiring device: ${deviceId}, reason: ${reason}`);

      // Send final notification to device before retirement
      const outQueue = `octaloop-mdm-out-${deviceId}`;
      const retirementNotification = {
        type: "device_retirement",
        deviceId,
        message: "This device has been retired from MDM management",
        reason,
        timestamp: new Date().toISOString(),
        finalMessage: true,
      };

      try {
        await mqttService.publish(outQueue, retirementNotification, {
          qos: 1,
          retain: false,
        });
        console.log(`📤 Retirement notification sent to device ${deviceId}`);
      } catch (publishError) {
        console.warn(
          `⚠️ Could not send retirement notification: ${publishError.message}`
        );
      }

      // Update device status (in real app, update database)
      const retiredDevice = {
        deviceId,
        status: "retired",
        reason,
        retiredAt: new Date().toISOString(),
        queuesPreserved: true,
      };

      res.json({
        success: true,
        message: `Device '${deviceId}' retired successfully`,
        data: {
          device: retiredDevice,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error retiring device:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retire device",
        details: error.message,
      });
    }
  }

  /**
   * Delete a device and optionally remove its queues
   */
  static async deleteDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const { removeQueues = false, reason = "Manual deletion" } = req.body;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: "Device ID is required",
        });
      }

      console.log(
        `🗑️ Deleting device: ${deviceId}, removeQueues: ${removeQueues}`
      );

      const inQueue = `octaloop-mdm-in-${deviceId}`;
      const outQueue = `octaloop-mdm-out-${deviceId}`;

      // Send final notification before deletion
      if (!removeQueues) {
        const deletionNotification = {
          type: "device_deletion",
          deviceId,
          message: "This device has been deleted from MDM management",
          reason,
          timestamp: new Date().toISOString(),
          finalMessage: true,
        };

        try {
          await mqttService.publish(outQueue, deletionNotification, {
            qos: 1,
            retain: false,
          });
          console.log(`📤 Deletion notification sent to device ${deviceId}`);
        } catch (publishError) {
          console.warn(
            `⚠️ Could not send deletion notification: ${publishError.message}`
          );
        }
      }

      let queueRemovalResults = [];

      if (removeQueues) {
        // Attempt to unsubscribe from queues (this won't delete them from broker, but removes local subscriptions)
        try {
          mqttService.unsubscribe(inQueue);
          mqttService.unsubscribe(outQueue);

          queueRemovalResults = [
            { queue: inQueue, action: "unsubscribed", status: "success" },
            { queue: outQueue, action: "unsubscribed", status: "success" },
          ];

          console.log(`📡 Unsubscribed from queues for device ${deviceId}`);
        } catch (unsubError) {
          console.warn(
            `⚠️ Could not unsubscribe from queues: ${unsubError.message}`
          );
          queueRemovalResults = [
            {
              queue: inQueue,
              action: "unsubscribed",
              status: "failed",
              error: unsubError.message,
            },
            {
              queue: outQueue,
              action: "unsubscribed",
              status: "failed",
              error: unsubError.message,
            },
          ];
        }
      }

      // Delete device record (in real app, delete from database)
      const deletedDevice = {
        deviceId,
        status: "deleted",
        reason,
        deletedAt: new Date().toISOString(),
        queuesRemoved: removeQueues,
        queueOperations: queueRemovalResults,
      };

      res.json({
        success: true,
        message: `Device '${deviceId}' deleted successfully`,
        data: {
          device: deletedDevice,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error deleting device:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete device",
        details: error.message,
      });
    }
  }

  /**
   * Get device information and queue status
   */
  static async getDevice(req, res) {
    try {
      const { deviceId } = req.params;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          error: "Device ID is required",
        });
      }

      const inQueue = `octaloop-mdm-in-${deviceId}`;
      const outQueue = `octaloop-mdm-out-${deviceId}`;

      // Check if queues exist in subscriptions
      const connectionStatus = mqttService.getConnectionStatus();
      const hasInQueue = connectionStatus.subscriptions.includes(inQueue);
      const hasOutQueue = connectionStatus.subscriptions.includes(outQueue);

      // In a real app, you would fetch this from database
      const deviceInfo = {
        deviceId,
        inQueue,
        outQueue,
        queues: {
          inQueue: {
            name: inQueue,
            subscribed: hasInQueue,
            purpose: "Device to Server communication",
          },
          outQueue: {
            name: outQueue,
            subscribed: hasOutQueue,
            purpose: "Server to Device communication",
          },
        },
        status: hasInQueue && hasOutQueue ? "active" : "partial",
        lastChecked: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: {
          device: deviceInfo,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error getting device:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get device information",
        details: error.message,
      });
    }
  }

  /**
   * List all devices (based on current subscriptions)
   */
  static async listDevices(req, res) {
    try {
      const connectionStatus = mqttService.getConnectionStatus();
      const subscriptions = connectionStatus.subscriptions;

      // Extract device IDs from queue names
      const deviceQueues = new Map();

      subscriptions.forEach((subscription) => {
        if (
          subscription.startsWith("octaloop-mdm-in-") ||
          subscription.startsWith("octaloop-mdm-out-")
        ) {
          const parts = subscription.split("-");
          if (parts.length >= 4) {
            const deviceId = parts.slice(3).join("-"); // Handle device IDs with hyphens
            const queueType = parts[2]; // 'in' or 'out'

            if (!deviceQueues.has(deviceId)) {
              deviceQueues.set(deviceId, {
                deviceId,
                inQueue: null,
                outQueue: null,
              });
            }

            const device = deviceQueues.get(deviceId);
            if (queueType === "in") {
              device.inQueue = subscription;
            } else if (queueType === "out") {
              device.outQueue = subscription;
            }
          }
        }
      });

      // Convert to array and add status
      const devices = Array.from(deviceQueues.values()).map((device) => ({
        ...device,
        status: device.inQueue && device.outQueue ? "active" : "partial",
        hasInQueue: !!device.inQueue,
        hasOutQueue: !!device.outQueue,
      }));

      res.json({
        success: true,
        data: {
          devices,
          totalDevices: devices.length,
          activeDevices: devices.filter((d) => d.status === "active").length,
          partialDevices: devices.filter((d) => d.status === "partial").length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error listing devices:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list devices",
        details: error.message,
      });
    }
  }

  /**
   * Send command to device (publish to OUT queue)
   */
  static async sendCommandToDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const { command, payload = {}, priority = "normal" } = req.body;

      if (!deviceId || !command) {
        return res.status(400).json({
          success: false,
          error: "Device ID and command are required",
        });
      }

      const outQueue = `octaloop-mdm-out-${deviceId}`;

      const commandMessage = {
        type: "command",
        command,
        deviceId,
        payload,
        priority,
        commandId: `cmd-${Date.now()}`,
        timestamp: new Date().toISOString(),
        requiresAck: true,
      };

      console.log(`📤 Sending command '${command}' to device ${deviceId}`);

      const qosLevel = priority === "high" ? 2 : priority === "normal" ? 1 : 0;

      await mqttService.publish(outQueue, commandMessage, {
        qos: qosLevel,
        retain: false,
      });

      res.json({
        success: true,
        message: `Command '${command}' sent to device '${deviceId}'`,
        data: {
          deviceId,
          command,
          commandId: commandMessage.commandId,
          queueUsed: outQueue,
          qos: qosLevel,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error sending command to device:", error);
      res.status(500).json({
        success: false,
        error: "Failed to send command to device",
        details: error.message,
      });
    }
  }

  /**
   * Bulk add multiple devices
   */
  static async bulkAddDevices(req, res) {
    try {
      const { devices } = req.body;

      if (!Array.isArray(devices) || devices.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Devices array is required and must not be empty",
        });
      }

      console.log(`📱 Bulk adding ${devices.length} devices`);

      const results = [];

      for (const deviceData of devices) {
        const { deviceId, deviceInfo = {} } = deviceData;

        if (!deviceId) {
          results.push({
            deviceId: "unknown",
            status: "failed",
            error: "Device ID is required",
          });
          continue;
        }

        try {
          const inQueue = `octaloop-mdm-in-${deviceId}`;
          const outQueue = `octaloop-mdm-out-${deviceId}`;

          // Create both queues
          await mqttService.createQueue(inQueue, { qos: 1, durable: true });
          await mqttService.createQueue(outQueue, { qos: 1, durable: true });

          results.push({
            deviceId,
            status: "success",
            inQueue,
            outQueue,
            deviceInfo,
          });

          console.log(`✅ Device ${deviceId} added successfully`);
        } catch (error) {
          results.push({
            deviceId,
            status: "failed",
            error: error.message,
          });
          console.error(`❌ Failed to add device ${deviceId}:`, error.message);
        }

        // Small delay to avoid overwhelming the broker
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const successCount = results.filter((r) => r.status === "success").length;
      const failureCount = results.filter((r) => r.status === "failed").length;

      res.json({
        success: successCount > 0,
        message: `Bulk device addition completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          results,
          summary: {
            total: devices.length,
            successful: successCount,
            failed: failureCount,
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error in bulk device addition:", error);
      res.status(500).json({
        success: false,
        error: "Failed to bulk add devices",
        details: error.message,
      });
    }
  }
}

module.exports = DeviceController;
