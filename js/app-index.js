// app-index.js
(function() {
  'use strict';

  const config = window.CR_CONFIG;
  if (!config) {
    console.error("CR_CONFIG not loaded!");
    return;
  }

  const CARD_IMAGES = config.cards;
  const stage = document.getElementById('reveal-stage');
  const redeemBtn = document.getElementById('reveal-redeem-btn');
  const loadingMsg = document.getElementById('loading-message');
  const loadingSubtext = document.getElementById('loading-subtext');
  
  let userEmail = "";
  let userIsOverride = false;
  let overrideCards = [];
  const ALL_CARD_NAMES = Object.keys(CARD_IMAGES);

  // --- Webengage Init ---
  if (typeof webengage !== "undefined" && window.ENV.WEBENGAGE_LICENSE_CODE) {
    webengage.init(window.ENV.WEBENGAGE_LICENSE_CODE);
  }

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
        if (typeof webengage !== "undefined") {
          webengage.user.login(userEmail);
        }
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
    if (typeof webengage !== "undefined") {
      webengage.user.login(userEmail);
    }
    return true;
  }

  // --- LEADERBOARD UPDATE ---
  async function updateLeaderboardStats(email, name) {
    if (userIsOverride) {
      console.log("Override user: Skipping leaderboard update.");
      return; // Don't update leaderboard for test users
    }

    try {
      // 1. Get ALL unique cards for this user
      const { data, error } = await supabase
        .from('cards_earned')
        .select('card_name', { count: 'exact', head: false }) // Use head: false
        .eq('customer_email', email);

      if (error) throw error;

      const uniqueCards = [...new Set(data.map(c => c.card_name))];
      const uniqueCardCount = uniqueCards.length;

      // 2. Upsert (insert or update) the customer_stats table
      const { error: upsertError } = await supabase
        .from('customer_stats')
        .upsert(
          { 
            customer_email: email, 
            customer_name: name, 
            unique_cards: uniqueCardCount 
          },
          { onConflict: 'customer_email' }
        );

      if (upsertError) throw upsertError;
      
      console.log(`Leaderboard updated for ${email}: ${uniqueCardCount} cards`);

    } catch (err) {
      console.error("Error updating leaderboard:", err);
    }
  }


  // --- Main Card Reveal Logic ---
  async function startRevealFlow() {
    if (!stage) {
      console.error("#reveal-stage not found");
      return;
    }
    
    loadingSubtext.textContent = "Fetching Your Cards...";

    let revealCards = [];
    let customer_name = userEmail.split('@')[0]; // default
    let order_id = 'N/A'; // default
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
        customer_name = data.customer_name; // Get name
        order_id = data.order.increment_id; // Get order ID
        
        // Set customer name in Webengage
        if (typeof webengage !== "undefined" && customer_name) {
            webengage.user.setAttribute('we_customer_name', customer_name);
        }
        
        revealCards = await window.getCardsFromOrderSkus(data.skus);
        console.log("Cards from segments:", revealCards);

        if (!revealCards.length) {
          throw new Error('No cards associated with the segments in this order.');
        }

        let newCardsEarned = [];
        for (const card of revealCards) {
          let { data: existing, error } = await supabase.from('cards_earned')
            .select('id')
            .eq('customer_email', userEmail)
            .eq('card_name', card)
            .eq('order_id', order_id); 
            
          if (error) console.error("Error checking cards_earned:", error);

          if (!existing || existing.length === 0) {
            console.log(`Granting card ${card} for order ${order_id}`);
            newCardsEarned.push(card);
            await supabase.from('cards_earned').insert({
              customer_email: userEmail,
              card_name: card,
              order_id: order_id,
              earned_at: new Date().toISOString()
            });
          }
        }
        
        // **LEADERBOARD FIX**: Update stats regardless of *new* cards.
        // This fixes the bug where a user with 1 card wasn't showing.
        await updateLeaderboardStats(userEmail, customer_name);
        
        // Send Webengage event only for *newly* earned cards
        if (newCardsEarned.length > 0) {
          if (typeof webengage !== "undefined") {
            webengage.track('pb_cards_earned', {
              email: userEmail,
              order_id: order_id,
              customer_name: customer_name,
              cards: newCardsEarned,
              card_count: newCardsEarned.length
            });
          }
        } else {
          console.log("No new cards earned this order. Showing all cards from this order.");
        }

      } catch (err) {
        console.error("Reveal flow error:", err);
        loadingMsg.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">Could not find eligible cards for this order.<br/>${err.message}</div>`;
        return;
      }
    }

    if (revealCards.length === 0) {
        loadingMsg.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">You didn't earn any cards in this order.</div>`;
        redeemBtn.style.display = "block";
        redeemBtn.style.opacity = "1";
        return;
    }

    // --- NEW: Preload Images ---
    loadingSubtext.textContent = "Preloading Card Art...";
    const imagePromises = revealCards.map(cardName => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = CARD_IMAGES[cardName];
        img.onload = resolve;
        img.onerror = reject;
      });
    });

    try {
      await Promise.all(imagePromises);
    } catch (err) {
      console.error("Failed to preload images", err);
      // Continue anyway, it might just look janky
    }

    loadingMsg.style.display = 'none';

    // 2. Build the 2-column grid
    const grid = document.createElement('div');
    grid.className = "reveal-card-grid";

    let numCards = revealCards.length;
    
    if (numCards === 7) {
      grid.classList.add('seven-cards');
    }

    let otherCards = ALL_CARD_NAMES.filter(c => !revealCards.includes(c));
    let lockCount = 0;
    if (numCards < 8) {
        lockCount = numCards % 2 === 1 ? 1 : 0;
        if (numCards === 1) lockCount = 3; 
    }
    
    let slots = [
        ...revealCards.map(name => ({ name, owned: true })),
        ...new Array(lockCount).fill(0).map((_, i) => ({ 
            name: otherCards[i % otherCards.length],
            owned: false 
        }))
    ];

    for (const slot of slots) {
      let img = document.createElement('img');
      img.className = "reveal-card-static";
      img.src = CARD_IMAGES[slot.name] || config.logo;
      if (slot.owned) {
        img.classList.add('revealed');
        img.dataset.cardName = slot.name; 
      } else {
        img.classList.add('locked');
      }
      grid.appendChild(img);
    }
    stage.appendChild(grid);

    await revealOneByOne(revealCards, grid);
    
    redeemBtn.style.display = "block";
    redeemBtn.style.opacity = "1";
  }

  // Animation sequence
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
      
      await delay(1200); // Hold the big card for 1.2s

      bigCard.classList.add('is-hiding');
      
      await delay(250); 
      const gridCard = grid.querySelector(`.reveal-card-static[data-card-name="${cardName}"]`);
      if (gridCard) {
        gridCard.classList.add('pop-in'); // Pop in the grid card
      }

      await delay(300); 
      bigCard.remove();
      
      await delay(200); // Pause before next card
    }
  }

  // --- Navigation ---
  redeemBtn.onclick = () => {
    window.location.href = `redeem.html?email=${encodeURIComponent(userEmail)}`;
  };

})();
