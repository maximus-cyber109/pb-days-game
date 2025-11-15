// Card art, music and SFX and fonts! Update here anytime.
window.PB_ASSETS = {
  // Card image urls. Use remote, your own, or official assets with PNGs (300x420 or up).
  cards: {
    LensWarden: "https://email-editor-resources.s3.amazonaws.com/images/82618240/LensWarden.png",
    "Device-Keeper": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Device-Keeper.png",
    "File-Forger": "https://email-editor-resources.s3.amazonaws.com/images/82618240/File-Forger.png",
    "Crown-Shaper": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Crown-Shaper.png",
    "Blade-Bearer": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Blade-Bearer.png",
    "Tooth-Tyrant": "https://email-editor-resources.s3.amazonaws.com/images/82618240/Tooth-Tyrant.png",
    "Quick-Cloth":  "https://email-editor-resources.s3.amazonaws.com/images/82618240/Quick-Cloth.png"
  },

  // Clash Royale-like logo or PB Days event logo
  logo: "https://raw.githubusercontent.com/maximus-cyber109/pb-days-assets/main/Game-of-Crowns-Logo.png",
  // Use svg, png, or whatever you want for backgrounds and locks as below, same pattern.

  // Music and sounds (Pixabay, Mixkit, etc. - replace any time)
  music: {
    bg:    "https://cdn.pixabay.com/audio/2023/04/20/audio_128b28df86.mp3",   // fantasy bg music
    reveal: "https://cdn.pixabay.com/audio/2023/03/21/audio_fd55ef36e7.mp3",  // card reveal
    rare:   "https://cdn.pixabay.com/audio/2022/03/15/audio_115b7ac4ac.mp3",  // rare card
    click:  "https://cdn.pixabay.com/audio/2022/03/15/audio_128b28df86.mp3"   // fancy button click
  },

  // Lock SVG for locked cards (embed inline as .svg file or use url)
  lockIcon: "https://raw.githubusercontent.com/maximus-cyber109/pb-days-assets/main/lock.svg",

  // FONTS: Use open-source (Google Fonts, e.g. Russo One or Bungee)
  fontFamily: "'Russo One', 'Bungee', Arial, sans-serif",
  fontUrl: "https://fonts.googleapis.com/css2?family=Russo+One&display=swap"

  // Add more such assets (e.g. leader icons, crown svg) as needed, following above.
};

// Example usage: window.PB_ASSETS.cards['LensWarden']
// Example usage: <img src="${PB_ASSETS.cards['LensWarden']}">
