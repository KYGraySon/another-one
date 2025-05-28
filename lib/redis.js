import { createClient } from "redis";

const redis = createClient({
  username: "default",
  password: "JgIgigc7oBveE7xRGHFeNXoHCAyBEWDE",
  socket: {
    host: "redis-13167.c92.us-east-1-3.ec2.redns.redis-cloud.com",
    port: 13167,

    // 🔁 Reconnection strategy: retry with backoff
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Redis: Too many reconnection attempts.");
        return new Error("Too many retries");
      }
      return Math.min(100 * 2 ** retries, 2000); // max 2s delay
    },
  },
});

redis.on("error", (err) => console.error("❌ Redis Client Error:", err));
redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("reconnecting", () => console.log("🔁 Reconnecting to Redis..."));

(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error("🚨 Redis connection failed:", err);
  }
})();

export default redis;
