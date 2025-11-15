const config = window.CR_CONFIG;
const CARD_IMAGES = config.cards;
const emailBox = document.getElementById('email-card-box');
const emailInput = document.getElementById('email-input');
const form = document.getElementById('email-form');
const deckElem = document.getElementById('cr-card-deck');
const loadingDiv = document.getElementById('loading-cards');
const sfxReveal = document.getElementById('reveal-sfx');
const sfxRare = document.getElementById('rare-sfx');
const bgMusic = document.getElementById('bg-music');
const logoImg = document.getElementById('logo-main');
let userEmail;

// Set logo/sounds from config
logoImg.src = config.logo;
bgMusic.src = config.sounds.bg;
sfxReveal.src = config.sounds.reveal;
sfxRare.src = config.sounds.rare;

let interactionHappened = false;
document.body.addEventListener('pointerdown', () => {
  interactionHappened = true;
  try { bgMusic.play(); } catch {}
}, {once: true});

function finishEmail(email) {
  userEmail = email.toLowerCase().trim();
  history.replaceState({}, '', "?email=" + encodeURIComponent(userEmail));
  emailBox.style.display = 'none';
  startRevealFlow();
}

function emailCheck() {
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get("email");
  if (!email) {
    emailBox.style.display = "flex";
    emailInput.value = "";
    emailInput.focus();
    form.onsubmit = function (e) {
      e.preventDefault();
      finishEmail(emailInput.value);
    };
    return false;
  }
  userEmail = email.toLowerCase();
  emailBox.style.display = "none";
  return true;
}
emailCheck();

async function startRevealFlow() {
  loadingDiv.style.display = "";
  deckElem.innerHTML = "";

  initSupabase();
  if (!window.supabase) {
    loadingDiv.innerHTML = "<span style='color:#95240e;'>Could not connect.<br/>Try in a moment.</span>";
    return;
  }

  let order, skus;
  try {
    let res = await fetch('/.netlify/functions/magento-fetch', {
      method: "POST",
      body: JSON.stringify({ email: userEmail }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      throw new
