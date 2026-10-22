// @jsxImportSource react
import React from 'react';
import { io, Socket } from 'socket.io-client';
import './index.css';

const SOCKET_URL = 'http://localhost:3001';

// Error types
const ERRORS = {
  INVALID_ROOM: 'Invalid room code',
  ROOM_FULL: 'Room is full (max 8 players)',
  ROOM_IN_GAME: 'Cannot join - game is already in progress',
  PLAYER_LEFT: 'Player left the room',
  DISCONNECTED: 'Disconnected from server',
};

// Show error message temporarily
const [errorMessage, setErrorMessage] = React.useState('');
const [errorTimeout, setErrorTimeout] = React.useState<number | null>(null);

const clearError = React.useCallback(() => {
  setErrorMessage('');
  if (errorTimeout) clearTimeout(errorTimeout);
  setErrorTimeout(null);
}, []);

const PAGE_HOME = 'home';
const PAGE_LOBBY = 'lobby';
const PAGE_GAME = 'game';
const PAGE_RESULTS = 'results';

const DIFFICULTY_EASY = 'easy';
const DIFFICULTY_MEDIUM = 'medium';
const DIFFICULTY_HARD = 'hard';

const CATEGORY_TECH = 'tech';
const CATEGORY_QUOTES = 'quotes';
const CATEGORY_GENERAL = 'general';

const WORD_COUNT_OPTIONS = [25, 50, 100];
const TIME_MODE_OPTIONS = [15, 30, 60, 120];

