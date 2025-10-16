// Kartenränge und -farben
const suits = ["S", "H", "D", "C"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const soundPlayCard = new Audio("assets/sounds/play-card.mp3");
let deck = [];
let playerNests = [[], [], []];
let botNests = [[], [], []];
let drawnCards = [];
let discardPile = []; // Ablagestapel
let gameOver = false;

// Startkarten für Auswahl
const startCardsData = [
  { rank: "A", suit: "S" }, { rank: "Q", suit: "S" }, { rank: "K", suit: "S" },
  { rank: "J", suit: "D" }, { rank: "K", suit: "D" }, { rank: "Q", suit: "H" }, { rank: "K", suit: "H" }
];
const startCards = startCardsData.map(c => ({ ...c, image: `assets/cards/${c.rank}${c.suit}.png` }));

// --- Setup ---
window.onload = () => {
  // --- Kartenbilder in Cache laden ---
  preloadCards();

  // Alles außer Startscreen ausblenden
  document.getElementById("game").style.display = "none";

  showStartScreen();

  // Drag & Drop auf Ablagestapel aktivieren
  const discardEl = document.getElementById("discard-pile");
  discardEl.addEventListener("dragover", e => e.preventDefault());
  discardEl.addEventListener("drop", e => handleDiscardDrop(e));
};

// --- Funktion zum Preload aller Karten ---
function preloadCards() {
  const images = [];
  
  // Standardkarten
  for (let suit of suits) {
    for (let rank of ranks) {
      const img = new Image();
      img.src = `assets/cards/${rank}${suit}.png`;
      images.push(img);
    }
  }

  // Joker
  const joker1 = new Image();
  joker1.src = "assets/cards/JOKER1.png";
  images.push(joker1);

  const joker2 = new Image();
  joker2.src = "assets/cards/JOKER2.png";
  images.push(joker2);
}


// === Startscreen anzeigen ===
function showStartScreen() {
  const screen = document.getElementById("start-screen");
  const container = document.getElementById("start-cards");
  container.innerHTML = "";

  startCards.forEach(card => {
    const img = document.createElement("img");
    img.src = card.image;
    img.className = "card selectable";
    img.dataset.selected = "false";

    img.addEventListener("click", () => {
      if (img.dataset.selected === "true") {
        img.dataset.selected = "false";
        img.style.border = "";
      } else {
        img.dataset.selected = "true";
        img.style.border = "3px solid #f4a261";
      }
    });

    container.appendChild(img);
  });

  document.getElementById("start-game-btn").onclick = () => startGameFromSelection();
}

// === Startkarten übernehmen ===
function startGameFromSelection() {
  const selectedImages = document.querySelectorAll("#start-cards img[data-selected='true']");
  const selectedCards = [];

  // Auswahl ermitteln
  selectedImages.forEach(img => {
    const filename = img.src.split("/").pop().replace(".png", "");
    const card = startCards.find(c => `${c.rank}${c.suit}` === filename);
    if (card) selectedCards.push(card);
  });

  // --- Spieler bekommt gewählte Karten – nach Farbe auf bestimmte Nester ---
  for (let card of selectedCards) {
    let targetIndex = 0;
    if (card.suit === "D") targetIndex = 1; // Karo → Nest 2
    else if (card.suit === "H") targetIndex = 2; // Herz → Nest 3
    // Pik (S) & Kreuz (C) → Nest 1

    playerNests[targetIndex].push(card);
  }

  // --- Bot bekommt die übrigen Karten – gleiche Logik ---
  const selectedKeys = selectedCards.map(c => `${c.rank}${c.suit}`);
  const botCards = startCards.filter(c => !selectedKeys.includes(`${c.rank}${c.suit}`));

  for (let card of botCards) {
    let targetIndex = 0;
    if (card.suit === "D") targetIndex = 1;
    else if (card.suit === "H") targetIndex = 2;
    // Pik (S) & Kreuz (C) → Nest 1

    botNests[targetIndex].push(card);
  }

  // --- Startscreen ausblenden, Spiel anzeigen ---
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("game").style.display = "block";
  document.getElementById("game-container").style.display = "flex";
  document.getElementById("controls").style.display = "block";

  // --- Spielfeld rendern und Spiel starten ---
  renderNests();
  initGame();
}



// --- Deck erstellen ---
function createDeck() {
  let d = [];
  for (let suit of suits) {
    for (let rank of ranks) {
      d.push({ suit, rank, image: `assets/cards/${rank}${suit}.png` });
    }
  }
  d.push({ suit: "JOKER", rank: "JOKER", image: "assets/cards/JOKER1.png" });
  d.push({ suit: "JOKER", rank: "JOKER", image: "assets/cards/JOKER2.png" });
  return shuffle(d);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function initGame() {
  deck = createDeck();

  // --- Startkarten aus dem Deck entfernen ---
  const startKeys = startCards.map(c => `${c.rank}${c.suit}`);
  deck = deck.filter(c => !startKeys.includes(`${c.rank}${c.suit}`));

  discardPile = [];
  updateDeckCount();
  renderNests();
  renderDiscardPile();
  document.getElementById("score-display").textContent = "";
  nextTurn();
}


// --- Nächster Spielzug ---
function nextTurn() {
  if (gameOver) return;
  if (deck.length < 2) {
    endGame();
    return;
  }

  drawnCards = [deck.pop(), deck.pop()];
  updateDeckCount();
  renderDrawnCards();
}

// --- Nester prüfen und Karte legen ---
function placeCardOnNests(card, nests) {
  for (let nest of nests) {
    if (nest.length === 0) continue;
    const top = nest[nest.length - 1];
    if (canPlaceCard(card, top)) {
      nest.push(card);
      return true;
    }
  }
  return false;
}

function tryStartNewNest(card, nests) {
  for (let nest of nests) {
    if (nest.length === 0) {
      nest.push(card);
      return true;
    }
  }
  return false;
}

function canPlaceCard(card, topCard) {
  if (!topCard) return true;
  if (card.suit === "JOKER" || topCard.suit === "JOKER") return true;
  return card.suit === topCard.suit || card.rank === topCard.rank;
}

// --- Nester darstellen ---
function renderNests() {
  const playerDiv = document.getElementById("player-nests");
  const botDiv = document.getElementById("bot-nests");
  playerDiv.innerHTML = "";
  botDiv.innerHTML = "";

  playerNests.forEach(nest => {
    const nestEl = document.createElement("div");
    nestEl.className = nest.length === 0 ? "nest empty" : "nest";

    if (nest.length > 0) {
      const topCard = nest[nest.length - 1];
      const img = document.createElement("img");
      img.src = topCard.image;
      img.className = "card";
      nestEl.appendChild(img);

      const countEl = document.createElement("div");
      countEl.className = "nest-count";
      countEl.textContent = nest.length;
      nestEl.appendChild(countEl);
    }

    nestEl.addEventListener("dragover", e => e.preventDefault());
    nestEl.addEventListener("drop", e => handlePlayerDrop(e, nest));

    playerDiv.appendChild(nestEl);
  });

  botNests.forEach(nest => {
    const nestEl = document.createElement("div");
    nestEl.className = nest.length === 0 ? "nest empty" : "nest";

    if (nest.length > 0) {
      const topCard = nest[nest.length - 1];
      const img = document.createElement("img");
      img.src = topCard.image;
      img.className = "card bot-card";
      nestEl.appendChild(img);

      const countEl = document.createElement("div");
      countEl.className = "nest-count";
      countEl.textContent = nest.length;
      nestEl.appendChild(countEl);
    }

    botDiv.appendChild(nestEl);
  });
}

// --- Ablagestapel darstellen ---
function renderDiscardPile() {
  const pileEl = document.getElementById("discard-pile");
  pileEl.innerHTML = "";

  if (discardPile.length > 0) {
    const img = document.createElement("img");
    img.src = discardPile[discardPile.length - 1].image;
    img.className = "card";
    pileEl.appendChild(img);
    pileEl.classList.remove("empty");
  } else {
    pileEl.classList.add("empty");
  }

  const countEl = document.createElement("div");
  countEl.className = "nest-count";
  countEl.textContent = discardPile.length;
  pileEl.appendChild(countEl);
}

// --- Gezogene Karten anzeigen ---
function renderDrawnCards() {
  const area = document.getElementById("drawn-cards");
  area.innerHTML = "";

  drawnCards.forEach(card => {
    const img = document.createElement("img");
    img.src = card.image;
    img.className = "card";
    img.draggable = true;

    img.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", JSON.stringify(card));
    });

    area.appendChild(img);
  });
}

