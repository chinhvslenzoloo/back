import { createQueue } from "../config/redis.js";

export const reminderQueue = createQueue("reminder-email");
