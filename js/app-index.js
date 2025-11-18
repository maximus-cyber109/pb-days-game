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
  const ALL_CARD_NAMES = Object.keys(CARD_IMAGES);
  let currentOrderId = 'N/A'; 
  let customerName = "";

  initSupabase();
  if (emailCheck()) {
    startRevealFlow();
  }

  // --- UPDATED TIER LOGIC: 1, 2-3, 4-6, 7 ---
  function getOverrideTier(email) {
    if (!email) return null;
    let match = email.match(/-ovrmaaz(\d(?:-\d)?)/);
    if (match) {
      const t = match[1];
      if (t === "1") return { tier: "1", numCards: 1 };
      if (t === "2-3") return { tier: "2-3", numCards: 3 }; 
      if (t === "4-6") return { tier: "4-6", numCards: 6 }; 
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

  async function updateLeaderboardStats(email, name) {
    if (userIsOverride) return;
    try {
      const { data, error } = await window.supabaseClient
        .from('cards_earned')
        .select('card_name', { count: 'exact', head: false })
        .eq('customer_email', email);
      if (error) throw error;

      const uniqueCards = [...new Set(data.map(c => c.card_name))];
      const uniqueCardCount = uniqueCards.length;

      const { error: upsertError } = await window.supabaseClient
        .from('customer_stats')
        .upsert(
          { customer_email: email, customer_name: name, unique_cards: uniqueCardCount },
          { onConflict: 'customer_email' }
        );
      if (upsertError) throw upsertError;
    } catch (err) {
      console.error("Error updating leaderboard:", err);
    }
  }

  async function startRevealFlow() {
    if (!stage) return;
    
    loadingMsg.style.display = 'block';
    loadingSubtext.textContent = "Fetching Your Cards...";

    let cardsToReveal = []; 
    let customer_name = userEmail.split('@')[0];
    let override = getOverrideTier(userEmail);
    userIsOverride = !!override;

    if (userIsOverride) {
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
        
        if (!res.ok) throw new Error(`Magento fetch failed`);
        
        let data = await res.json();
        if (!data.success || !data.order || !data.order.items) {
          throw new Error(data.error || 'No order items found.');
        }

        // --- NEW: Check if Order is already Processed ---
        currentOrderId = data.order.increment_id;
        
        const { data: existingOrderCards } = await window.supabaseClient
            .from('cards_earned')
            .select('id')
            .eq('order_id', currentOrderId)
            .limit(1);

        if (existingOrderCards && existingOrderCards.length > 0) {
            console.log("Order already processed. Redirecting...");
            loadingSubtext.textContent = "Order already processed! Redirecting...";
            setTimeout(() => {
                window.location.href = `redeem.html?email=${encodeURIComponent(userEmail)}`;
            }, 1000);
            return;
        }
        // ------------------------------------------------

        console.log("Order Items:", data.order.items);
        customer_name = data.customer_name;
        customerName = data.customer_name; 
        
        cardsToReveal = await window.getCardsFromOrderSkus(data.order.items);
        console.log("Qualified Cards:", cardsToReveal);

        if (cardsToReveal.length > 0) {
            const { data: existingCardsData } = await window.supabaseClient
                .from('cards_earned')
                .select('card_name')
                .eq('customer_email', userEmail)
                .in('card_name', cardsToReveal);
            
            const existingCardNames = new Set(existingCardsData.map(c => c.card_name));
            const newCardsToInsert = cardsToReveal.filter(cardName => !existingCardNames.has(cardName));

            // NOTE: We insert ALL cards earned in this order to 'cards_earned'
            // so the duplicate order check works, even if the user already owns the card types.
            // But we usually only want to track unique *types* for leaderboard.
            // For the "Order Check" to work, we must insert rows for this order.
            
            let cardsToInsert = cardsToReveal.map(cardName => ({
                customer_email: userEmail,
                card_name: cardName,
                order_id: currentOrderId
            }));
            
            if (cardsToInsert.length > 0) {
                await window.supabaseClient.from('cards_earned').insert(cardsToInsert);
            }
            await updateLeaderboardStats(userEmail, customer_name);
        }

      } catch (err) {
        console.error("Reveal flow error:", err);
        loadingMsg.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">Could not find eligible cards.<br/>${err.message}</div>`;
        return;
      }
    }

    if (cardsToReveal.length === 0) {
        loadingMsg.innerHTML = `<div class="pb-cash-text" style="margin-top:100px;">You didn't earn any new cards in this order.<br><span style="font-size:0.6em">Total spend per segment must be > ₹1000.</span></div>`;
        redeemBtn.style.display = "block";
        redeemBtn.style.opacity = "1";
        return;
    }

    loadingSubtext.textContent = "Get Ready For Your Rewards!";
    const imagePromises = cardsToReveal.map(cardName => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = CARD_IMAGES[cardName];
        img.onload = resolve;
        img.onerror = resolve;
      });
    });
    
    try { await Promise.all(imagePromises); } catch (err) {}
    loadingMsg.style.display = 'none';

    const grid = document.createElement('div');
    grid.className = "reveal-card-grid";
    grid.classList.add(`count-${cardsToReveal.length}`);
    
    let slots = cardsToReveal.map(name => ({ name, owned: true }));

    for (const slot of slots) {
      let img = new Image(); 
      img.className = "reveal-card-static";
      img.src = CARD_IMAGES[slot.name] || config.logo;
      if (slot.owned) {
        img.classList.add('revealed');
        img.dataset.cardName = slot.name; 
      }
      grid.appendChild(img);
    }
    stage.appendChild(grid);

    await revealOneByOne(cardsToReveal, grid);
    
    fetch('/.netlify/functions/send-card-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, customerName: customerName })
    }).catch(err => console.error("Event error:", err));

    redeemBtn.style.display = "block";
    redeemBtn.style.opacity = "1";
  }

  async function revealOneByOne(uniqueCards, grid) {
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    for (let i = 0; i < uniqueCards.length; i++) {
      const cardName = uniqueCards[i];
      const bigCard = new Image(); 
      bigCard.className = "reveal-card-big";
      bigCard.src = CARD_IMAGES[cardName] || "";
      stage.appendChild(bigCard);
      
      await delay(50); 
      bigCard.classList.add('is-revealing');
      await delay(1200); 
      bigCard.classList.add('is-hiding');
      await delay(250); 
      
      const gridCard = grid.querySelector(`.reveal-card-static[data-card-name="${cardName}"]`);
      if (gridCard) gridCard.classList.add('pop-in');
      
      await delay(300); 
      bigCard.remove();
      await delay(200); 
    }
  }

  redeemBtn.onclick = () => {
    window.location.href = `redeem.html?email=${encodeURIComponent(userEmail)}`;
  };
})();
