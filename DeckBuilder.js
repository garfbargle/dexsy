class DeckBuilder {
    constructor() {
        this.deck = [];
        this.removedCards = [];  // Track removed cards for undo
        this.initializeElements();
        this.setupEventListeners();
        
        // Add modal overlay to the document
        this.createModalOverlay();

        // Add export/import buttons to event listeners
        this.setupExportImport();

        this.cardBackUrl = null;
        this.fetchCardBack();

        this.initializeGameElements();
    }

    initializeElements() {
        this.searchInput = document.getElementById('search-input');
        this.searchButton = document.getElementById('search-button');
        this.searchResults = document.getElementById('search-results');
        this.deckDisplay = document.getElementById('deck-display');
        this.counters = {
            total: document.getElementById('total-count'),
            pokemon: document.getElementById('pokemon-count'),
            energy: document.getElementById('energy-count'),
            trainer: document.getElementById('trainer-count')
        };
    }

    setupEventListeners() {
        this.searchButton.addEventListener('click', () => this.searchCards());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.searchInput.value.trim()) {
                this.searchCards();
            }
        });
        
        // Add undo button listener
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoCardRemoval());
        }
    }

    async searchCards() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        try {
            const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${query}"&pageSize=20`);
            const data = await response.json();
            this.displaySearchResults(data.data);
        } catch (error) {
            console.error('Error searching cards:', error);
        }
    }

    async fetchCardBack() {
        try {
            const response = await fetch('https://api.pokemontcg.io/v2/cards?q=!name:"Card Back"');
            const data = await response.json();
            const cardBack = data.data.find(card => card.name === 'Card Back');
            this.cardBackUrl = cardBack?.images?.small || 'https://images.pokemontcg.io/cardback.png';
        } catch (error) {
            console.error('Error fetching card back:', error);
            this.cardBackUrl = 'https://images.pokemontcg.io/cardback.png'; // Fallback URL
        }
    }

    displaySearchResults(cards) {
        this.searchResults.innerHTML = '';
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            
            // Create image element with card back as placeholder
            const img = document.createElement('img');
            img.src = this.cardBackUrl;
            img.alt = card.name;

            // Load the actual card image
            const actualImage = new Image();
            actualImage.onload = () => {
                img.src = actualImage.src;
            };
            actualImage.src = card.images.small;

            // Add button for adding to deck
            const buttonsHTML = `
                <div class="card-buttons">
                    <button class="card-button">✅</button>
                </div>
            `;
            
            cardElement.innerHTML = buttonsHTML;
            cardElement.insertBefore(img, cardElement.firstChild);

            // Add click handler for card zoom
            cardElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('card-button')) {
                    this.showCardModal(card.images.large || card.images.small);
                }
            });

            // Add click handler for add button
            const addButton = cardElement.querySelector('.card-button');
            addButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addCardToDeck(card);
            });

            this.searchResults.appendChild(cardElement);
        });
    }

    addCardToDeck(card) {
        this.deck.push(card);
        this.updateDeckDisplay();
        this.updateCounters();
    }

    updateDeckDisplay() {
        this.deckDisplay.innerHTML = '';
        this.deck.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';

            const img = document.createElement('img');
            img.src = card.images.small;
            img.alt = card.name;

            // Add button for removing from deck
            const buttonsHTML = `
                <div class="card-buttons">
                    <button class="card-button">❌</button>
                </div>
            `;

            cardElement.innerHTML = buttonsHTML;
            cardElement.insertBefore(img, cardElement.firstChild);

            // Add click handler for card zoom
            cardElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('card-button')) {
                    this.showCardModal(card.images.large || card.images.small);
                }
            });

            // Add click handler for remove button
            const removeButton = cardElement.querySelector('.card-button');
            removeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeCardFromDeck(index);
            });

            this.deckDisplay.appendChild(cardElement);
        });
    }

    updateCounters() {
        const counts = this.deck.reduce((acc, card) => {
            acc.total++;
            // Convert supertype to lowercase and handle possible undefined/null cases
            const type = (card.supertype || '').toLowerCase();
            if (type === 'pokémon' || type === 'pokemon') {
                acc.pokemon++;
            } else if (type === 'energy') {
                acc.energy++;
            } else if (type === 'trainer') {
                acc.trainer++;
            }
            return acc;
        }, { total: 0, pokemon: 0, energy: 0, trainer: 0 });

        Object.keys(this.counters).forEach(key => {
            this.counters[key].textContent = counts[key];
        });

        // Show/hide game start button based on deck size
        if (this.deck.length >= 40) {
            this.gameStartButton.classList.add('visible');
        } else {
            this.gameStartButton.classList.remove('visible');
        }
    }

    createModalOverlay() {
        this.modalOverlay = document.createElement('div');
        this.modalOverlay.className = 'modal-overlay';
        this.modalContent = document.createElement('div');
        this.modalContent.className = 'modal-content';
        this.modalOverlay.appendChild(this.modalContent);
        document.body.appendChild(this.modalOverlay);

        // Close modal when clicking outside the image
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.modalOverlay.classList.remove('active');
            }
        });
    }

    removeCardFromDeck(index) {
        const removedCard = this.deck.splice(index, 1)[0];
        this.removedCards.push(removedCard);  // Store removed card
        this.updateDeckDisplay();
        this.updateCounters();
        
        // Show undo button if we have removed cards
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.style.display = this.removedCards.length > 0 ? 'block' : 'none';
        }
    }

    showCardModal(imageUrl) {
        this.modalContent.innerHTML = `<img src="${imageUrl}" alt="Card preview">`;
        this.modalOverlay.classList.add('active');
    }

    setupExportImport() {
        // Create hidden file input for import
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        document.getElementById('exportBtn').addEventListener('click', () => {
            const deckData = JSON.stringify(this.deck, null, 2);
            const blob = new Blob([deckData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pokemon-deck.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedDeck = JSON.parse(e.target.result);
                        this.deck = importedDeck;
                        this.updateDeckDisplay();
                        this.updateCounters();
                    } catch (error) {
                        alert('Error importing deck: Invalid file format');
                    }
                };
                reader.readAsText(file);
            }
        });

        // Clear button is already working correctly
    }

    initializeGameElements() {
        this.gameStartButton = document.getElementById('gameStartButton');
        this.gameOverlay = document.getElementById('gameOverlay');
        this.playerHand = document.getElementById('playerHand');
        this.prizeCards = document.getElementById('prizeCards');
        
        this.gameStartButton.addEventListener('click', () => this.startGameSimulation());
        this.gameOverlay.addEventListener('click', (e) => {
            if (e.target === this.gameOverlay) {
                this.gameOverlay.classList.remove('active');
            }
        });
    }

    startGameSimulation() {
        // Shuffle the deck
        this.shuffleDeck();
        
        // Clear previous game state
        this.playerHand.innerHTML = '';
        this.prizeCards.innerHTML = '';
        this.gameOverlay.classList.add('active');
        
        // Deal cards with animation after shuffle animation completes
        setTimeout(() => {
            this.dealHand();
            this.dealPrizeCards();
        }, 500);
    }

    shuffleDeck() {
        this.gameStartButton.querySelector('.stacked-cards').classList.add('shuffle-animation');
        
        // Fisher-Yates shuffle
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        
        setTimeout(() => {
            this.gameStartButton.querySelector('.stacked-cards').classList.remove('shuffle-animation');
        }, 500);
    }

    dealHand() {
        const handSize = 7;
        const fanAngleSpread = 45;
        const startAngle = -fanAngleSpread / 2;
        const angleStep = fanAngleSpread / (handSize - 1);
        const radius = 750;

        for (let i = 0; i < handSize; i++) {
            const card = this.deck[i];
            const cardElement = this.createGameCard(card);
            cardElement.classList.add('in-hand', 'dealing');
            this.playerHand.appendChild(cardElement);
            
            // Calculate fan position using trigonometry
            const angle = startAngle + (i * angleStep);
            const radian = (angle * Math.PI) / 180;
            
            // Calculate position along the arc
            const x = Math.sin(radian) * radius;
            const y = -Math.cos(radian) * radius * 0.15;

            // Trigger dealing animation after a short delay
            setTimeout(() => {
                cardElement.classList.add('dealt');
                cardElement.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
                
                // Flip card face up after it reaches its position
                setTimeout(() => {
                    cardElement.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg) rotateY(180deg)`;
                }, 600);
            }, i * 200);
        }
    }

    dealPrizeCards() {
        for (let i = 0; i < 6; i++) {
            const card = this.deck[i + 7];
            const cardElement = this.createGameCard(card);
            cardElement.classList.add('dealing');
            this.prizeCards.appendChild(cardElement);
            
            // Trigger dealing animation after a short delay
            setTimeout(() => {
                cardElement.classList.add('dealt');
                
                // Flip card face up after it reaches its position
                setTimeout(() => {
                    cardElement.style.transform = 'rotateY(180deg)';
                }, 600);
            }, (i + 7) * 200); // Start after hand is dealt
        }
    }

    createGameCard(card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'game-card';
        cardElement.innerHTML = `
            <div class="front">
                <img src="${card.images.small}" alt="${card.name}">
            </div>
            <div class="back"></div>
        `;
        return cardElement;
    }

    // Add new method for undo functionality
    undoCardRemoval() {
        if (this.removedCards.length > 0) {
            const cardToRestore = this.removedCards.pop();
            this.deck.push(cardToRestore);
            this.updateDeckDisplay();
            this.updateCounters();
            
            // Hide undo button if no more cards to restore
            const undoBtn = document.getElementById('undoBtn');
            if (undoBtn && this.removedCards.length === 0) {
                undoBtn.style.display = 'none';
            }
        }
    }
}

// Initialize the deck builder when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const deckBuilder = new DeckBuilder();
    
    document.getElementById('clearBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your deck? This action cannot be undone.')) {
            deckBuilder.deck = [];
            deckBuilder.updateDeckDisplay();
            deckBuilder.updateCounters();
        }
    });
}); 