import Bull from "bull";
import dotenv from "dotenv";

dotenv.config();

export function createQueue(name) {
  const redisUrl = process.env.REDIS_URL;
  const q = new Bull(name, redisUrl);

  // Redis down үед crash үүсгэхгүй байхын тулд error listener-ийг боломжит client-үүд дээр залгана.
  q.on("error", (err) => console.error(`[Bull:${name}]`, err?.message || err));

  // Bull дотор ioredis client-үүд async үүсэж болдог тул бага зэрэг хүлээсний дараа listener нэмнэ.
  setTimeout(() => {
    const attach = (redisClient, label) => {
      if (!redisClient?.on) return;
      redisClient.on("error", (err) =>
        console.error(`[Redis:${label}:${name}]`, err?.message || err)
      );
    };
    attach(q.client, "client");
    attach(q.bclient, "bclient");
    attach(q.watchClient, "watchClient");
  }, 50);

  return q;
}
