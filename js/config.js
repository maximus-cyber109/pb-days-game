// 🔧 CONFIGURATION
const CONFIG = {
  // Supabase (Get from Supabase Dashboard → Settings → API)
  supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
  supabaseKey: 'YOUR_ANON_PUBLIC_KEY',
  
  // Netlify Function URL (will be your site URL after deployment)
  apiUrl: 'https://YOUR_SITE.netlify.app/.netlify/functions',
  
  // Sound effects
  SOUNDS: {
    cardFlip: '/sounds/card-flip.mp3',
    revealRare: '/sounds/reveal-rare.mp3',
    victory: '/sounds/victory.mp3'
  },
  
  // Test mode (set to false in production)
  TEST_MODE: false
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
