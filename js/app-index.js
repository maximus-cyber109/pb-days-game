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
  let currentOrderId = 'N/A'; // Store the order ID for logging
  let customerName = ""; // Store customer name

  // --- Initialization ---
  initSupabase();
  if (emailCheck()) {
    // Start the flow automatically
    startRevealFlow();
  }

  // --- Email & Auth ---
  function getOverrideTier(email) {
    if (!email) return null;
    let match = email.match(/-ovrmaaz(\d(?:-\d)?)/);
    if (match) {
      const t = match[1];
      if (t === "1") return { tier: "1", numCards: 1 };
      if (t === "2-4") return { tier: "2-4", numCards: 3 };
      if (t === "5-6") return { tier: "5-6", numCards: 5 }; // 5-card test
      if (t === "7") return { tier: "7", numCards: 7 }; // 7-card test
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
        // Start the flow
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

  // --- LEADERBOARD UPDATE ---
  async function updateLeaderboardStats(email, name) {
    if (userIsOverride) {
      console.log("Override user: Skipping leaderboard update.");
      return;
    }
    try {
      // 1. Get ALL unique cards for this user
      const { data, error } = await window.supabaseClient
        .from('cards_earned')
        .select('card_name', { count: 'exact', head: false })
        .eq('customer_email', email);
        
      if (error) throw error;

      const uniqueCards = [...new Set(data.map(c => c.card_name))];
      const uniqueCardCount = uniqueCards.length;

      // 2. Upsert (insert or update) the customer_stats table
      const { error: upsertError } = await window.supabaseClient
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
      console.log(`Leaderboard updated for ${email}: ${uniqueCardCount} unique cards`);
    } catch (err) {
      console.error("Error updating leaderboard:", err);
    }
  }


  // --- Main Card Reveal Logic ---
  async function startRevealFlow() {
    if (!stage) return;
    
    // 1. Show "Thank you" and "Fetching"
    loadingMsg.style.display = 'block';
    loadingSubtext.textContent = "Fetching Your Cards...";

    let cardsToReveal = []; // *Unique* cards from *this order*
    let customer_name = userEmail.split('@')[0];
    let override = getOverrideTier(userEmail);
    userIsOverride = !!override;

    if (userIsOverride) {
      console.log("Using override:", override);
      cardsToReveal = ALL_CARD_NAMES.slice(0, override.numCards);
      currentOrderId = `TEST_${Date.now()}`;
      customerName = "Test User";

    } else {
      console.log("Fetching cards for:", userEmail);
      try {
        let res = await fetch('/.netlify/functions/magento-fetch', {
          method: "POST",
          body: JSON.stringify({ email: userEmail }),
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || `Magento fetch failed: ${res.statusText}`);
        }
        
        let data = await res.json();
        if (!data.success || !data.order || !data.skus.length) {
          throw new Error(data.error || 'No eligible SKUs found for this order.');
        }

        console.log("Order SKUs:", data.skus);
        customer_name = data.customer_name;
        customerName = data.customer_name; // Save for event
        currentOrderId = data.order.increment_id;
        
        cardsToReveal = await window.getCardsFromOrderSkus(data.skus);
        console.log("Cards from segments (unique):", cardsToReveal);

        if (!cardsToReveal.length) {
          throw new Error('No new cards associated with the segments in this order.');
        }

        // Check which of these cards are *truly* new for the user
        const { data: existingCardsData } = await window.supabaseClient
          .from('cards_earned')
          .select('card_name')
          .eq('customer_email', userEmail)
          .in('card_name', cardsToReveal);
        
        const existingCardNames = new Set(existingCardsData.map(c => c.card_name));
        const newCardsToInsert = cardsToReveal.filter(cardName => !existingCardNames.has(cardName));

        let cardsToInsert = newCardsToInsert.map(cardName => ({
            customer_email: userEmail,
            card_name: cardName,
            order_id: currentOrderId
        }));
        
        if (cardsToInsert.length > 0) {
            const { error: insertError } = await window.supabaseClient
                .from('cards_earned')
                .insert(cardsToInsert);
            if (insertError) throw insertError;
            console.log(`Inserted ${cardsToInsert.length} new cards into cards_earned.`);
        } else {
            console.log("No new unique cards to insert for this order.");
        }

        // Update leaderboard based on user's *total* unique card count
        await updateLeaderboardStats(userEmail, customer_name);

      } catch (err) {
        console.error("Reveal flow error:", err);
        loadingMsg.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">Could not find eligible cards for this order.<br/>${err.message}</div>`;
        return;
      }
    }

    if (cardsToReveal.length === 0) {
        loadingMsg.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">You didn't earn any new cards in this order.</div>`;
        redeemBtn.style.display = "block";
        redeemBtn.style.opacity = "1";
        return;
    }

    // --- Preload Images ---
    loadingSubtext.textContent = "Get Ready For Your Rewards!";
    const imagePromises = cardsToReveal.map(cardName => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = CARD_IMAGES[cardName];
        img.onload = resolve;
        img.onerror = () => {
            console.warn(`Failed to preload ${cardName}, resolving anyway`);
            resolve(); // Don't block reveal for one broken image
        };
      });
    });
    
    try { await Promise.all(imagePromises); } catch (err) { console.error("Failed to preload images", err); }
    loadingMsg.style.display = 'none';

    // 2. Build the 2x2 grid
    const grid = document.createElement('div');
    grid.className = "reveal-card-grid";
    // Add count-X class for styling 5th/7th card
    grid.classList.add(`count-${cardsToReveal.length}`);
    
    // Create slots for the cards just earned
    let slots = cardsToReveal.map(name => ({ name, owned: true }));

    for (const slot of slots) {
      let img = new Image(); // Use Image constructor for better loading
      img.className = "reveal-card-static";
      img.src = CARD_IMAGES[slot.name] || config.logo;
      if (slot.owned) {
        img.classList.add('revealed');
        img.dataset.cardName = slot.name; 
      }
      grid.appendChild(img);
    }
    stage.appendChild(grid);

    // 3. Start Animation
    await revealOneByOne(cardsToReveal, grid);
    
    // 4. Send Webengage event *after* everything is done
    // Fire-and-forget
    fetch('/.netlify/functions/send-card-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: userEmail,
        customerName: customerName
      })
    }).catch(err => console.error("Fire-and-forget send-card-event failed:", err));

    // 5. Show Redeem Button
    redeemBtn.style.display = "block";
    redeemBtn.style.opacity = "1";
  }

  // Animation sequence
  async function revealOneByOne(uniqueCards, grid) {
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    for (let i = 0; i < uniqueCards.length; i++) {
      const cardName = uniqueCards[i];
      const bigCard = new Image(); // Use Image constructor
      bigCard.className = "reveal-card-big";
      bigCard.src = CARD_IMAGES[cardName] || "";
      stage.appendChild(bigCard);
      
      await delay(50); 
      bigCard.classList.add('is-revealing');
      
      await delay(1200); // Hold the big card
      
      bigCard.classList.add('is-hiding');
      await delay(250); // Wait for shrink
      
      const gridCard = grid.querySelector(`.reveal-card-static[data-card-name="${cardName}"]`);
      if (gridCard) {
        gridCard.classList.add('pop-in');
      }
      
      await delay(300); // Wait for pop-in
      bigCard.remove();
      await delay(200); // Pause before next card
    }
  }

  // --- Navigation ---
  redeemBtn.onclick = () => {
    window.location.href = `redeem.html?email=${encodeURIComponent(userEmail)}`;
  };

})();
