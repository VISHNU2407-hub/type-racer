const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory room storage
const rooms = {};
const roomCodes = new Set();

const commonWords = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me"
];

const techWords = [
  "algorithm", "variable", "function", "iterator", "asynchronous", "callback",
  "promise", "declaration", "implementation", "architecture", "framework",
  "compiler", "interpreter", "deployment", "repository", "deployment",
  "container", "microservice", "monolith", "frontend", "backend", "fullstack",
  "database", "endpoint", "serialization", "deserialization", "authentication",
  "authorization", "middleware", "router", "middleware", "serialization"
];

const randomQuotes = [
  "The only way to do great work is to love what you do.",
  "Stay hungry, stay foolish.",
  "In the middle of every difficulty lies opportunity.",
  "Life is what happens when you're busy making other plans.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "Ask not what your country can do for you — ask what you can do for your country.",
  "The only limit to our realization of tomorrow will be our doubts of today.",
  "Ask yourself if what you did today brought you closer to where you want to be tomorrow.",
  "The only thing we have to fear is fear itself.",
  "We become what we repeatedly do."
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTypingText(settings) {
  const { mode, difficulty, category } = settings;
  
  let words;
  
  if (category === 'tech') {
    words = techWords;
  } else if (category === 'quotes') {
    words = randomQuotes;
  } else {
    words = commonWords;
  }
  
  if (difficulty === 'easy') {
    const count = mode === 'word' ? (mode === '25' ? 25 : mode === '50' ? 50 : 100) : 5;
    const selected = Array.from({ length: count }, () => getRandomItem(words));
    return selected.join(' ') + ' ';
  } else if (difficulty === 'medium') {
    const sentenceCount = 3 + Math.floor(Math.random() * 3);
    const sentences = [];
    for (let i = 0; i < sentenceCount; i++) {
      const wordCount = 8 + Math.floor(Math.random() * 12);
      const words = Array.from({ length: wordCount }, () => getRandomItem(words));
      sentences.push(words.join(' '));
    }
    return sentences.join(' ') + ' ';
  } else {
    const paragraphCount = 2 + Math.floor(Math.random() * 2);
    const paragraphs = [];
    for (let i = 0; i < paragraphCount; i++) {
      const sentenceCount = 4 + Math.floor(Math.random() * 4);
      const sentences = [];
      for (let j = 0; j < sentenceCount; j++) {
        const wordCount = 6 + Math.floor(Math.random() * 8);
        const words = Array.from({ length: wordCount }, () => getRandomItem(words));
        sentences.push(words.join(' '));
      }
      paragraphs.push(sentences.join(' '));
    }
    return paragraphs.join(' \n ') + ' ';
  }
}

function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
  } while (roomCodes.has(code));
  roomCodes.add(code);
  return code;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create_room', (name) => {
    const roomCode = generateRoomCode();
    const room = {
      id: roomCode,
      hostId: socket.id,
      players: [{ id: socket.id, name, ready: false, wpm: 0, accuracy: 0, progress: 0, finished: false, score: 0 }],
      settings: null,
      gameStatus: 'lobby'
    };
    rooms[roomCode] = room;
    socket.join(roomCode);
    socket.emit('room_created', { roomCode, room });
  });

  socket.on('join_room', ({ name, roomCode }) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    if (room.players.length >= 8) {
      socket.emit('error', 'Room is full (max 8 players)');
      return;
    }
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.playerName = name;
    room.players.push({ id: socket.id, name, ready: false, wpm: 0, accuracy: 0, progress: 0, finished: false, score: 0 });
    io.to(roomCode).emit('room_update', { room, action: 'join' });
    socket.emit('room_joined', { roomCode, room });
  });

  socket.on('leave_room', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(roomCode);
    io.to(roomCode).emit('room_update', { room, action: 'leave' });
    if (room.players.length === 0) {
      delete rooms[roomCode];
      roomCodes.delete(roomCode);
    }
  });

  socket.on('player_ready', (roomCode) => {
    const room = rooms[roomCode];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    player.ready = true;
    io.to(roomCode).emit('room_update', { room, action: 'ready_change' });
    
    // Check if all players are ready to start
    const allReady = room.players.every(p => p.ready);
    if (allReady && room.players.length >= 2 && room.gameStatus === 'lobby') {
      io.to(roomCode).emit('start_enabled', true);
    }
  });

  socket.on('start_game', (roomCode, settings) => {
    const room = rooms[roomCode];
    if (!room || room.hostId !== socket.id) return;
    
    room.settings = settings;
    room.gameStatus = 'countdown';
    
    // Generate typing text based on settings
    const text = generateTypingText(settings);
    room.typingText = text;
    
    // Initialize player progress
    room.players.forEach(p => {
      p.progress = 0;
      p.wpm = 0;
      p.accuracy = 0;
      p.finished = false;
      p.typedText = '';
      p.currentIndex = 0;
      p.mistakes = 0;
    });
    
    io.to(roomCode).emit('game_start', { room, settings, text });
  });

  socket.on('typing_progress', ({ roomCode, progress, wpm, accuracy, typedText, currentIndex, mistakes }) => {
    const room = rooms[roomCode];
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    
    player.progress = progress;
    player.wpm = wpm;
    player.accuracy = accuracy;
    player.typedText = typedText;
    player.currentIndex = currentIndex;
    player.mistakes = mistakes;
    
    // Check if player finished
    if (progress >= 100 && !player.finished) {
      player.finished = true;
      player.finishedAt = Date.now();
      
      // Determine winner
      const finishedPlayers = room.players.filter(p => p.finished);
      if (finishedPlayers.length === 1) {
        io.to(roomCode).emit('player_finished', { room });
      }
    }
    
    io.to(roomCode).emit('progress_update', { room, player: { ...player, id: player.id } });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Try to find and leave rooms
    for (const [roomCode, room] of Object.entries(rooms)) {
      if (room.players.some(p => p.id === socket.id)) {
        room.players = room.players.filter(p => p.id !== socket.id);
        io.to(roomCode).emit('room_update', { room, action: 'disconnect' });
        if (room.players.length === 0) {
          delete rooms[roomCode];
          roomCodes.delete(roomCode);
        }
        break;
      }
    }
  });
});

// API: Get rooms list (for debugging)
app.get('/api/rooms', (req, res) => {
  res.json({ rooms: Object.fromEntries(Object.entries(rooms).map(([k, v]) => [k, { ...v, players: v.players.map(p => ({ id: p.id, name: p.name, ready: p.ready })) }]) });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { server, io };