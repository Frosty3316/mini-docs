# Mini Docs 📝   
A real-time collaborative document editor inspired by Google Docs.

Mini Docs allows multiple users to edit documents simultaneously with live presence, cursors, typing indicators, and multi-document support.

🔗 Live Demo: https://harmonious-klepon-777dcc.netlify.app    
🔌 Server: https://mini-docs-twm4.onrender.com

---

## ✨ Features

- Real-time collaborative editing
- Multi-document support
- Live user presence with avatars
- Typing indicators
- Cursor tracking scoped to each document
- Dark / Light mode with smooth transitions
- In-document search (Ctrl + F)
- Socket room isolation per document
- Deployed and publicly accessible

---

## 🧠 Architecture Overview

Mini Docs uses a client–server real-time architecture built on WebSockets.

### Client
- React (Vite)
- ContentEditable-based text editor
- Socket.IO client
- CSS variables for theming

### Server
- Node.js + Express
- Socket.IO
- In-memory document and user state

### Communication
- WebSocket connections via Socket.IO
- Each document corresponds to a separate socket room
- Edits and presence events are broadcast only within the active room

---

## 🔁 Data Flow

1. User opens the app and joins a document
2. Client emits `join-document` with document ID
3. Server assigns socket to a document-specific room
4. Server sends:
   - current document content
   - list of active users in the room
5. On edit:
   - client emits `edit`
   - server updates document state
   - changes are broadcast to other users in the same room

---

## ⚖️ Design Decisions & Tradeoffs

### Why Socket.IO?
Socket.IO simplifies:
- room management
- reconnection handling
- real-time event broadcasting

### Why not CRDTs or Operational Transforms?
To keep the project focused and understandable, Mini Docs uses a guarded last-write-wins model instead of complex CRDTs. This avoids cursor jumpiness while maintaining real-time collaboration.

### Why in-memory storage?
Persistence was intentionally excluded to prioritize:
- real-time collaboration mechanics
- clean architecture
- scope control

---

## 📌 Scope Justification

This project focuses on:
- real-time systems
- UX clarity
- collaboration mechanics

Rather than:
- long-term storage
- advanced conflict resolution
- formatting-heavy editors

---

## 🚀 Deployment

- Frontend: Netlify
- Backend: Render
- Environment variables used for deployment-safe configuration

---

## 🧪 Running Locally (Optional)

Mini Docs is fully deployed and usable via the live demo.  
Local setup is intended for developers who want to inspect or extend the real-time collaboration logic.

### Server
```bash
git clone https://github.com/Frosty3316/mini-docs.git
cd mini-docs/server
npm install
npm run dev
```

### Client
```bash
cd ../client
npm install
npm run dev
```

**Notes**
- Open multiple browser tabs to simulate different users
- Each document operates in an isolated Socket.IO room
- In-memory storage is used to focus on real-time collaboration mechanics

---

## 🧪 Future Improvements

- Persistent storage (database)
- User authentication
- Version history
- Rich text formatting
- Document permissions
- Offline handling

---

## 🏁 Conclusion

Mini Docs demonstrates the design and deployment of a real-time collaborative system with intentional tradeoffs, clean UX, and production-ready deployment, with a focus on WebSocket-based synchronization and room-scoped state management.

---

## 📐 Architecture Diagram

Client (React)       
   │                
   │ WebSocket (Socket.IO)         
   ▼            
Server (Node.js)           
   │              
   ├─ Document Room A            
   ├─ Document Room B         
   └─ Document Room C             