// --- Spieler drop Logik auf Nest ---
function handlePlayerDrop(e, nest) {
  e.preventDefault();
  const cardData = JSON.parse(e.dataTransfer.getData("text/plain"));
  const topCard = nest[nest.length - 1];

  if (!canPlaceCard(cardData, topCard)) {
    alert("Die Karte passt nicht auf dieses Nest!");
    return;
  }

  nest.push(cardData);

  // --- Sound abspielen ---
  soundPlayCard.currentTime = 0;
  soundPlayCard.play();

  handleBotCard(cardData);

  drawnCards = [];
  renderNests();
  renderDrawnCards();
  renderDiscardPile();

  setTimeout(nextTurn, 500);
}

// --- Spieler drop Logik auf Ablagestapel ---
function handleDiscardDrop(e) {
  e.preventDefault();
  const cardData = JSON.parse(e.dataTransfer.getData("text/plain"));
  discardPile.push(cardData);

  // --- Sound abspielen ---
  soundPlayCard.currentTime = 0;
  soundPlayCard.play();

  handleBotCard(cardData);

  drawnCards = [];
  renderNests();
  renderDrawnCards();
  renderDiscardPile();
  setTimeout(nextTurn, 500);
}

// --- Bot-Logik ---
function handleBotCard(playerCard) {
  const botCard = drawnCards.find(c => !(c.rank === playerCard.rank && c.suit === playerCard.suit));
  if (!botCard) return;

  if (!placeCardOnNests(botCard, botNests) && !tryStartNewNest(botCard, botNests)) {
    discardPile.push(botCard);
  }
}

// --- Deck-Zähler ---
function updateDeckCount() {
  document.getElementById("deck-count").textContent = deck.length;
}

// --- Spielende ---
function endGame() {
  gameOver = true;
  const playerPoints = calculatePoints(playerNests);
  const botPoints = calculatePoints(botNests);
  let msg = `Ende! Deine Punkte: ${playerPoints} | Bot: ${botPoints}`;
  msg += playerPoints > botPoints ? " 🎉 Du hast gewonnen!" : " 🤖 Bot gewinnt!";
  document.getElementById("score-display").textContent = msg;
}

function calculatePoints(nests) {
  return nests.reduce((acc, nest) => acc + nest.length * nest.length, 0);
}



