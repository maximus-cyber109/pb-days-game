let soundManager = null;

function initSounds() {
  if (!window.Howl || soundManager) return;
  
  try {
    soundManager = {
      cardFlip: new Howl({ src: [CONFIG.SOUNDS.cardFlip], volume: 0.7 }),
      revealRare: new Howl({ src: [CONFIG.SOUNDS.revealRare], volume: 0.8 }),
      victory: new Howl({ src: [CONFIG.SOUNDS.victory], volume: 0.6 }),
      muted: false,
      
      toggleMute: function() {
        this.muted = !this.muted;
        Object.keys(this).forEach(key => {
          if (this[key] && typeof this[key].mute === 'function') {
            this[key].mute(this.muted);
          }
        });
      }
    };
  } catch (error) {
    console.warn('Sound initialization failed:', error);
  }
}

function animateCardReveal(cardElement, isRare, delay = 0) {
  setTimeout(() => {
    if (soundManager && !soundManager.muted) {
      soundManager.cardFlip.play();
    }

    anime({
      targets: cardElement,
      rotateY: [0, 180],
      duration: 600,
      easing: 'easeInOutQuad',
      complete: () => {
        cardElement.classList.add('flipped');
        
        if (soundManager && !soundManager.muted && isRare) {
          soundManager.revealRare.play();
        }

        if (isRare) {
          anime({
            targets: cardElement.querySelector('.card-front'),
            boxShadow: [
              '0 0 20px rgba(251, 191, 36, 0.5)',
              '0 0 40px rgba(251, 191, 36, 0.9)',
              '0 0 20px rgba(251, 191, 36, 0.5)'
            ],
            duration: 2000,
            loop: true,
            easing: 'easeInOutSine'
          });
        }
      }
    });

    anime({
      targets: cardElement,
      scale: [0.5, 1],
      opacity: [0, 1],
      duration: 500,
      easing: 'easeOutElastic(1, .5)'
    });

  }, delay);
}

function revealAllCards(cards, containerElement) {
  cards.forEach((card, index) => {
    const cardEl = createCardElement(card);
    containerElement.appendChild(cardEl);
    animateCardReveal(cardEl, card.isRare, index * 1500);
  });

  if (soundManager && !soundManager.muted && cards.length > 0) {
    setTimeout(() => {
      soundManager.victory.play();
    }, cards.length * 1500 + 1000);
  }
}

// Updated to use GitHub URLs
function createCardElement(card) {
  const cardDiv = document.createElement('div');
  cardDiv.className = 'card';
  
  // Get image URLs from GitHub
  const cardImageUrl = `${CONFIG.cardImagesBaseUrl}/${card.cardName}.png`;
  const cardBackUrl = CONFIG.cardBackUrl;
  
  cardDiv.innerHTML = `
    <div class="card-inner">
      <div class="card-back">
        <img src="${cardBackUrl}" alt="Card Back" onerror="this.src='https://via.placeholder.com/300x420/1f2937/ffffff?text=Card+Back'">
      </div>
      <div class="card-front">
        <img src="${cardImageUrl}" alt="${card.cardName}" onerror="this.src='https://via.placeholder.com/300x420/6366f1/ffffff?text=${card.cardName}'">
        ${card.isRare ? '<span class="rare-badge">⭐ RARE</span>' : ''}
        <div class="card-name">${card.cardName}</div>
      </div>
    </div>
  `;
  return cardDiv;
}
