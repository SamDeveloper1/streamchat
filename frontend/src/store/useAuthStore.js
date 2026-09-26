import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

// ✅ FIX: Determine base URL for socket connection
// In development → Vite dev server proxies API, but socket needs direct backend URL
// In production → same origin as the deployed app
const BASE_URL =
  import.meta.env.MODE === "development"
    ? "http://localhost:3000"
    : "https://streamchat-1q8m.onrender.com";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: false,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfileImage: false,
  socket: null,
  onlineUsers: [],

  checkAuth: async () => {
    try {
       const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1000);
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("[Auth] checkAuth failed:", error.message);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error("Error logging out");
      console.error("[Auth] Logout error:", error);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfileImage: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("[Auth] updateProfile error:", error);
      toast.error(error.response?.data?.message || "Update failed");
    } finally {
      set({ isUpdatingProfileImage: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();

    // Don't connect if not logged in
    if (!authUser) return;

    // Don't create a duplicate connection if already connected
    if (get().socket?.connected) return;

    // Clean up any existing disconnected socket before creating a new one
    get().socket?.disconnect();

    // ✅ FIX: Add transports config — critical for production environments
    // (Render, Railway, Nginx, etc.) where WebSocket upgrades may be blocked.
    // "polling" is the safe fallback; "websocket" is the preferred fast path.
    // Socket.IO will try websocket first, then fall back to polling automatically.
    const socket = io(BASE_URL, {
      withCredentials: true,           // send JWT cookie with handshake
      transports: ["websocket", "polling"], // ✅ explicit transport order
      reconnection: true,              // auto-reconnect on drop
      reconnectionAttempts: 5,         // try up to 5 times
      reconnectionDelay: 1000,         // wait 1s between attempts
      reconnectionDelayMax: 5000,      // cap at 5s
    });

    // ✅ FIX: Listen for connect/error for easier debugging
    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      // If server dropped us, socket.io will auto-reconnect.
      // If we called socket.disconnect() manually, it won't.
    });

    set({ socket });

    // Track who is online
    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, onlineUsers: [] }); // ✅ FIX: also clear onlineUsers on logout
    }
  },
}));
