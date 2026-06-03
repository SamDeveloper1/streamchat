import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
// import userRoutes from "./routes/user.routes.js"; // uncomment when ready

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/socket.js";

const PORT = ENV.PORT || 3000;

// ✅ Needed for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true })); // ✅ FIX: also parse URL-encoded bodies
app.use(cookieParser());

// ✅ FIX: Single, consistent CORS config
// The Socket.IO CORS in socket.js handles WS connections separately.
// This handles all HTTP REST requests.
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:3000",
        ENV.CLIENT_URL,
      ].filter(Boolean); // filter out undefined ENV values

      // Allow requests with no origin (e.g. Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ─── API Routes ────────────────────────────────────────────────────────────────

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
// app.use("/api/users", userRoutes);
app.get('/ping', (req, res) => {
  res.status(200).send('ok');
});

// ─── Production: Serve Frontend Static Build ──────────────────────────────────

if (ENV.NODE_ENV === "production") {
  // ✅ FIX: Serve the built frontend from /frontend/dist
  const frontendDistPath = path.join(__dirname, "../frontend/dist");

  app.use(express.static(frontendDistPath));

  // Any non-API route → return the React app (for client-side routing)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });

  console.log(`[Server] Serving frontend from: ${frontendDistPath}`);
}

// ─── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT} (${ENV.NODE_ENV || "development"})`);
  connectDB();
});
