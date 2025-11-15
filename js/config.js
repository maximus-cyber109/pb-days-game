// 🔧 CONFIGURATION - All credentials now in ENV
const CONFIG = {
  // These will be loaded from window.ENV (set by Netlify)
  supabaseUrl: null,  // Will be set from ENV
  supabaseKey: null,  // Will be set from ENV
  
  // Netlify Function URL (auto-detected)
  apiUrl: window.location.origin + '/.netlify/functions',
  
  // GitHub raw URLs for card images (update maximus-cyber109 and pb-days-game)
  cardImagesBaseUrl: 'https://raw.githubusercontent.com/maximus-cyber109/pb-days-game/main/images/cards',
  cardBackUrl: 'https://raw.githubusercontent.com/maximus-cyber109/pb-days-game/main/images/card-back.png',
  
  // Sound effects (can also be on GitHub)
  SOUNDS: {
    cardFlip: 'https://raw.githubusercontent.com/maximus-cyber109/pb-days-game/main/sounds/card-flip.mp3',
    revealRare: 'https://raw.githubusercontent.com/maximus-cyber109/pb-days-game/main/sounds/reveal-rare.mp3',
    victory: 'https://raw.githubusercontent.com/maximus-cyber109/pb-days-game/main/sounds/victory.mp3'
  },
  
  // Card names for image URLs
  cardNames: [
    'LensWarden',
    'Device-Keeper',
    'File-Forger',
    'Crown-Shaper',
    'Blade-Bearer',
    'Tooth-Tyrant',
    'Quick-Cloth'
  ],
  
  TEST_MODE: false
};

// Function to get card image URL
function getCardImageUrl(cardName) {
  return `${CONFIG.cardImagesBaseUrl}/${cardName}.png`;
}

// Load ENV variables from Netlify (injected at build time)
function loadEnvConfig() {
  // These are injected by Netlify as build environment variables
  CONFIG.supabaseUrl = '${VITE_SUPABASE_URL}';
  CONFIG.supabaseKey = '${VITE_SUPABASE_KEY}';
}

// Initialize on load
loadEnvConfig();
