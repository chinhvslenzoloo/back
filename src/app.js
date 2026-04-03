import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { auth } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import contactsRoutes from "./routes/contacts.js";
import companiesRoutes from "./routes/companies.js";
import dealsRoutes from "./routes/deals.js";
import activitiesRoutes from "./routes/activities.js";
import conversationsRoutes from "./routes/conversations.js";
import dashboardRoutes from "./routes/dashboard.js";
import remindersRoutes from "./routes/reminders.js";
import csvRoutes from "./routes/csv.js";
import monitoringRoutes from "./routes/monitoring.js";
import usersRoutes from "./routes/users.js";
import productsRoutes from "./routes/products.js";
import ordersRoutes from "./routes/orders.js";

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(requestId);
app.use(requestLogger);
app.use(rateLimit);

app.use("/monitoring", monitoringRoutes);
app.use("/auth", authRoutes);

app.use(auth);
app.use("/contacts", contactsRoutes);
app.use("/companies", companiesRoutes);
app.use("/deals", dealsRoutes);
app.use("/activities", activitiesRoutes);
app.use("/conversations", conversationsRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/reminders", remindersRoutes);
app.use("/csv", csvRoutes);
app.use("/users", usersRoutes);
app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);

app.use(errorHandler);

export default app;