export default function App() {
  const [page, setPage] = React.useState(PAGE_HOME);
  const [playerName, setPlayerName] = React.useState('');
  const [roomCode, setRoomCode] = React.useState('');
  const [opponentName, setOpponentName] = React.useState('');
  const [roomsList, setRoomsList] = React.useState([]);

  // Lobby state
  const [players, setPlayers] = React.useState([]);
  const [settings, setSettings] = React.useState({
    mode: 'word',
    wordCount: 25,
    difficulty: DIFFICULTY_EASY,
    category: CATEGORY_TECH,
    timeLimit: 30,
  });
  const [isReady, setIsReady] = React.useState(false);
  const [startEnabled, setStartEnabled] = React.useState(false);

  // Game screen state
  const [currentText, setCurrentText] = React.useState('');
  const [countdown, setCountdown] = React.useState(3);
  const [isCountdownActive, setIsCountdownActive] = React.useState(false);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [finishTime, setFinishTime] = React.useState(null);
  const [gameEnded, setGameEnded] = React.useState(false);

  // Per-player typing state
  const [playerProgress, setPlayerProgress] = React.useState({});
  const [myProgress, setMyProgress] = React.useState({
    progress: 0,
    wpm: 0,
    accuracy: 0,
    finished: false,
  });

  const [leaderboard, setLeaderboard] = React.useState([]);
  const [message, setMessage] = React.useState('');

  let socket: Socket | null = null;
  let reconnectInterval: NodeJS.Timeout | null = null;

  // Helper: sanitize HTML for player names
  function sanitizeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Helper: generate room code
  const generateRoomCode = React.useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setRoomCode(code);
  }, []);

  // Helper: format time
  const formatTime = React.useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  // Helper: calculate WPM
  const calculateWPM = React.useCallback((typedChars, elapsedSeconds) => {
    if (elapsedSeconds <= 0) return 0;
    const wordsTyped = typedChars > 0 ? Math.ceil(typedChars / 5) : 0;
    return Math.round((wordsTyped / elapsedSeconds) * 60);
  }, []);

  // Helper: calculate accuracy
  const calculateAccuracy = React.useCallback((typedText, originalText) => {
    if (typedText.length === 0 && originalText.length === 0) return 100;
    if (originalText.length === 0) return 0;
    
    let correct = 0;
    const minLength = Math.min(typedText.length, originalText.length);
    
    for (let i = 0; i < minLength; i++) {
      if (typedText[i] === originalText[i]) correct++;
    }
    
    const accuracy = (correct / Math.max(1, originalText.length)) * 100;
    return Math.round(accuracy * 10) / 10;
  }, []);

  // Initialize audio when component mounts
  React.useEffect(() => {
    // Web Audio API setup for sound effects
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Countdown beep (3 tones)
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.frequency.value = 440 + i * 100;
      osc.connect(ctx.destination);
      osc.start();
      setTimeout(() => osc.stop(), 300);
    }
    
    // GO! fanfare
    const goOsc = ctx.createOscillator();
    goOsc.frequency.value = 523;
    goOsc.type = 'sine';
    goOsc.connect(ctx.destination);
    goOsc.start();
    setTimeout(() => goOsc.stop(), 500);
    
    // Finish fanfare
    const finishOsc = ctx.createOscillator();
    finishOsc.frequency.value = 659;
    finishOsc.type = 'sine';
    finishOsc.connect(ctx.destination);
    finishOsc.start();
    setTimeout(() => finishOsc.stop(), 1000);
  }, []);

  // Socket.io setup
  React.useEffect(() => {
    if (!playerName) return;
    
    socket = io(SOCKET_URL, {
      auth: { name: sanitizeHtml(playerName) },
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      clearInterval(reconnectInterval);
      setMessage('');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setMessage('Disconnected. Reconnecting...');
      reconnectInterval = setInterval(() => {
        if (socket?.connect()) {
          clearInterval(reconnectInterval);
          setMessage('');
          socket.emit('join_room', { name: playerName, roomCode });
        }
      }, 3000);
    });

    // Room events
    socket.on('room_created', (data) => {
      setRoomCode(data.roomCode);
      setPage(PAGE_LOBBY);
    });

    socket.on('room_joined', (data) => {
      setPlayers(data.room.players);
      setIsReady(false);
      setStartEnabled(false);
      setMessage('');
    });

    socket.on('room_update', (data) => {
      setPlayers(data.room.players);
      setStartEnabled(data.room.players.length >= 2 && data.room.players.every(p => p.ready));
    });

    socket.on('start_game', (data) => {
      setCurrentText(data.text);
      setCountdown(3);
      setIsCountdownActive(true);
      setGameStarted(false);
      setGameEnded(false);
      setLeaderboard([]);
      
      // Start countdown
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCountdownActive(false);
            setGameStarted(true);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('progress_update', (data) => {
      setPlayerProgress(data.room.players.reduce((acc, p) => {
        acc[p.id] = {
          progress: p.progress,
          wpm: p.wpm,
          accuracy: p.accuracy,
          finished: p.finished,
        };
        return acc;
      }, {}));
      
      const myPlayer = data.room.players.find(p => p.id === socket?.id);
      if (myPlayer) {
        setMyProgress({
          progress: myPlayer.progress,
          wpm: myPlayer.wpm,
          accuracy: myPlayer.accuracy,
          finished: myPlayer.finished,
        });
      }
    });

    socket.on('player_finished', (data) => {
      setGameEnded(true);
      setFinishTime(Date.now());
      setLeaderboard(data.room.players
        .filter(p => p.finished)
        .sort((a, b) => a.finishedAt - b.finishedAt)
        .map((p, i) => ({
          position: i + 1,
          name: p.name,
          wpm: p.wpm,
          accuracy: p.accuracy,
          timeTaken: Math.floor((p.finishedAt - p.joinedAt) / 1000),
        })));
    });

    socket.on('game_over', (data) => {
      setLeaderboard(data.leaderboard);
      setGameEnded(true);
      setFinishTime(Date.now());
    });

    return () => {
      socket?.disconnect();
      clearInterval(reconnectInterval);
    };
  }, [playerName]);

  // Handle name input
  const handleNameChange = React.useCallback((e) => {
    setPlayerName(e.target.value);
  }, []);

  const handleNameSubmit = React.useCallback((e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    socket?.emit('create_room', sanitizeHtml(playerName.trim()));
  }, [playerName]);

  // Handle room joining
  const handleJoinRoom = React.useCallback((e) => {
    e.preventDefault();
    const code = roomCode.trim();
    if (!code) return;
    socket?.emit('join_room', { name: sanitizeHtml(playerName), roomCode: code });
  }, []);

  // Handle ready toggle
  const handleReadyToggle = React.useCallback((e) => {
    setIsReady(prev => !prev);
    socket?.emit('player_ready', roomCode);
  }, [roomCode]);

  // Handle settings change
  const handleSettingChange = React.useCallback((e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  // Handle start game (host only)
  const handleStartGame = React.useCallback(() => {
    if (!roomCode || !settings) return;
    socket.emit('start_game', roomCode, settings);
  }, [roomCode, settings]);

  // Handle typing input
  const [typedText, setTypedText] = React.useState('');
  const [charIndex, setCharIndex] = React.useState(0);
  const [wpm, setWPM] = React.useState(0);
  const [accuracy, setAccuracy] = React.useState(100);
  const [startTime, setStartTime] = React.useState(null);
  const [mistakes, setMistakes] = React.useState(0);
  
  const textRef = React.useRef(currentText);

  React.useEffect(() => {
    textRef.current = currentText;
  }, [currentText]);

  const handleKeyDown = React.useCallback((e) => {
    if (!gameStarted || !currentText || gameEnded) return;
    
    const char = currentText[charIndex];
    
    if (e.key === ' ' || e.key === '\n' || e.key === '') {
      if (charIndex >= currentText.length) {
        e.preventDefault();
        const elapsed = (Date.now() - startTime!) / 1000;
        const wpm = calculateWPM(typedText.length, elapsed);
        const acc = calculateAccuracy(typedText, currentText);
        
        socket?.emit('typing_progress', {
          roomCode,
          progress: 100,
          wpm,
          accuracy,
          typedText,
          currentIndex: currentText.length,
          mistakes,
        });
        
        setMistakes(0);
        setTypedText('');
        setCharIndex(0);
        setWPM(0);
        setAccuracy(100);
        setStartTime(null);
        setGameEnded(true);
        return;
      }
      return;
    }
    
    if (e.key === char) {
      const newTyped = typedText + e.key;
      setTypedText(newTyped);
      setCharIndex(charIndex + 1);
      
      if (startTime === null) {
        setStartTime(Date.now());
      }
      
      const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
      const newWPM = elapsed > 0 ? calculateWPM(newTyped.length, elapsed) : 0;
      const newAcc = calculateAccuracy(newTyped, currentText);
      
      setWPM(newWPM);
      setAccuracy(newAcc);
      
      const progress = ((charIndex + 1) / currentText.length) * 100;
      setMistakes(0);
      
      socket?.emit('typing_progress', {
        roomCode,
        progress,
        wpm: newWPM,
        accuracy: newAcc,
        typedText: newTyped,
        currentIndex: charIndex + 1,
        mistakes: 0,
      });
    } else {
      setMistakes(prev => prev + 1);
    }
  }, [currentText, gameStarted, charIndex, calculateWPM, calculateAccuracy, socket, roomCode, gameEnded, setTypedText, setCharIndex, setWPM, setAccuracy, setStartTime, setMistakes, setGameEnded]);

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Disable copy-paste in input
  const inputRef = React.useRef(null);
  
  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.onpaste = () => false;
      inputRef.current.oncopy = () => false;
      inputRef.current.oncut = () => false;
    }
  }, []);

  // Countdown finish
  React.useEffect(() => {
    if (countdown === null && isCountdownActive) {
      const timer = setTimeout(() => {
        setIsCountdownActive(false);
        setGameStarted(true);
        // Initialize audio context after user interaction
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 523;
          osc.type = 'sine';
          osc.connect(ctx.destination);
          osc.start();
          setTimeout(() => osc.stop(), 500);
        }
        setGameStarted(true);
        setStartTime(Date.now());
      }, 500);
    }
  }, [countdown, isCountdownActive]);

  // Game over handling from typing progress
  React.useEffect(() => {
    if (myProgress.finished && !gameEnded) {
      setGameEnded(true);
      setFinishTime(Date.now());
      socket?.emit('player_finished', { roomCode });
    }
  }, [myProgress.finished, gameEnded, socket, roomCode]);

  // --- PAGE RENDERERS ---

  // HOME PAGE
  if (page === PAGE_HOME) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-card rounded-xl p-8 max-w-md w-full shadow-xl">
          <h1 className="text-3xl font-bold text-accent mb-4">Multiplayer Typing Race</h1>
          <p className="text-muted text-sm mb-8">Race against other players in real-time!</p>
          
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Enter your name</label>
              <input
                type="text"
                value={playerName}
                onChange={handleNameChange}
                required
                className="w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-gray-200 focus:outline-none focus:border-accent"
                placeholder="Player1"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-accent text-bg font-medium py-3 rounded-lg hover:bg-accent-hover transition-colors"
            >
              {socket?.connected ? 'Connected' : 'Create/Join Room'}
            </button>
          </form>
          
          {roomCode && <p className="mt-4 text-sm text-muted">Room Code: <span className="font-mono text-accent">{roomCode}</span></p>}
        </div>
      </div>
    );
  }

  // LOBBY PAGE
  if (page === PAGE_LOBBY) {
    return (
      <div className="min-h-screen bg-bg p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-xl p-6 shadow-xl mb-6">
            <h2 className="text-2xl font-bold text-accent mb-4">Room {roomCode}</h2>
            
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted mb-3">Players ({players.length}/8)</h3>
              {errorMessage && <p className="text-red-600 text-sm mb-2">{errorMessage}</p>}
              {players.length === 0 ? (
                <p className="text-muted">No players yet</p>
              ) : (
                <div className="space-y-2">
                  {players.map((player) => (
                    <div key={player.id} className={['flex items-center justify-between p-3 rounded-lg', player.ready ? 'bg-green-200/20' : 'bg-gray-900'].join(' ')}>
                      <span className="font-medium">{player.name}</span>
                      <span className="text-muted text-xs">{player.ready ? 'Ready' : 'Not Ready'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted mb-3">Game Settings</h3>
              
              <div className="mb-4">
                <label className="block text-xs mb-1">Mode</label>
                <select
                  value={settings.mode}
                  onChange={handleSettingChange}
                  name="mode"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-200 focus:outline-none focus:border-accent"
                >
                  <option value="word">Word Count Mode</option>
                  <option value="time">Time Mode</option>
                </select>
              </div>
              
              {settings.mode === 'word' && (
                <div className="mb-4">
                  <label className="block text-xs mb-1">Word Count</label>
                  <select
                    value={settings.wordCount}
                    onChange={handleSettingChange}
                    name="wordCount"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-200 focus:outline-none focus:border-accent"
                  >
                    {WORD_COUNT_OPTIONS.map((count) => (
                      <option key={count} value={count}>{count} words</option>
                    ))}
                  </select>
                </div>
              )}
              
              {settings.mode === 'time' && (
                <div className="mb-4">
                  <label className="block text-xs mb-1">Time Limit</label>
                  <select
                    value={settings.timeLimit}
                    onChange={handleSettingChange}
                    name="timeLimit"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-200 focus:outline-none focus.border-accent"
                  >
                    {TIME_MODE_OPTIONS.map((time) => (
                      <option key={time} value={time}>{time}s</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-xs mb-1">Difficulty</label>
                <select
                  value={settings.difficulty}
                  onChange={handleSettingChange}
                  name="difficulty"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-200 focus:outline-none focus.border-accent"
                >
                  <option value={DIFFICULTY_EASY}>Easy</option>
                  <option value={DIFFICULTY_MEDIUM}>Medium</option>
                  <option value={DIFFICULTY_HARD}>Hard</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-xs mb-1">Text Category</label>
                <select
                  value={settings.category}
                  onChange={handleSettingChange}
                  name="category"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-200 focus:outline-none focus.border-accent"
                >
                  <option value={CATEGORY_TECH}>Tech Words</option>
                  <option value={CATEGORY_QUOTES}>Random Quotes</option>
                  <option value={CATEGORY_GENERAL}>General English</option>
                </select>
              </div>
            </div>
            
            <div className="mb-6">
              <button
                onClick={handleReadyToggle}
                className={['w-full py-3 rounded-lg font-medium transition-colors', isReady ? 'bg-green-200 text-green-800' : 'bg-gray-700 text-gray-200 hover:bg-accent'].join(' ')}
              >
                {isReady ? 'Mark as Not Ready' : 'Mark as Ready'}
              </button>
            </div>
            
            {players.length >= 2 && players.every(p => p.ready) && startEnabled && (
              <button
                onClick={handleStartGame}
                className="w-full bg-accent text-bg font-medium py-3 rounded-lg hover:bg-accent-hover transition-colors"
              >
                Start Game (All Ready)
              </button>
            )}
            
            {players.length < 2 && <p className="text-sm text-muted mb-2">Need at least 2 players to start</p>}
            {!startEnabled && players.length >= 2 && <p className="text-sm text-muted">Wait for all players to be ready</p>}
          </div>
        </div>
      </div>
    );
  }

  // GAME PAGE
  if (page === PAGE_GAME) {
    return (
      <div className="min-h-screen bg-bg p-4">
        <div className="max-w-3xl mx-auto">
          {isCountdownActive && (
            <div className="text-center mb-8">
              <div className="text-6xl font-bold text-accent">{countdown}</div>
              <div className="text-muted">Get ready!</div>
            </div>
          )}
          
          {gameStarted && !gameEnded && (
            <div className="bg-card rounded-xl p-6 shadow-xl mb-8">
              <div className="relative">
                <div className="sm:h-48 md:h-60 bg-gray-900 rounded-lg p-4 mb-6 overflow-y-auto">
                  <p className="text-muted text-base">
                    {currentText.split('').map((char, i) => {
                      const typed = typedText[i];
                      const isCorrect = char === typed;
                      const isCurrent = i === charIndex;
                      
                      if (i > charIndex) return <span key={i}>{char}</span>;
                      
                      if (isCurrent && !gameEnded) {
                        return (
                          <span
                            key={i}
                            className={isCorrect ? 'relative inline-block bg-green-200 text-green-800' : 'relative inline-block bg-red-200 text-red-800'}
                          >
                            {char}
                          </span>
                        );
                      }
                      
                      if (isCorrect) {
                        return <span key={i} className="bg-green-200 text-green-800 inline-block">{char}</span>;
                      }
                      
                      return <span key={i} className="bg-red-200 text-red-800 inline-block">{char}</span>;
                    })}
                  </p>
                </div>
                
                <div className="mt-6 space-y-2 sm:mt-8 md:mt-10">
                  {players.map((player) => {
                    const progressData = playerProgress[player.id] || { progress: 0, wpm: 0, accuracy: 0, finished: false };
                    const isMe = player.id === socket?.id;
                    
                    return (
                      <div key={player.id} className="flex items-center space-x-3">
                        <div className={isMe ? 'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-accent text-bg font-bold' : 'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-700 text-muted'}>
                          {player.name.charAt(0)}
                        </div>
                        
                        <div className="flex-1 h-5 sm:h-6 md:h-7 rounded-full bg-gray-700 overflow-hidden relative">
                          <div
                            className={isMe ? 'absolute left-0 top-0 bottom-0 rounded-full bg-accent' : 'absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-accent to-cyan'}
                            style={{width: progressData.progress + '%'}}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          />
                          <div className="absolute right-0 top-0 bottom-0 w-px bg-gray-700" />
                        </div>
                        
                        <div className="w-24 sm:w-32 md:w-40 text-sm sm:text-base md:text-lg font-medium flex flex-col space-y-1">
                          <span>{progressData.wpm > 0 ? progressData.wpm + ' WPM' : '0 WPM'}</span>
                          <span>{progressData.accuracy > 0 ? progressData.accuracy + '%' : '0%' } Acc</span>
                        </div>
                        
                        {player.finished && (
                          <div className="w-2 h-2 rounded-full bg-accent absolute right-2 animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-gray-700">
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-muted text-sm">Type: {charIndex}/{currentText.length}</span>
                  <span className="text-accent font-medium">{Math.round(wpm)} WPM</span>
                  <span className="text-muted text-sm">{Math.round(accuracy)}%</span>
                </div>
                
                <input
                  ref={inputRef}
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!gameStarted || gameEnded}
                  autoComplete="off"
                  spellCheck="false"
                  className="w-full bg-gray-900 rounded-lg sm:p-6 md:p-8 text-3xl font-mono text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent transition-colors min-h-[60px]"
                  placeholder="Start typing..."
                />
              </div>
            </div>
          )}
          
          {gameEnded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-card rounded-xl p-8 text-center max-w-md w-full shadow-2xl">
                {finishTime ? (
                  <div>
                    <div className="text-4xl font-bold text-accent">{leaderboard.length > 0 ? 'Player ' + leaderboard[0].position + ' wins!' : 'You win!'}</div>
                    <div className="text-muted mt-2">Time: {formatTime(Math.floor((finishTime - startTime!) / 1000))}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl font-bold text-accent">Game Over</div>
                    <div className="text-muted mt-2">Waiting for other players...</div>
                  </div>
                )}
                
                {leaderboard.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xl font-bold text-accent mb-3">Leaderboard</h3>
                    <div className="space-y-2">
                      {leaderboard.map((player) => (
                        <div key={player.position} className={['flex items-center justify-between p-3 rounded-lg', player.position === 1 ? 'bg-green-200/20' : player.position === 2 ? 'bg-red-200/20' : 'bg-gray-900/20'].join(' ')}>
                          <span className="font-medium text-sm">{player.name}</span>
                          <span className="font-medium text-sm">{player.position}.</span>
                          <span className="text-green-600">WPM: {player.wpm}</span>
                          <span className="text-muted">Acc: {player.accuracy}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <button
                    onClick={() => setPage(PAGE_RESULTS)}
                    className="w-full bg-accent text-bg font-medium py-2 rounded-lg hover:bg-accent-hover transition-colors"
                  >
                    View Results
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // RESULTS PAGE
  if (page === PAGE_RESULTS) {
    return (
      <div className="min-h-screen bg-bg p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card rounded-xl p-6 shadow-xl mb-8">
            <h2 className="text-2xl font-bold text-accent mb-4">Results</h2>
            
            {leaderboard.length > 0 && (
              <div>
                <h3 className="text-xl font-medium text-muted mb-4">Final Leaderboard</h3>
                <table className="w-full min-w-64 text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-2">Position</th>
                      <th className="text-left p-2">Player</th>
                      <th className="text-left p-2">WPM</th>
                      <th className="text-left p-2">Accuracy</th>
                      <th className="text-left p-2">Time Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player) => (
                      <tr key={player.position} className={['border-b border-gray-700 hover:bg-green-200/20', player.position === 2 ? 'hover:bg-red-200/20' : 'hover:bg-gray-900/20'].join(' ')}>
                        <td className="p-2 font-medium">{player.position}</td>
                        <td className="p-2 font-medium">{player.name}</td>
                        <td className="p-2">{player.wpm}</td>
                        <td className="p-2">{player.accuracy}%</td>
                        <td className="p-2">{player.timeTaken}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-8 gap-3">
              <button
                onClick={() => setPage(PAGE_LOBBY)}
                className="flex-1 py-3 rounded-lg font-medium transition-colors bg-gray-700 text-gray-200 hover:bg-accent"
              >
                Play Again
              </button>
              <button
                onClick={() => setPage(PAGE_HOME)}
                className="flex-1 py-3 rounded-lg font-medium transition-colors bg-red-600 text-bg hover:bg-red-700"
              >
                Exit to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return React.createElement('div', null);
}