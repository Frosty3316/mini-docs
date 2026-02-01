import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "https://mini-docs-twm4.onrender.com";

console.log("SOCKET URL:", SOCKET_URL);

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});