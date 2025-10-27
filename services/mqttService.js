const mqtt = require("mqtt");
const EventEmitter = require("events");

class MQTTService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.subscriptions = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Initialize MQTT connection to ActiveMQ Artemis
   */
  async connect() {
    try {
      const options = {
        clientId:
          process.env.MQTT_CLIENT_ID ||
          "mdm-client-" + Math.random().toString(16).substr(2, 8),
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        keepalive: parseInt(process.env.MQTT_KEEP_ALIVE) || 60,
        clean: process.env.MQTT_CLEAN_SESSION === "true",
        reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD) || 1000,
        connectTimeout: 30 * 1000,
        rejectUnauthorized: process.env.MQTT_REJECT_UNAUTHORIZED === "true",
      };

      console.log(
        `🔄 Connecting to MQTT broker: ${process.env.MQTT_BROKER_URL}`
      );

      this.client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

      // Connection event handlers
      this.client.on("connect", () => {
        console.log("✅ Connected to ActiveMQ Artemis MQTT broker");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit("connected");
        this.subscribeToDefaultTopics();
      });

      this.client.on("disconnect", () => {
        console.log("🔌 Disconnected from MQTT broker");
        this.isConnected = false;
        this.emit("disconnected");
      });

      this.client.on("reconnect", () => {
        this.reconnectAttempts++;
        console.log(
          `🔄 Reconnecting to MQTT broker (attempt ${this.reconnectAttempts})`
        );

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error(
            "❌ Max reconnect attempts reached. Stopping reconnection."
          );
          this.client.end();
        }
      });

      this.client.on("error", (error) => {
        console.error("❌ MQTT connection error:", error.message);
        this.emit("error", error);
      });

      this.client.on("offline", () => {
        console.log("📴 MQTT client is offline");
        this.isConnected = false;
        this.emit("offline");
      });

      // Message handler
      this.client.on("message", (topic, message, packet) => {
        try {
          const messageString = message.toString();
          console.log(
            `📨 Received message on topic '${topic}':`,
            messageString
          );

          let parsedMessage;
          try {
            parsedMessage = JSON.parse(messageString);
          } catch (e) {
            parsedMessage = messageString;
          }

          this.emit("message", {
            topic,
            message: parsedMessage,
            packet,
          });

          // Route message based on topic pattern
          this.routeMessage(topic, parsedMessage);
        } catch (error) {
          console.error("❌ Error processing message:", error);
        }
      });
    } catch (error) {
      console.error("❌ Failed to initialize MQTT connection:", error);
      throw error;
    }
  }

  /**
   * Subscribe to default topics from environment configuration
   */
  subscribeToDefaultTopics() {
    const defaultTopics = "octaloop-mdm-in";
    if (defaultTopics) {
      const topics = defaultTopics.split(",").map((topic) => topic.trim());
      topics.forEach((topic) => {
        console.log(topic, "topic");
        this.subscribe(topic);
      });
    }
  }

  /**
   * Broadcast to all devices (shortcut method)
   * @param {string|object} message - Message to broadcast
   */
  async broadcastToAllDevices(message) {
    return this.broadcast(message, "all-devices", { qos: 1, retain: false });
  }

  /**
   * Subscribe to a topic
   * @param {string} topic - MQTT topic to subscribe to
   * @param {object} options - Subscription options
   */
  subscribe(topic, options = { qos: 1 }) {
    if (!this.isConnected) {
      console.warn("⚠️ Cannot subscribe: MQTT client not connected");
      return false;
    }

    console.log(options, "options");
    this.client.subscribe(topic, options, (error) => {
      if (error) {
        console.error(`❌ Failed to subscribe to topic '${topic}':`, error);
      } else {
        console.log(`📡 Subscribed to topic: ${topic}`);
        this.subscriptions.add(topic);
      }
    });

    return true;
  }

  /**
   * Unsubscribe from a topic
   * @param {string} topic - MQTT topic to unsubscribe from
   */
  unsubscribe(topic) {
    if (!this.isConnected) {
      console.warn("⚠️ Cannot unsubscribe: MQTT client not connected");
      return false;
    }

    this.client.unsubscribe(topic, (error) => {
      if (error) {
        console.error(`❌ Failed to unsubscribe from topic '${topic}':`, error);
      } else {
        console.log(`📡 Unsubscribed from topic: ${topic}`);
        this.subscriptions.delete(topic);
      }
    });

    return true;
  }

  /**
   * Publish a message to a topic
   * @param {string} topic - MQTT topic to publish to
   * @param {string|object} message - Message to publish
   * @param {object} options - Publish options
   */
  publish(topic, message, options = { qos: 1, retain: false }) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("MQTT client not connected"));
        return;
      }

      const messageString =
        typeof message === "object"
          ? JSON.stringify(message)
          : message.toString();

      console.log(topic, "This is the topic before publish");

      this.client.publish(topic, messageString, options, (error) => {
        if (error) {
          console.error(`❌ Failed to publish to topic '${topic}':`, error);
          reject(error);
        } else {
          console.log(
            `📤 Published message to topic '${topic}':`,
            messageString
          );
          resolve();
        }
      });
    });
  }

  /**
   * Route incoming messages based on topic patterns
   * @param {string} topic - Message topic
   * @param {any} message - Message payload
   */
  routeMessage(topic, message) {
    const topicParts = topic.split("/");

    // Route device messages
    if (topicParts[0] === "mdm" && topicParts[1] === "devices") {
      this.emit("deviceMessage", {
        deviceId: topicParts[2],
        action: topicParts[3],
        message,
      });
    }

    // Route command messages
    else if (topicParts[0] === "mdm" && topicParts[1] === "commands") {
      this.emit("commandMessage", {
        deviceId: topicParts[2],
        command: topicParts[3],
        message,
      });
    }

    // Route other messages
    else {
      this.emit("genericMessage", { topic, message });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      subscriptions: Array.from(this.subscriptions),
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Create a queue by subscribing to it (MQTT approach)
   * @param {string} queueName - Name of the queue to create
   * @param {object} options - Queue creation options
   */
  async createQueue(queueName, options = { qos: 1, durable: true }) {
    try {
      if (!this.isConnected) {
        throw new Error("MQTT client not connected");
      }

      console.log(`🔨 Creating queue: ${queueName}`);

      // Subscribe to the queue to ensure it exists
      return new Promise((resolve, reject) => {
        this.client.subscribe(queueName, options, (error, granted) => {
          if (error) {
            console.error(`❌ Failed to create queue '${queueName}':`, error);
            reject(error);
          } else {
            console.log(
              `✅ Queue '${queueName}' created/verified successfully`
            );
            this.subscriptions.add(queueName);
            resolve(granted);
          }
        });
      });
    } catch (error) {
      console.error("❌ Error creating queue:", error);
      throw error;
    }
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect() {
    if (this.client) {
      console.log("🔌 Disconnecting from MQTT broker...");
      this.client.end();
      this.isConnected = false;
    }
  }
}

module.exports = new MQTTService();
