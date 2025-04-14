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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id)

  // Register user
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
  socket.on("callUser", ({ to, from, signal }) => {
    // Find socket ID for target user - FIXED: compare with user.id
    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    console.log(`Call request from ${from} to ${to}`)
    console.log(`Signal data available: ${!!signal}`)

    if (targetSocketId) {
      console.log(`Target socket found: ${targetSocketId}`)
      io.to(targetSocketId).emit("incomingCall", { from, signal })
    } else {
      console.log(`Target user ${to} not found`)
    }
  })

  // Handle call acceptance
  socket.on("acceptCall", ({ to, signal }) => {
    // Find socket ID for target user - FIXED: compare with user.id
    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    console.log(`Call acceptance from ${users[socket.id].id} to ${to}`)
    console.log(`Signal data available: ${!!signal}`)

    if (targetSocketId) {
      console.log(`Target socket found: ${targetSocketId}`)
      io.to(targetSocketId).emit("callAccepted", { signal })
    } else {
      console.log(`Target user ${to} not found`)
    }
  })

  // Handle call decline
  socket.on("declineCall", ({ to }) => {
    // Find socket ID for target user - FIXED: compare with user.id
    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    if (targetSocketId) {
      io.to(targetSocketId).emit("callDeclined")
    }
  })

  // Handle call end
  socket.on("endCall", ({ to }) => {
    // Find socket ID for target user - FIXED: compare with user.id
    const targetSocketId = Object.keys(users).find((key) => users[key].id === to)

    if (targetSocketId) {
      io.to(targetSocketId).emit("callEnded")
    }
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id)
    delete users[socket.id]

    // Broadcast updated user list
    io.emit("users", Object.values(users))
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
