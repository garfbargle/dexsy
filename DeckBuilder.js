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

        // Set default card back URL
        this.cardBackUrl = 'https://images.pokemontcg.io/cardback.png';

        this.initializeGameElements();

        // Add pagination tracking
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreResults = true;
        this.lastSearchQuery = '';

        // Add initial search for Base Set
        this.initialBaseSetSearch();

        // Initialize sort button visibility
        this.updateSortButtonVisibility();
    }

    initializeElements() {
        this.searchInput = document.getElementById('search-input');
        this.searchInput.placeholder = '🔍 Search by name, #set-id (#sv1), or @set-name (@Scarlet)';
        this.searchButton = document.getElementById('search-button');
        this.searchResults = document.getElementById('search-results');
        this.deckDisplay = document.getElementById('deck-display');
        this.counters = {
            total: document.getElementById('total-count'),
            pokemon: document.getElementById('pokemon-count'),
            energy: document.getElementById('energy-count'),
            trainer: document.getElementById('trainer-count'),
            price: document.getElementById('price-count')
        };
        
        // Add datalist for set suggestions
        this.createSetSuggestions();
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

        // Add scroll event listener for infinite scrolling
        window.addEventListener('scroll', () => {
            if (this.isLoading || !this.hasMoreResults) return;

            const scrollPosition = window.innerHeight + window.scrollY;
            const scrollThreshold = document.documentElement.scrollHeight - 200;

            if (scrollPosition >= scrollThreshold) {
                this.loadMoreCards();
            }
        });

        // Add sort button listener
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.sortDeck());
        }
    }

    // Add new method to build search query
    buildSearchQuery(query) {
        // If query starts with #, it's a set ID search
        if (query.startsWith('#')) {
            const setQuery = query.substring(1); // Remove the # prefix
            // Check if it's a set number search (e.g. "#swsh1-1", "#base1-4")
            if (setQuery.match(/^[a-zA-Z0-9]+-\d+$/)) {
                return `number:"${setQuery.split('-')[1]}" set.id:"${setQuery.split('-')[0]}"`;
            }
            // Check if it's a set ID without card number (e.g. "#sv1", "#swsh1")
            return `set.id:"${setQuery}"`;
        }
        // If query starts with @, it's a set name/series search
        if (query.startsWith('@')) {
            const setQuery = query.substring(1); // Remove the @ prefix
            return `(set.name:"*${setQuery}*" OR set.series:"*${setQuery}*")`;
        }
        // Default to searching by card name
        return `name:"*${query}*"`;
    }

    async searchCards() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        // Reset pagination when starting a new search
        this.currentPage = 1;
        this.hasMoreResults = true;
        this.lastSearchQuery = query;
        this.searchResults.innerHTML = '';

        try {
            this.isLoading = true;
            const searchQuery = this.buildSearchQuery(query);

            const response = await fetch(
                `https://api.pokemontcg.io/v2/cards?q=${searchQuery}&page=${this.currentPage}&pageSize=20`
            );
            const data = await response.json();
            
            // Check if we have more results
            this.hasMoreResults = data.data.length === 20;
            
            this.displaySearchResults(data.data, false);
        } catch (error) {
            console.error('Error searching cards:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async loadMoreCards() {
        if (this.isLoading || !this.hasMoreResults) return;

        try {
            this.isLoading = true;
            this.currentPage++;

            const searchQuery = this.buildSearchQuery(this.lastSearchQuery);

            const response = await fetch(
                `https://api.pokemontcg.io/v2/cards?q=${searchQuery}&page=${this.currentPage}&pageSize=20`
            );
            const data = await response.json();

            this.hasMoreResults = data.data.length === 20;
            this.displaySearchResults(data.data, true);
        } catch (error) {
            console.error('Error loading more cards:', error);
        } finally {
            this.isLoading = false;
        }
    }

    displaySearchResults(cards, append = false) {
        // Remove any existing loading indicator before adding new cards
        const existingLoadingIndicator = this.searchResults.querySelector('.loading-indicator');
        if (existingLoadingIndicator) {
            existingLoadingIndicator.remove();
        }

        if (!append) {
            this.searchResults.innerHTML = '';
        }

        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            
            // Create image element with card back as placeholder
            const img = document.createElement('img');
            img.src = this.cardBackUrl;  // Show card back while loading
            img.alt = card.name;

            // Load the actual card image
            const actualImage = new Image();
            actualImage.onload = () => {
                img.src = actualImage.src;
            };
            actualImage.src = card.images.small;

            // Get price and rarity data
            const priceData = this.getCardPriceData(card);
            
            // Add price and rarity information
            let priceHTML = '';
            if (priceData.price) {
                priceHTML = `
                    <div class="price-badge">
                        <span class="price-value">$${priceData.price.toFixed(2)}</span>
                    </div>
                `;
            }

            // Add rarity badge
            const rarityHTML = `
                <div class="rarity-badge ${priceData.rarity.toLowerCase().replace(/\s+/g, '-')}">
                    <span>${priceData.rarity}</span>
                </div>
            `;

            // Add buttons for adding to deck and TCGPlayer
            const buttonsHTML = `
                <div class="card-buttons">
                    <button class="card-button" title="Add to deck">➕</button>
                    <button class="card-button tcgplayer-button" title="View on TCGPlayer">💰</button>
                </div>
                ${priceHTML}
                ${rarityHTML}
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
            const addButton = cardElement.querySelector('.card-button:not(.tcgplayer-button)');
            addButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addCardToDeck(card);
            });

            // Add click handler for TCGPlayer button
            const tcgPlayerButton = cardElement.querySelector('.tcgplayer-button');
            tcgPlayerButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openTCGPlayer(card);
            });

            this.searchResults.appendChild(cardElement);
        });
    }

    addCardToDeck(card) {
        this.deck.push(card);
        this.updateDeckDisplay();
        this.updateCounters();
        this.updateSortButtonVisibility();
    }

    // Add new method to increase card quantity
    increaseCardQuantity(card) {
        this.deck.push(card);
        this.updateDeckDisplay();
        this.updateCounters();
    }

    // Add new method to decrease card quantity
    decreaseCardQuantity(card) {
        // Find the last instance of this card in the deck
        const index = this.deck.findIndex(c => 
            c.name === card.name && 
            c.number === card.number && 
            c.set.id === card.set.id
        );
        
        if (index !== -1) {
            this.removeCardFromDeck(index);
        }
    }

    // Enhanced helper method to get card price and rarity data
    getCardPriceData(card) {
        let priceData = { 
            price: null,
            category: null,
            updatedAt: null,
            rarity: card.rarity || 'Unknown'
        };
        
        if (card.tcgplayer && card.tcgplayer.prices) {
            // Get the first available price category (normal, holofoil, etc.)
            const priceCategories = Object.keys(card.tcgplayer.prices);
            if (priceCategories.length > 0) {
                const category = priceCategories[0];
                const prices = card.tcgplayer.prices[category];
                
                // Prefer market price, fall back to mid, then low
                const price = prices.market || prices.mid || prices.low;
                if (price) {
                    priceData.price = price;
                    priceData.category = category;
                    priceData.updatedAt = card.tcgplayer.updatedAt;
                }
            }
        }
        
        return priceData;
    }

    updateDeckDisplay() {
        this.deckDisplay.innerHTML = '';
        
        // Create a map to count duplicate cards and track their first occurrence
        const cardCounts = new Map();
        const firstOccurrence = new Map();
        
        // First pass: count cards and record first occurrence
        this.deck.forEach((card, index) => {
            const cardKey = `${card.name}-${card.number}-${card.set.id}`;
            cardCounts.set(cardKey, (cardCounts.get(cardKey) || 0) + 1);
            if (!firstOccurrence.has(cardKey)) {
                firstOccurrence.set(cardKey, { card, index });
            }
        });

        // Sort by the original order of first appearance
        const sortedCards = Array.from(firstOccurrence.entries())
            .sort((a, b) => a[1].index - b[1].index);

        // Display cards in their original order
        sortedCards.forEach(([cardKey, { card }]) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';

            const img = document.createElement('img');
            img.src = card.images.small;
            img.alt = card.name;

            // Add count badge
            const count = cardCounts.get(cardKey);
            const countBadge = document.createElement('div');
            countBadge.className = 'card-count';
            countBadge.textContent = `×${count}`;

            // Get price and rarity data
            const priceData = this.getCardPriceData(card);
            
            // Add price information
            let priceHTML = '';
            if (priceData.price) {
                priceHTML = `
                    <div class="price-badge">
                        <span class="price-value">$${priceData.price.toFixed(2)}</span>
                    </div>
                `;
            }

            // Add rarity badge
            const rarityHTML = `
                <div class="rarity-badge ${priceData.rarity.toLowerCase().replace(/\s+/g, '-')}">
                    <span>${priceData.rarity}</span>
                </div>
            `;

            // Add buttons for quantity control and TCGPlayer
            const buttonsHTML = `
                <div class="card-buttons">
                    <button class="card-button decrease-button" title="Decrease quantity">➖</button>
                    <button class="card-button increase-button" title="Increase quantity">➕</button>
                    <button class="card-button tcgplayer-button" title="View on TCGPlayer">💰</button>
                </div>
                ${priceHTML}
                ${rarityHTML}
            `;

            cardElement.innerHTML = buttonsHTML;
            cardElement.insertBefore(img, cardElement.firstChild);
            cardElement.appendChild(countBadge);

            // Add click handler for card zoom
            cardElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('card-button')) {
                    this.showCardModal(card.images.large || card.images.small);
                }
            });

            // Add click handler for decrease button
            const decreaseButton = cardElement.querySelector('.decrease-button');
            decreaseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.decreaseCardQuantity(card);
            });

            // Add click handler for increase button
            const increaseButton = cardElement.querySelector('.increase-button');
            increaseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.increaseCardQuantity(card);
            });

            // Add click handler for TCGPlayer button
            const tcgPlayerButton = cardElement.querySelector('.tcgplayer-button');
            tcgPlayerButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openTCGPlayer(card);
            });

            this.deckDisplay.appendChild(cardElement);
        });

        this.updateSortButtonVisibility();
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
            
            // Add price if available
            const priceData = this.getCardPriceData(card);
            if (priceData.price) {
                acc.price += priceData.price;
            }
            
            return acc;
        }, { total: 0, pokemon: 0, energy: 0, trainer: 0, price: 0 });

        // Update count displays
        for (const key of ['total', 'pokemon', 'energy', 'trainer']) {
            this.counters[key].textContent = counts[key];
        }
        
        // Format and update price display
        this.counters.price.textContent = '$' + counts.price.toFixed(2);

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
        // Store the removed card for undo
        const removedCard = this.deck[index];
        this.removedCards.push(removedCard);
        
        // Remove only the card at the specified index
        this.deck.splice(index, 1);
        
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
            // Create a simple modal for export options
            this.modalContent.innerHTML = `
                <div class="export-options">
                    <h3>Export Options</h3>
                    <button id="exportFull">Export Full Deck Data</button>
                    <button id="exportSimple">Export Simple Format (Images Only)</button>
                </div>
            `;
            this.modalOverlay.classList.add('active');
            
            // Add event listeners for export options
            document.getElementById('exportFull').addEventListener('click', () => {
                this.exportDeck('full');
                this.modalOverlay.classList.remove('active');
            });
            
            document.getElementById('exportSimple').addEventListener('click', () => {
                this.exportDeck('simple');
                this.modalOverlay.classList.remove('active');
            });
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
                        
                        // Check if it's a simple format (array of objects with front_image_url)
                        if (Array.isArray(importedDeck) && importedDeck.length > 0 && 'front_image_url' in importedDeck[0]) {
                            // Convert simple format to full format if possible
                            alert('Simple format detected. Only image URLs will be imported.');
                            // In a real implementation, we would need to fetch the card data
                            // based on the image URLs, but this is complex and requires API calls
                        } else {
                            // Assume it's full format
                            this.deck = importedDeck;
                        }
                        
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

    // New method to handle different export formats
    exportDeck(format) {
        let deckData;
        let filename;
        
        if (format === 'simple') {
            // Simple format: just front and back image URLs
            const simpleDeck = this.deck.map(card => ({
                front_image_url: card.images.small,
                back_image_url: this.cardBackUrl
            }));
            deckData = JSON.stringify(simpleDeck, null, 2);
            filename = 'pokemon-deck-simple.json';
        } else {
            // Full format: all card data
            deckData = JSON.stringify(this.deck, null, 2);
            filename = 'pokemon-deck.json';
        }
        
        const blob = new Blob([deckData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

    async createSetSuggestions() {
        try {
            // Fetch sets from the Pokémon TCG API instead of local file
            const response = await fetch('https://api.pokemontcg.io/v2/sets');
            const data = await response.json();
            
            // Sort sets by release date (newest first)
            const sortedSets = data.data.sort((a, b) => 
                new Date(b.releaseDate) - new Date(a.releaseDate)
            );
            
            // Create datalist element
            const datalist = document.createElement('datalist');
            datalist.id = 'set-suggestions';
            
            // Add suggestions for both set IDs and names
            sortedSets.forEach(set => {
                // Add set ID suggestion with # prefix (without -1)
                const idOption = document.createElement('option');
                idOption.value = `#${set.id}`;
                idOption.label = `${set.name} (${set.series}) - ID Search`;
                datalist.appendChild(idOption);
                
                // Add set name suggestion with @ prefix
                const nameOption = document.createElement('option');
                nameOption.value = `@${set.name}`;
                nameOption.label = `${set.series} Series - Name Search`;
                datalist.appendChild(nameOption);
            });
            
            // Add datalist to document
            document.body.appendChild(datalist);
            
            // Connect datalist to search input
            this.searchInput.setAttribute('list', 'set-suggestions');
            
        } catch (error) {
            console.error('Error loading set suggestions:', error);
        }
    }

    // Add new method for initial Base Set search
    initialBaseSetSearch() {
        // Set the search input value to "#base1"
        this.searchInput.value = "#base1";
        // Trigger the search
        this.searchCards();
    }

    // Add new method for sorting the deck
    sortDeck() {
        // Define sort order for supertypes
        const typeOrder = {
            'pokémon': 1,
            'pokemon': 1,  // Handle both forms of spelling
            'trainer': 2,
            'energy': 3
        };

        // Define sort order for Pokémon types
        const pokemonTypeOrder = {
            'grass': 1,
            'fire': 2,
            'water': 3,
            'lightning': 4,
            'fighting': 5,
            'psychic': 6,
            'colorless': 7,
            'darkness': 8,
            'metal': 9,
            'dragon': 10,
            'fairy': 11
        };

        // Sort the deck array
        this.deck.sort((a, b) => {
            const typeA = (a.supertype || '').toLowerCase();
            const typeB = (b.supertype || '').toLowerCase();
            
            // Get order values (default to highest number if type not found)
            const orderA = typeOrder[typeA] || 999;
            const orderB = typeOrder[typeB] || 999;
            
            // Sort by supertype order first
            if (orderA !== orderB) {
                return orderA - orderB;
            }

            // If both are Pokémon, sort by Pokémon type
            if (typeA === 'pokémon' || typeA === 'pokemon') {
                const pokemonTypeA = (a.types && a.types[0] || '').toLowerCase();
                const pokemonTypeB = (b.types && b.types[0] || '').toLowerCase();
                
                const pokemonOrderA = pokemonTypeOrder[pokemonTypeA] || 999;
                const pokemonOrderB = pokemonTypeOrder[pokemonTypeB] || 999;

                if (pokemonOrderA !== pokemonOrderB) {
                    return pokemonOrderA - pokemonOrderB;
                }
            }
            
            // Within same type, sort by name
            return a.name.localeCompare(b.name);
        });

        // Update the display
        this.updateDeckDisplay();
    }

    // Add new method to handle sort button visibility
    updateSortButtonVisibility() {
        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) {
            sortBtn.style.display = this.deck.length > 0 ? 'block' : 'none';
        }
    }

    // Add new method to handle opening TCGPlayer
    openTCGPlayer(card) {
        // Construct the TCGPlayer search URL using just name and set
        const searchQuery = encodeURIComponent(`${card.name} ${card.set.name}`);
        const tcgPlayerUrl = `https://www.tcgplayer.com/search/pokemon/${card.set.name.toLowerCase()}?q=${searchQuery}&productLineName=pokemon`;
        window.open(tcgPlayerUrl, '_blank');
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
            deckBuilder.updateSortButtonVisibility();
        }
    });
}); 