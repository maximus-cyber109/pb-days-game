// app-index.js
(function() {
  'use strict';

  // --- DOM & Config ---
  const config = window.CR_CONFIG;
  if (!config) {
    console.error("CR_CONFIG not loaded!");
    return;
  }

  const CARD_IMAGES = config.cards;
  const sfxReveal = document.getElementById('reveal-sfx');
  const sfxRare = document.getElementById('rare-sfx');
  const bgMusic = document.getElementById('bg-music');
  const stage = document.getElementById('reveal-stage');
  const redeemBtn = document.getElementById('reveal-redeem-btn');
  const muteBtn = document.getElementById('mute-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');

  let isMuted = true; // Start muted until user interacts
  let userInteracted = false;

  // Sound setup
  function loadAudio() {
    try {
      bgMusic.src = config.sounds.bg;
      sfxReveal.src = config.sounds.reveal;
      sfxRare.src = config.sounds.reveal; 
    } catch (e) {
      console.warn("Could not set audio sources", e);
    }
  }

  let userEmail = "";
  let userIsOverride = false;
  let overrideCards = [];
  const ALL_CARD_NAMES = Object.keys(CARD_IMAGES);

  // --- Audio Handling ---
  function playSfx(sfx) {
    if (isMuted || !userInteracted) return;
    try {
      sfx.currentTime = 0;
      sfx.play();
    } catch (e) {
      // console.warn("Audio play failed", e);
    }
  }

  function toggleMute() {
    if (!userInteracted) {
        // This is the first interaction, so load the audio
        loadAudio();
    }
    userInteracted = true; // First click counts as interaction
    isMuted = !isMuted;
    
    if (isMuted) {
      bgMusic.pause();
      iconMuted.style.display = 'block';
      iconUnmuted.style.display = 'none';
    } else {
      try {
        bgMusic.play();
      } catch(e) {
          console.warn("BG music play failed.", e);
      }
      iconMuted.style.display = 'none';
      iconUnmuted.style.display = 'block';
    }
  }
  
  muteBtn.onclick = toggleMute;
  
  // Also try to play on any click if not yet interacted
  document.body.addEventListener('pointerdown', () => {
    if (!userInteracted) {
        // Don't auto-play, wait for mute button click
        // This prevents the "NotAllowedError"
    }
  }, { once: true });


  // --- Initialization ---
  initSupabase();
  if (emailCheck()) {
    setTimeout(startRevealFlow, 80);
  }

  // --- Email & Auth ---
  function getOverrideTier(email) {
    if (!email) return null;
    let match = email.match(/-ovrmaaz(\d(?:-\d)?)/);
    if (match) {
      const t = match[1];
      if (t === "1") return { tier: "1", numCards: 1 };
      if (t === "2-4") return { tier: "2-4", numCards: 3 };
      if (t === "5-6") return { tier: "5-6", numCards: 6 };
      if (t === "7") return { tier: "7", numCards: 7 };
    }
    return null;
  }

  function askEmail() {
    const box = document.createElement('div');
    box.className = "modal-bg show";
    box.innerHTML = `<div class="modal-fg">
        <div class="pb-cash-text">Enter your email to claim your PB Days cards!</div>
        <form id="email-form" style="display: grid; gap: 1em;">
          <input type="email" required placeholder="Your Email" id="email-input" style="font-family:'Inter',sans-serif;font-size:1rem;border-radius:10px;padding:1em;border:2px solid #ccd;" />
          <button type="submit" class="btn-3d-glass">Begin Card Reveal</button>
        </form>
      </div>`;
    document.body.appendChild(box);
    box.querySelector('form').onsubmit = (e) => {
      e.preventDefault();
      userEmail = box.querySelector('#email-input').value.trim().toLowerCase();
      if (userEmail) {
        box.classList.remove('show');
        setTimeout(() => box.remove(), 300);
        startRevealFlow();
      }
    }
  }

  function emailCheck() {
    const urlParams = new URLSearchParams(window.location.search);
    let email = urlParams.get("email");
    if (!email) {
      askEmail();
      return false;
    }
    userEmail = email.toLowerCase();
    return true;
  }

  // --- Main Card Reveal Logic ---
  async function startRevealFlow() {
    if (!stage) {
      console.error("#reveal-stage not found");
      return;
    }

    // 1. Determine which cards to reveal
    let revealCards = [];
    let override = getOverrideTier(userEmail);
    userIsOverride = !!override;

    if (userIsOverride) {
      console.log("Using override:", override);
      revealCards = ALL_CARD_NAMES.slice(0, override.numCards);
    } else {
      console.log("Fetching cards for:", userEmail);
      try {
        // Fetch SKUs from our Netlify function
        let res = await fetch('/.netlify/functions/magento-fetch', {
          method: "POST",
          body: JSON.stringify({ email: userEmail }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) {
          throw new Error(`Magento fetch failed: ${res.statusText}`);
        }
        
        let data = await res.json();
        if (!data.success || !data.order || !data.skus.length) {
          throw new Error(data.error || 'No eligible SKUs found for this order.');
        }

        console.log("Order SKUs:", data.skus);
        
        revealCards = await window.getCardsFromOrderSkus(data.skus);
        console.log("Cards earned:", revealCards);

        if (!revealCards.length) {
          throw new Error('No cards associated with the segments in this order.');
        }

        // Insert grant to cards_earned for real users (if not already present)
        for (const card of revealCards) {
          let { data: existing, error } = await supabase.from('cards_earned')
            .select('id')
            .eq('customer_email', userEmail)
            .eq('card_name', card)
            .eq('order_id', data.order.increment_id); 
            
          if (error) console.error("Error checking cards_earned:", error);

          if (!existing || existing.length === 0) {
            console.log(`Granting card ${card} for order ${data.order.increment_id}`);
            await supabase.from('cards_earned').insert({
              customer_email: userEmail,
              card_name: card,
              order_id: data.order.increment_id,
              earned_at: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        console.error("Reveal flow error:", err);
        stage.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">Could not find eligible cards for this order.<br/>Error: ${err.message}</div>`;
        return;
      }
    }

    if (revealCards.length === 0) {
        stage.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">You didn't earn any new cards in this order.</div>`;
        return;
    }

    // 2. Build the 2x2 grid (initially hidden/locked)
    stage.innerHTML = ''; // Clear stage
    const grid = document.createElement('div');
    grid.className = "reveal-card-grid";

    let numCards = revealCards.length;
    let lockCount = 4 - numCards;
    
    let slots = [];
    for (let i = 0; i < numCards; i++) {
      slots.push({ name: revealCards[i], owned: true });
    }
    let otherCards = ALL_CARD_NAMES.filter(c => !revealCards.includes(c));
    for (let i = 0; i < lockCount; i++) {
      slots.push({ name: otherCards[i] || ALL_CARD_NAMES[i], owned: false });
    }

    // Add card elements to grid
    for (let i = 0; i < slots.length; i++) {
      let img = document.createElement('img');
      img.className = "reveal-card-static";
      img.src = CARD_IMAGES[slots[i].name] || config.logo;
      if (slots[i].owned) {
        img.classList.add('revealed');
        img.dataset.cardName = slots[i].name; // Tag revealed cards
      } else {
        img.classList.add('locked');
      }
      grid.appendChild(img);
    }
    stage.appendChild(grid);

    // 3. Start the sequential reveal animation
    await revealOneByOne(revealCards, grid);
    
    // 4. Show redeem button
    redeemBtn.style.display = "block";
    redeemBtn.style.opacity = "0";
    setTimeout(() => { redeemBtn.style.opacity = "1"; }, 100);
  }

  // Improved animation sequence
  async function revealOneByOne(cards, grid) {
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < cards.length; i++) {
      const cardName = cards[i];
      
      // 1. Create the big card
      const bigCard = document.createElement('img');
      bigCard.className = "reveal-card-big";
      bigCard.src = CARD_IMAGES[cardName] || "";
      stage.appendChild(bigCard);

      // 2. Animate it in (CSS transition)
      await delay(50); // wait a tick for paint
      bigCard.classList.add('is-revealing');
      playSfx(sfxReveal);
      
      // 3. Wait for it to be seen
      await delay(1200);

      // 4. Animate it out
      bigCard.classList.add('is-hiding');
      
      // 5. While it's hiding, "pop" the grid card
      await delay(250); // Wait for shrink to start
      const gridCard = grid.querySelector(`.reveal-card-static[data-card-name="${cardName}"]`);
      if (gridCard) {
        gridCard.classList.add('pop-in'); // This class now makes it visible
      }

      // 6. Wait for hide animation to finish
      await delay(300); // 500ms total hide time
      bigCard.remove();
      
      // 7. Pause before next card
      await delay(200);
    }
  }

  // --- Navigation ---
  redeemBtn.onclick = () => {
    // Pass email to redeem page
    window.location.href = `redeem.html?email=${encodeURIComponent(userEmail)}`;
  };

})();
