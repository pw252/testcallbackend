const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
const server = http.createServer(app)

// Configure CORS
app.use(cors())

// Create Socket.io server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

app.get("/", (req, res) => {
  res.send("Hello World!")
})
// Socket.io connection handling
const rooms = {}

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  // Handle room joining
  socket.on("join", (roomId) => {
    console.log(`User ${socket.id} is joining room ${roomId}`)

    // Create room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [socket.id]

      // Join room
      socket.join(roomId)

      // Notify client they're the first one
      socket.emit("joined", { isFirst: true })
      console.log(`User ${socket.id} created room ${roomId}`)
    } else if (rooms[roomId].length === 1) {
      // Room exists with one participant
      rooms[roomId].push(socket.id)

      // Join room
      socket.join(roomId)

      // Notify client they're the second one
      socket.emit("joined", { isFirst: false })

      // Notify first participant
      socket.to(roomId).emit("user-connected")

      console.log(`User ${socket.id} joined existing room ${roomId}`)
    } else {
      // Room is full (2+ participants)
      socket.emit("full")
      console.log(`User ${socket.id} tried to join full room ${roomId}`)
    }
  })

  // Handle WebRTC signaling
  socket.on("offer", ({ roomId, offer }) => {
    console.log(`User ${socket.id} sent offer in room ${roomId}`)
    socket.to(roomId).emit("offer", offer)
  })

  socket.on("answer", ({ roomId, answer }) => {
    console.log(`User ${socket.id} sent answer in room ${roomId}`)
    socket.to(roomId).emit("answer", answer)
  })

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate)
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)

    // Find all rooms this user was in
    Object.keys(rooms).forEach((roomId) => {
      if (rooms[roomId] && rooms[roomId].includes(socket.id)) {
        // Remove user from room
        rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id)

        // Notify others that user left
        socket.to(roomId).emit("user-disconnected")

        console.log(`User ${socket.id} left room ${roomId}`)

        // Clean up empty rooms
        if (rooms[roomId].length === 0) {
          delete rooms[roomId]
          console.log(`Room ${roomId} deleted (empty)`)
        }
      }
    })
  })
})

// Start server
const PORT = 3001
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`)
})

module.exports = server
