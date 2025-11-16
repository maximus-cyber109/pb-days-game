// app-redeem.js
(async function() {
  'use strict';

  // --- DOM & Config ---
  const config = window.CR_CONFIG;
  if (!config) {
    console.error("CR_CONFIG not loaded!");
    return;
  }

  const CARD_IMAGES = config.cards;
  const ALL_CARDS = Object.keys(CARD_IMAGES); // 7 cards total
  const TOTAL_CARDS_TO_COLLECT = 7; // Clash of Clans bar is 7

  let userEmail = new URLSearchParams(location.search).get('email');
  let userIsOverride = false;
  let overrideInfo = null;
  let userCards = []; // Array of card names user owns
  let mainTier = "1";

  // --- Audio ---
  const sfxRedeem = document.getElementById('redeem-sfx');
  const sfxPbCash = document.getElementById('pb-cash-sfx');
  const bgMusic = document.getElementById('bg-music');
  try {
    bgMusic.src = config.sounds.bg;
    sfxRedeem.src = config.sounds.redeem;
    sfxPbCash.src = config.sounds.reveal; // Use reveal sfx for cash
  } catch(e) { console.warn("Could not set audio sources", e); }
  
  // Setup interaction unlock for BG music/sfx
  document.body.addEventListener('pointerdown', () => {
    try {
      if (bgMusic.paused) bgMusic.play();
    } catch (e) {
      // console.warn("BG music play failed", e);
    }
  }, { once: true });
  
  function playSfx(sfx) {
    try {
      sfx.currentTime = 0;
      sfx.play();
    } catch (e) {
      // console.warn("Audio play failed", e);
    }
  }

  // --- Utility ---
  function getOverrideTier(email) {
    let match = (email || '').match(/-ovrmaaz(\d(?:-\d)?)/);
    if (match) {
      const t = match[1];
      if (t === "1") return { tier: "1", cardCount: 1 };
      if (t === "2-4") return { tier: "2-4", cardCount: 3 };
      if (t === "5-6") return { tier: "5-6", cardCount: 6 };
      if (t === "7") return { tier: "7", cardCount: 7 };
    }
    return null;
  }
  
  // --- UI Rendering ---

  function renderRockSlider(count) {
    const container = document.getElementById('slider-rocks');
    const innerBar = document.getElementById('coc-progress-inner');
    const text = document.getElementById('slider-text');
    
    if (!container || !innerBar || !text) return;
    
    let out = "";
    for (let i = 0; i < TOTAL_CARDS_TO_COLLECT; ++i) {
      out += `<span class="coc-progress-rock${i < count ? " earned" : ""}"></span>`;
    }
    container.innerHTML = out;
    innerBar.style.width = `${(count / TOTAL_CARDS_TO_COLLECT) * 100}%`;
    text.innerText = `${count}/${TOTAL_CARDS_TO_COLLECT}`;
  }
  
  function renderCardGrid() {
    const colDeck = document.getElementById('col-deck');
    if (!colDeck) return;
    
    colDeck.innerHTML = "";
    // Show first 4 cards, or placeholders
    for (let i = 0; i < 4; ++i) {
      const cardName = ALL_CARDS[i]; // Get card name by index
      let img = document.createElement('img');
      img.className = "reveal-card-static";
      img.src = CARD_IMAGES[cardName] || config.logo;
      
      if (userCards.includes(cardName)) {
        img.classList.add('revealed');
      } else {
        img.classList.add('locked');
      }
      colDeck.appendChild(img);
    }
  }
  
  async function renderRewardGrid() {
    const rewardSection = document.getElementById('reward-section');
    if (!rewardSection) return;
    
    rewardSection.innerHTML = ""; // Clear
    
    // Fetch live rewards for this user's tier
    const rewards = await window.getLiveRewardsByTier(mainTier);
    
    if (!rewards || rewards.length === 0) {
      rewardSection.innerHTML = `<p style="text-align:center; opacity:0.7;">No rewards available for the ${mainTier} card tier.</p>`;
      return;
    }
    
    // Check which rewards user has *already* redeemed
    let { data: redeemedSKUsData } = await supabase.from('rewards_redeemed')
        .select('sku')
        .eq('email', userEmail);
    const redeemedSKUs = redeemedSKUsData ? redeemedSKUsData.map(r => r.sku) : [];
    
    for (let reward of rewards) {
      let c = document.createElement('div');
      c.className = "product-card glow";
      
      let img = document.createElement('img');
      img.className = "product-img";
      img.src = reward.image_url || config.logo;
      img.alt = reward.product_name;
      c.appendChild(img);
      
      let title = document.createElement('div');
      title.className = "product-name";
      title.textContent = reward.product_name;
      c.appendChild(title);
      
      let redeemBtn = document.createElement('button');
      redeemBtn.className = "btn-3d-glass";
      
      if (redeemedSKUs.includes(reward.sku)) {
        redeemBtn.textContent = "Redeemed";
        redeemBtn.disabled = true;
      } else if (reward.remainingqty <= 0) {
        redeemBtn.textContent = "Out of Stock";
        redeemBtn.disabled = true;
      } else {
        redeemBtn.textContent = "Redeem";
        redeemBtn.disabled = false;
      }
      
      redeemBtn.onclick = () => handleRedeemClick(reward, redeemBtn);
      c.appendChild(redeemBtn);
      rewardSection.appendChild(c);
    }
  }
  
  async function renderLeaderboard() {
    const lbContainer = document.getElementById('leaderboard');
    if (!lbContainer) return;
    
    let { data: leaders, error } = await supabase.from('customer_stats')
      .select('customer_email,customer_name,unique_cards')
      .order('unique_cards', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error("Leaderboard error:", error);
      lbContainer.innerHTML = "<p>Leaderboard loading failed.</p>";
      return;
    }

    let lbHtml = (leaders.map((l, i) => `
      <div class="leaderboard-row">
        <span class="leaderboard-rank ${i === 0 ? 'first' : ''}">${i === 0 ? "👑" : i + 1}</span>
        <span class="leaderboard-name">${l.customer_name || l.customer_email.split('@')[0]}</span>
        <span class="leaderboard-score">${l.unique_cards || 0}</span>
      </div>
    `).join(""));
    
    lbContainer.innerHTML = lbHtml;
  }
  
  function renderShopMoreButton() {
    const leaderboardEl = document.getElementById("leaderboard");
    if (!leaderboardEl) return;
    
    const shopMoreBtn = document.createElement('a');
    shopMoreBtn.href = "https://pinkblue.in";
    shopMoreBtn.className = "btn-3d-glass shop-more-btn";
    shopMoreBtn.textContent = "Shop More";
    shopMoreBtn.target = "_blank"; // Open in new tab
    shopMoreBtn.rel = "noopener noreferrer";
    
    // Insert it after the leaderboard
    leaderboardEl.parentNode.insertBefore(shopMoreBtn, leaderboardEl.nextSibling);
  }

  // --- Event Handlers & Logic ---

  async function handleRedeemClick(reward, button) {
    playSfx(sfxRedeem);
    button.textContent = "Checking...";
    button.disabled = true;

    try {
      // Re-check stock in DB (atomic decrement via Supabase function is best, but this is simple check)
      let { data: product, error: fetchError } = await supabase
        .from('reward_products')
        .select('remainingqty')
        .eq('sku', reward.sku)
        .single();

      if (fetchError || product.remainingqty <= 0) {
        button.textContent = "Out of Stock";
        throw new Error("Reward is out of stock.");
      }

      // Decrement stock
      const newQty = product.remainingqty - 1;
      let { error: updateError } = await supabase
        .from('reward_products')
        .update({ remainingqty: newQty })
        .eq('sku', reward.sku);
        
      if (updateError) throw updateError;

      // Log redemption
      let { error: logError } = await supabase
        .from('rewards_redeemed')
        .insert({
          email: userEmail,
          sku: reward.sku,
          product_name: reward.product_name,
          tier: reward.tier,
          reward_time: new Date().toISOString()
        });
        
      if (logError) throw logError;

      button.textContent = "Redeemed!";
      
      // TODO: You might want to lock out other redemptions if user
      // has a limit (e.g., 1 redemption per tier)

    } catch (err) {
      console.error("Redemption failed:", err.message);
      if (button.textContent !== "Out of Stock") {
        button.textContent = "Error! Try Again";
        button.disabled = false; // Allow retry
      }
    }
  }

  function setupGalleryModal() {
    const modal = document.getElementById('gallery-modal');
    const cardImg = document.getElementById('gallery-card-img');
    const cardNameEl = document.getElementById('gallery-card-name');
    let galleryIdx = 0;

    function updateGallery(idx) {
      let cardName = ALL_CARDS[idx];
      cardImg.src = CARD_IMAGES[cardName];
      cardNameEl.innerText = cardName.replace(/-/g, " ");
      
      if (userCards.includes(cardName)) {
        cardImg.className = "gallery-card-img revealed";
      } else {
        cardImg.className = "gallery-card-img locked";
      }
    }

    document.getElementById('open-gallery').onclick = function() {
      galleryIdx = userCards.length ? ALL_CARDS.indexOf(userCards[0]) : 0;
      if (galleryIdx === -1) galleryIdx = 0;
      updateGallery(galleryIdx);
      modal.classList.add('show');
    }
    document.getElementById('gallery-left').onclick = function() {
      galleryIdx = (galleryIdx + ALL_CARDS.length - 1) % ALL_CARDS.length;
      updateGallery(galleryIdx);
    }
    document.getElementById('gallery-right').onclick = function() {
      galleryIdx = (galleryIdx + 1) % ALL_CARDS.length;
      updateGallery(galleryIdx);
    }
    document.getElementById('gallery-close').onclick = function() {
      modal.classList.remove('show');
    }
  }
  
  async function setupPbCashModal() {
    const showBtn = document.getElementById('show-pb-cash');
    const modal = document.getElementById('pb-cash-modal');
    const textEl = document.getElementById('pb-cash-text');
    const claimBtn = document.getElementById('pb-cash-claim');
    
    let pbCashAmount = 0;
    
    // Check eligibility (Tier 1 only)
    if (mainTier !== '1') {
      showBtn.style.display = 'none';
      return;
    }
    
    // Check if already claimed
    let { data: claimed, error } = await supabase.from('pb_cash')
      .select('id')
      .eq('email', userEmail);
      
    if (claimed && claimed.length > 0) {
      showBtn.textContent = "PB Cash Claimed";
      showBtn.disabled = true;
      showBtn.style.display = 'block';
      showBtn.style.opacity = 0.7;
      return;
    }
    
    // Calculate amount
    if (userIsOverride) {
      pbCashAmount = 40; // Override amount
    } else {
      // Fetch user's order to calculate
      let { data: orderData } = await fetch('/.netlify/functions/magento-fetch', {
        method: "POST", body: JSON.stringify({ email: userEmail }), headers: { 'Content-Type': 'application/json' }
      }).then(res => res.json());
      
      if (orderData.success && orderData.order.items) {
         // Need product prices from products_ordered
         let { data: prods } = await supabase.from('products_ordered')
           .select('p_code, product_price')
           .in('p_code', orderData.order.items.map(i => i.sku));
           
         if (prods) {
           pbCashAmount = window.calculatePbCash(prods);
         }
      }
    }
    
    if (pbCashAmount <= 0) {
      showBtn.style.display = 'none';
      return;
    }
    
    // Eligible and not claimed
    showBtn.style.display = 'block';
    
    showBtn.onclick = function() {
      textEl.innerText = `You earned PB CASH: ₹${pbCashAmount || '0'}`;
      modal.classList.add('show');
    }
    
    claimBtn.onclick = async function() {
      playSfx(sfxPbCash);
      claimBtn.disabled = true;
      claimBtn.textContent = "Claiming...";
      
      let { error } = await supabase.from('pb_cash').insert({ 
        email: userEmail, 
        amount: pbCashAmount, 
        reward_time: new Date().toISOString() 
      });
      
      if (error) {
        console.error("PB Cash claim error:", error);
        claimBtn.textContent = "Error! Try Again";
        claimBtn.disabled = false;
      } else {
        claimBtn.textContent = "Claimed!";
        modal.classList.remove('show');
        showBtn.textContent = "PB Cash Claimed";
        showBtn.disabled = true;
        showBtn.style.opacity = 0.7;
      }
    }
    
    document.getElementById('pb-cash-close').onclick = function() {
      modal.classList.remove('show');
    }
  }

  // --- Main Execution ---
  async function mainRedeem() {
    if (!userEmail) {
      document.body.innerHTML = `<div class="pb-cash-text" style="padding-top: 100px; text-align:center;">No email provided. Please go back to the reveal page.</div>`;
      return;
    }

    initSupabase(); // Ensure Supabase is ready
    
    overrideInfo = getOverrideTier(userEmail);
    userIsOverride = !!overrideInfo;

    // 1. Fetch user's cards
    if (userIsOverride) {
      userCards = ALL_CARDS.slice(0, overrideInfo.cardCount);
    } else {
      let { data: earned, error } = await supabase.from('cards_earned')
        .select('card_name')
        .eq('customer_email', userEmail);
      
      if (error) {
        console.error("Error fetching user cards:", error);
        // Handle error
        return;
      }
      // Get unique card names
      userCards = [...new Set(earned.map(c => c.card_name))];
    }
    
    console.log("User owns cards:", userCards);

    // 2. Determine user's tier
    const cardCount = userCards.length;
    mainTier =  (cardCount === 1) ? '1'
            : (cardCount >= 2 && cardCount <= 4) ? '2-4'
            : (cardCount >= 5 && cardCount <= 6) ? '5-6'
            : (cardCount === 7) ? '7' : '1'; // Default to 1
    
    console.log(`User tier: ${mainTier} (${cardCount} cards)`);

    // 3. Render all UI components
    renderRockSlider(cardCount);
    renderCardGrid();
    setupGalleryModal();
    
    // These are async and will populate when ready
    await renderRewardGrid();
    await renderLeaderboard();
    await setupPbCashModal();
    
    renderShopMoreButton();

  } // end mainRedeem

  // Run!
  mainRedeem();

})();
