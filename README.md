# Inkroom

A real-time collaborative notepad: open a room and write together.

Live presence, named pages, in-document search, and light/dark theme.

**Live demo:** https://inkroom-swart.vercel.app  
**Server:** https://mini-docs-twm4.onrender.com

---

## Features

- Real-time collaborative editing over Socket.IO rooms
- Named pages in a sidebar (create / rename / delete)
- Shareable page links (`/d/:id`) — **Share** copies an invite URL
- Live presence avatars
- Typing indicators and throttled remote cursors
- In-page search (`Ctrl+F` / `Cmd+F`)
- Light / dark theme (OS default, persisted)
- Connection status for Render cold starts

---

## Architecture

**Client:** React (Vite) on Vercel  
**Server:** Node.js + Express + Socket.IO on Render (long-lived WebSockets; not a Vercel serverless function)

Each page is a socket room. Document text and titles live in memory on the server.

---

## Local setup

**Server**

```bash
cd server
npm install
npm start
```

**Client**

```bash
cp .env.example .env
npm install
npm run dev
```

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SOCKET_URL` | Vercel / client `.env` | Socket server URL |
| `CLIENT_ORIGIN` | Render | Extra allowed CORS origins (Vercel `*.vercel.app` is already allowed) |
| `PORT` | Render | Listen port, default `3001` |

---

## Keyboard

| Shortcut | Action |
| --- | --- |
| `Ctrl+F` / `Cmd+F` | Find in the current page |
| `Enter` / `F3` | Next match |
| `Shift+Enter` | Previous match |
| `Esc` | Close find |

---

## Deploy

- **Frontend:** Vercel project at the repo root (`npm run build` → `dist`). Set `VITE_SOCKET_URL=https://mini-docs-twm4.onrender.com` and redeploy.
- **Backend:** Render web service from `server/`. Optional: `CLIENT_ORIGIN=https://your-app.vercel.app`

---

## Known limits

- No database — pages disappear on server restart
- Last-write-wins, not CRDT/OT
- No accounts; anyone with the page link can edit
- Remote cursors follow the pointer, not the text caret
