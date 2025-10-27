const mqttService = require("../services/mqttService");

class MQTTController {
  /**
   * Get MQTT connection status
   */
  static getStatus(req, res) {
    try {
      const status = mqttService.getConnectionStatus();
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to get MQTT status",
        details: error.message,
      });
    }
  }

  static broadcastAlldevices(req, res) {
    const { message } = req.body;
    try {
      const broadcast = mqttService.publish("broadcast-out", message);

      res.json({
        success: true,
        data: broadcast,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to broadcast",
        details: error.message,
      });
    }
  }
  /**
   * Publish message to MQTT topic
   */
  static async publishMessage(req, res) {
    try {
      const { topic, message, options = { qos: 1, retain: false } } = req.body;

      if (!topic || message === undefined) {
        return res.status(400).json({
          success: false,
          error: "Topic and message are required",
        });
      }

      await mqttService.publish(topic, message, options);

      res.json({
        success: true,
        message: "Message published successfully",
        data: {
          topic,
          messageSize: JSON.stringify(message).length,
          options,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error publishing message:", error);
      res.status(500).json({
        success: false,
        error: "Failed to publish message",
        details: error.message,
      });
    }
  }

  /**
   * Subscribe to MQTT topic
   */
  static subscribeToTopic(req, res) {
    try {
      const { topic, options = { qos: 1 } } = req.body;

      if (!topic) {
        return res.status(400).json({
          success: false,
          error: "Topic is required",
        });
      }

      const success = mqttService.subscribe(topic, options);

      if (success) {
        res.json({
          success: true,
          message: "Subscribed to topic successfully",
          data: {
            topic,
            options,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to subscribe to topic (client not connected)",
        });
      }
    } catch (error) {
      console.error("Error subscribing to topic:", error);
      res.status(500).json({
        success: false,
        error: "Failed to subscribe to topic",
        details: error.message,
      });
    }
  }

  /**
   * Unsubscribe from MQTT topic
   */
  static unsubscribeFromTopic(req, res) {
    try {
      const { topic } = req.body;

      if (!topic) {
        return res.status(400).json({
          success: false,
          error: "Topic is required",
        });
      }

      const success = mqttService.unsubscribe(topic);

      if (success) {
        res.json({
          success: true,
          message: "Unsubscribed from topic successfully",
          data: { topic },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to unsubscribe from topic (client not connected)",
        });
      }
    } catch (error) {
      console.error("Error unsubscribing from topic:", error);
      res.status(500).json({
        success: false,
        error: "Failed to unsubscribe from topic",
        details: error.message,
      });
    }
  }

  /**
   * Get list of current subscriptions
   */
  static getSubscriptions(req, res) {
    try {
      const status = mqttService.getConnectionStatus();
      res.json({
        success: true,
        data: {
          subscriptions: status.subscriptions,
          count: status.subscriptions.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to get subscriptions",
        details: error.message,
      });
    }
  }

  /**
   * Create a new queue
   */
  static async createQueue(req, res) {
    try {
      const { queueName, options = { qos: 1, durable: true } } = req.body;

      if (!queueName) {
        return res.status(400).json({
          success: false,
          error: "Queue name is required",
        });
      }

      // Validate queue name format
      if (typeof queueName !== "string" || queueName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: "Queue name must be a non-empty string",
        });
      }

      // Validate options
      const validatedOptions = {
        qos: options.qos || 1,
        durable: options.durable !== undefined ? options.durable : true,
      };

      // Ensure QoS is valid (0, 1, or 2)
      if (![0, 1, 2].includes(validatedOptions.qos)) {
        return res.status(400).json({
          success: false,
          error: "QoS must be 0, 1, or 2",
        });
      }

      console.log(
        `🎯 API request to create queue: ${queueName}`,
        validatedOptions
      );

      const result = await mqttService.createQueue(queueName, validatedOptions);

      res.json({
        success: true,
        message: `Queue '${queueName}' created successfully`,
        data: {
          queueName,
          options: validatedOptions,
          granted: result,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error creating queue via API:", error);

      if (error.message === "MQTT client not connected") {
        return res.status(503).json({
          success: false,
          error: "MQTT service unavailable",
          details: "MQTT client is not connected to the broker",
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to create queue",
        details: error.message,
      });
    }
  }
}

module.exports = MQTTController;
