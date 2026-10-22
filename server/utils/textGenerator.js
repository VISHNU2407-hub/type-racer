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
    // Common words, 5-8 words
    const count = mode === 'word' ? (mode === '25' ? 25 : mode === '50' ? 50 : 100) : 5;
    const selected = Array.from({ length: count }, () => getRandomItem(words));
    return selected.join(' ') + ' ';
  } else if (difficulty === 'medium') {
    // Sentences, 3-5 sentences
    const sentenceCount = 3 + Math.floor(Math.random() * 3);
    const sentences = [];
    for (let i = 0; i < sentenceCount; i++) {
      const wordCount = 8 + Math.floor(Math.random() * 12);
      const words = Array.from({ length: wordCount }, () => getRandomItem(words));
      sentences.push(words.join(' '));
    }
    return sentences.join(' ') + ' ';
  } else {
    // Hard: paragraphs with punctuation/numbers
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

module.exports = { generateTypingText, commonWords, techWords, randomQuotes };