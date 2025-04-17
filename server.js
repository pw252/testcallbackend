const express = require("express")
const { createServer } = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: "Content-Type,Authorization",
  }),
)
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})
app.get("/", (req, res) => {
  res.send("Server is running")
})

// Store connected users
const users = {}

// Track users currently in a call
const calls = new Set()

io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  socket.on("register", ({ userId, userName }) => {
    console.log(`User registered: ${userName} (${userId})`)

    // Store both ID and name
    users[socket.id] = {
      id: userId,
      name: userName,
    }
    // Broadcast updated user list
    io.emit("users", Object.values(users))
  })

  // Handle call request
  socket.on("callUser", ({ to, from, signal, isAudioOnly }) => {
    const fromUser = Object.values(users).find(user => user.id === from)
    const callerName = fromUser ? fromUser.name : "Unknown"

    console.log(`Call request from ${callerName} (${from}) to ${to} (Audio only: ${isAudioOnly ? "Yes" : "No"})`)
    console.log(`Signal data available: ${!!signal}`)

    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    // Check if either caller or receiver is busy
    const isBusy = calls.has(from) || calls.has(to)

    if (isBusy) {
      console.log(`One of the users is busy: ${from} or ${to}`)
      io.to(socket.id).emit("userBusy", { message: "User is busy" })
      return
    }
    // socket.emit("isBusy")
    if (targetSocketId) {
      console.log(`Target socket found: ${targetSocketId} #`)
      // Mark both users as in call
      calls.add(from)
      calls.add(to)

      io.to(targetSocketId).emit("incomingCall", { from, callerName, signal, isAudioOnly })
    } else {
      console.log(`Target user ${to} not found`)
    }
  })

  // Handle call acceptance
  socket.on("acceptCall", ({ to, signal }) => {
    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    console.log(`Call acceptance from ${users[socket.id]?.id} to ${to}`)
    console.log(`Signal data available: ${!!signal}`)

    if (targetSocketId) {
      io.to(targetSocketId).emit("callAccepted", { signal })
    } else {
      console.log(`Target user ${to} not found`)
    }
  })

  // Handle call decline
  socket.on("declineCall", ({ to }) => {
    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    // Clean up call state
    const fromUser = users[socket.id]
    if (fromUser) {
      calls.delete(fromUser.id)
      calls.delete(to)
    }

    if (targetSocketId) {
      io.to(targetSocketId).emit("callDeclined")
    }
  })

  // Handle call end
  socket.on("endCall", ({ to }) => {
    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    // Clean up call state
    const fromUser = users[socket.id]
    if (fromUser) {
      calls.delete(fromUser.id)
      calls.delete(to)
    }

    if (targetSocketId) {
      io.to(targetSocketId).emit("callEnded")
    }
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    const disconnectedUser = users[socket.id]

    console.log("User disconnected:", socket.id)

    if (disconnectedUser) {
      // Clean up if user was in a call
      calls.delete(disconnectedUser.id)

      // Also remove them from anyone else's call
      for (const [socketId, user] of Object.entries(users)) {
        if (user.id !== disconnectedUser.id) {
          calls.delete(user.id)
        }
      }
    }

    delete users[socket.id]

    // Broadcast updated user list
    io.emit("users", Object.values(users))
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
