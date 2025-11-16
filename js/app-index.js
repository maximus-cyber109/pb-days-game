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
  const stage = document.getElementById('reveal-stage');
  const redeemBtn = document.getElementById('reveal-redeem-btn');
  // All audio elements and logic removed

  let userEmail = "";
  let userIsOverride = false;
  let overrideCards = [];
  const ALL_CARD_NAMES = Object.keys(CARD_IMAGES);

  // --- Audio Handling (REMOVED) ---

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

    // 2. Build the 2-column grid
    stage.innerHTML = ''; // Clear stage
    const grid = document.createElement('div');
    grid.className = "reveal-card-grid";

    let numCards = revealCards.length;
    
    // ADDED: Special class to center the 7th card
    if (numCards === 7) {
      grid.classList.add('seven-cards');
    }

    // Determine number of locked cards to show (to make an even 2-column grid)
    let otherCards = ALL_CARD_NAMES.filter(c => !revealCards.includes(c));
    let lockCount = 0;
    if (numCards < 8) {
        // If 7 cards, add 1 lock. If 5, add 1 lock. If 3, add 1 lock.
        lockCount = numCards % 2 === 1 ? 1 : 0;
        // Exception: if 1 card, show 3 locks to make a 2x2 grid
        if (numCards === 1) lockCount = 3; 
    }
    
    // Create slots array
    let slots = [
        ...revealCards.map(name => ({ name, owned: true })),
        ...new Array(lockCount).fill(0).map((_, i) => ({ 
            name: otherCards[i % otherCards.length], // Use fallback locked cards
            owned: false 
        }))
    ];

    // Create image elements from the slots array
    for (const slot of slots) {
      let img = document.createElement('img');
      img.className = "reveal-card-static";
      img.src = CARD_IMAGES[slot.name] || config.logo;
      if (slot.owned) {
        img.classList.add('revealed');
        img.dataset.cardName = slot.name; // Tag revealed cards
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
      
      const bigCard = document.createElement('img');
      bigCard.className = "reveal-card-big";
      bigCard.src = CARD_IMAGES[cardName] || "";
      stage.appendChild(bigCard);

      await delay(50); 
      bigCard.classList.add('is-revealing');
      // playSfx(sfxReveal); // REMOVED
      
      await delay(1200);

      bigCard.classList.add('is-hiding');
      
      await delay(250); 
      const gridCard = grid.querySelector(`.reveal-card-static[data-card-name="${cardName}"]`);
      if (gridCard) {
        gridCard.classList.add('pop-in'); // This class now makes it visible
      }

      await delay(300); 
      bigCard.remove();
      
      await delay(200);
    }
  }

  // --- Navigation ---
  redeemBtn.onclick = () => {
    window.location.href = `redeem.html?email=${encodeURIComponent(userEmail)}`;
  };

})();
