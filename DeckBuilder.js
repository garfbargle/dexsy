class DeckBuilder {
    constructor() {
        this.deck = [];
        this.removedCards = [];  // Track removed cards for undo
        this.sets = [];  // Add sets storage
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreResults = true;
        this.lastSearchQuery = '';
        this.currentSortOption = 'setOrder';
        this.cardBackUrl = 'https://images.pokemontcg.io/cardback.png';
        
        // Show loading screen
        this.showLoadingScreen();
        
        // Initialize after DOM is ready
        setTimeout(() => {
            this.initializeApp();
        }, 1000);
    }

    async initializeApp() {
        try {
            this.initializeElements();
            this.setupEventListeners();
            this.createModalOverlay();
            this.setupExportImport();
            this.initializeGameElements();
            this.updateSortButtonVisibility();
            this.setupDarkMode();
            
            // Load initial data
            await this.loadSetsInBackground();
            
            // Make initial search
            this.searchInput.value = "#base1";
            await this.initialBaseSetSearch();
            
            // Hide loading screen
            this.hideLoadingScreen();
            
            this.showToast('Welcome to Dexsy! Your deck builder is ready.', 'success');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.hideLoadingScreen();
            this.showToast('Error loading application. Please refresh the page.', 'error');
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 500);
        }
    }

    initializeElements() {
        this.searchInput = document.getElementById('search-input');
        this.searchInput.placeholder = '🔍 Search by name, #set-id (#sv1), or @set-name (@Scarlet)';
        this.searchButton = document.getElementById('search-button');
        this.sortSelect = document.getElementById('sort-select');
        this.searchResults = document.getElementById('search-results');
        this.deckDisplay = document.getElementById('deck-display');
        this.counters = {
            total: document.getElementById('total-count'),
            pokemon: document.getElementById('pokemon-count'),
            energy: document.getElementById('energy-count'),
            trainer: document.getElementById('trainer-count'),
            price: document.getElementById('price-count')
        };
    }

    setupEventListeners() {
        // Search functionality
        this.searchButton.addEventListener('click', () => this.searchCards());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.searchInput.value.trim()) {
                this.searchCards();
            }
        });
        
        // Sort functionality
        this.sortSelect.addEventListener('change', () => {
            this.currentSortOption = this.sortSelect.value;
            if (this.searchResults.children.length > 0) {
                this.sortSearchResults(Array.from(this.searchResults.querySelectorAll('.card')));
            }
        });
        
        // Control buttons
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undoCardRemoval());
        }

        const sortBtn = document.getElementById('sortBtn');
        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.sortDeck());
        }

        // Infinite scrolling - listen to search results container scroll
        const searchResultsContainer = document.querySelector('.search-results-container');
        if (searchResultsContainer) {
            searchResultsContainer.addEventListener('scroll', () => {
                if (this.isLoading || !this.hasMoreResults) return;

                const container = searchResultsContainer;
                const scrollPosition = container.scrollTop + container.clientHeight;
                const scrollThreshold = container.scrollHeight - 100; // 100px before bottom

                if (scrollPosition >= scrollThreshold && this.lastSearchQuery) {
                    this.loadMoreCards();
                }
            });
        }

        // Search help toggle
        const helpToggle = document.querySelector('.help-toggle');
        if (helpToggle) {
            let helpTimeout;
            helpToggle.addEventListener('mouseenter', () => {
                clearTimeout(helpTimeout);
            });
            helpToggle.addEventListener('mouseleave', () => {
                helpTimeout = setTimeout(() => {
                    // Help content will hide via CSS
                }, 300);
            });
        }
    }

    setupDarkMode() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            // Check for saved theme or default to light
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            
            // Update toggle icon
            this.updateThemeIcon(savedTheme);
            
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                this.updateThemeIcon(newTheme);
                
                this.showToast(`Switched to ${newTheme} mode`, 'info');
            });
        }
    }

    updateThemeIcon(theme) {
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) {
            themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="font-weight: 600; color: var(--text-primary);">${message}</div>
            </div>
        `;

        toastContainer.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'toastEnter 0.3s ease-out reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    showLoadingIndicator() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
        }
    }

    hideLoadingIndicator() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
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
            this.showLoadingIndicator();
            
            const searchQuery = this.buildSearchQuery(query);

            const response = await fetch(
                `https://api.pokemontcg.io/v2/cards?q=${searchQuery}&page=${this.currentPage}&pageSize=20`
            );
            const data = await response.json();
            
            // Check if we have more results
            this.hasMoreResults = data.data.length === 20;
            
            this.displaySearchResults(data.data, false);
            
            if (data.data.length === 0) {
                this.showToast('No cards found. Try a different search term.', 'info');
            } else {
                this.showToast(`Found ${data.data.length} cards`, 'success');
            }
        } catch (error) {
            console.error('Error searching cards:', error);
            this.showToast('Error searching cards. Please try again.', 'error');
        } finally {
            this.isLoading = false;
            this.hideLoadingIndicator();
        }
    }

    async loadMoreCards() {
        if (this.isLoading || !this.hasMoreResults) return;

        try {
            this.isLoading = true;
            this.showInfiniteScrollLoader();
            this.currentPage++;

            const searchQuery = this.buildSearchQuery(this.lastSearchQuery);
            const response = await fetch(
                `https://api.pokemontcg.io/v2/cards?q=${searchQuery}&page=${this.currentPage}&pageSize=20`
            );
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            this.hasMoreResults = data.data.length === 20;
            this.displaySearchResults(data.data, true);
            
            if (data.data.length > 0) {
                this.showToast(`Loaded ${data.data.length} more cards`, 'info');
            } else {
                this.showToast('No more cards to load', 'info');
            }
        } catch (error) {
            console.error('Error loading more cards:', error);
            this.showToast('Error loading more cards.', 'error');
        } finally {
            this.isLoading = false;
            this.hideInfiniteScrollLoader();
        }
    }

    showInfiniteScrollLoader() {
        // Remove any existing loader
        const existingLoader = this.searchResults.querySelector('.infinite-scroll-loader');
        if (existingLoader) {
            existingLoader.remove();
        }

        // Add loader to bottom of search results
        const loader = document.createElement('div');
        loader.className = 'infinite-scroll-loader';
        loader.style.gridColumn = '1 / -1';
        loader.style.textAlign = 'center';
        loader.style.padding = 'var(--space-8)';
        loader.style.color = 'var(--text-secondary)';
        loader.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: var(--space-3);">
                <div class="spinner"></div>
                <span>Loading more cards...</span>
            </div>
        `;
        this.searchResults.appendChild(loader);
    }

    hideInfiniteScrollLoader() {
        const loader = this.searchResults.querySelector('.infinite-scroll-loader');
        if (loader) {
            loader.remove();
        }
    }

    displaySearchResults(cards, append = false) {
        // Remove any existing loading indicators
        const existingLoadingIndicator = this.searchResults.querySelector('.loading-indicator');
        if (existingLoadingIndicator) {
            existingLoadingIndicator.remove();
        }

        const existingInfiniteLoader = this.searchResults.querySelector('.infinite-scroll-loader');
        if (existingInfiniteLoader) {
            existingInfiniteLoader.remove();
        }

        if (!append) {
            this.searchResults.innerHTML = '';
        }

        const sortedCards = this.sortCards(cards);

        sortedCards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            
            cardElement.dataset.cardData = JSON.stringify({
                name: card.name,
                number: card.number,
                setId: card.set.id,
                price: this.getCardPriceData(card).price || 0
            });
            
            const img = document.createElement('img');
            img.src = this.cardBackUrl;
            img.alt = card.name;
            img.loading = 'lazy';

            const actualImage = new Image();
            actualImage.onload = () => {
                img.src = actualImage.src;
            };
            actualImage.onerror = () => {
                console.warn(`Failed to load image for ${card.name}`);
            };
            actualImage.src = card.images.small;

            const priceData = this.getCardPriceData(card);
            
            let priceHTML = '';
            if (priceData.price) {
                priceHTML = `
                    <div class="price-badge">
                        <span class="price-value">$${priceData.price.toFixed(2)}</span>
                    </div>
                `;
            }

            const buttonsHTML = `
                <div class="card-buttons">
                    <button class="card-button decrease-button" title="Remove from deck" aria-label="Remove from deck">➖</button>
                    <button class="card-button increase-button" title="Add to deck" aria-label="Add to deck">➕</button>
                </div>
                ${priceHTML}
            `;
            
            cardElement.innerHTML = buttonsHTML;
            cardElement.insertBefore(img, cardElement.firstChild);

            // Event listeners
            cardElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('card-button') && 
                    !e.target.closest('.price-badge')) {
                    this.showCardModal(card.images.large || card.images.small);
                }
            });

            const decreaseButton = cardElement.querySelector('.decrease-button');
            decreaseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.decreaseCardQuantity(card);
            });

            const increaseButton = cardElement.querySelector('.increase-button');
            increaseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.increaseCardQuantity(card);
            });

            const priceBadge = cardElement.querySelector('.price-badge');
            if (priceBadge) {
                priceBadge.style.cursor = 'pointer';
                priceBadge.title = "View on TCGPlayer";
                priceBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTCGPlayer(card);
                });
            }

            this.searchResults.appendChild(cardElement);
        });

        // If appending, re-sort all cards to maintain consistent sorting
        if (append) {
            this.sortSearchResults(Array.from(this.searchResults.querySelectorAll('.card')));
        }

        // Show end-of-results indicator if no more results available
        if (append && !this.hasMoreResults) {
            this.showEndOfResults();
        }
    }

    showEndOfResults() {
        const endIndicator = document.createElement('div');
        endIndicator.className = 'end-of-results';
        endIndicator.style.gridColumn = '1 / -1';
        endIndicator.style.textAlign = 'center';
        endIndicator.style.padding = 'var(--space-8)';
        endIndicator.style.color = 'var(--text-tertiary)';
        endIndicator.style.fontSize = 'var(--font-size-sm)';
        endIndicator.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: var(--space-2);">
                <div style="height: 1px; background: var(--border-primary); flex: 1;"></div>
                <span>End of results</span>
                <div style="height: 1px; background: var(--border-primary); flex: 1;"></div>
            </div>
        `;
        this.searchResults.appendChild(endIndicator);
    }

    // New method to sort cards based on current sort option
    sortCards(cards) {
        const sortedCards = [...cards];

        switch (this.currentSortOption) {
            case 'priceLow':
                sortedCards.sort((a, b) => {
                    const priceA = this.getCardPriceData(a).price || 0;
                    const priceB = this.getCardPriceData(b).price || 0;
                    return priceA - priceB;
                });
                break;
            case 'priceHigh':
                sortedCards.sort((a, b) => {
                    const priceA = this.getCardPriceData(a).price || 0;
                    const priceB = this.getCardPriceData(b).price || 0;
                    return priceB - priceA;
                });
                break;
            case 'setOrder':
            default:
                // Default is set order (already in order from API)
                break;
        }

        return sortedCards;
    }

    // New method to sort existing DOM elements
    sortSearchResults(cardElements) {
        // Convert NodeList to Array to use sort
        const sortedElements = [...cardElements];
        
        switch (this.currentSortOption) {
            case 'priceLow':
                sortedElements.sort((a, b) => {
                    const dataA = JSON.parse(a.dataset.cardData || '{}');
                    const dataB = JSON.parse(b.dataset.cardData || '{}');
                    return (dataA.price || 0) - (dataB.price || 0);
                });
                break;
            case 'priceHigh':
                sortedElements.sort((a, b) => {
                    const dataA = JSON.parse(a.dataset.cardData || '{}');
                    const dataB = JSON.parse(b.dataset.cardData || '{}');
                    return (dataB.price || 0) - (dataA.price || 0);
                });
                break;
            case 'setOrder':
                sortedElements.sort((a, b) => {
                    const dataA = JSON.parse(a.dataset.cardData || '{}');
                    const dataB = JSON.parse(b.dataset.cardData || '{}');
                    
                    // First compare set IDs
                    if (dataA.setId !== dataB.setId) {
                        return dataA.setId.localeCompare(dataB.setId);
                    }
                    
                    // If same set, compare by card number
                    const numA = parseInt(dataA.number) || 0;
                    const numB = parseInt(dataB.number) || 0;
                    return numA - numB;
                });
                break;
            default:
                return;
        }
        
        // Clear and reappend in sorted order
        const parent = this.searchResults;
        sortedElements.forEach(element => {
            parent.appendChild(element);
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
        this.showToast(`Added ${card.name} to deck`, 'success');
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
            this.showToast(`Removed ${card.name} from deck`, 'info');
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
        
        const cardCounts = new Map();
        const firstOccurrence = new Map();
        
        this.deck.forEach((card, index) => {
            const cardKey = `${card.name}-${card.number}-${card.set.id}`;
            cardCounts.set(cardKey, (cardCounts.get(cardKey) || 0) + 1);
            if (!firstOccurrence.has(cardKey)) {
                firstOccurrence.set(cardKey, { card, index });
            }
        });

        if (firstOccurrence.size === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                        <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"/>
                        <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </div>
                <h3>Your deck is empty</h3>
                <p>Search for cards below to start building your deck</p>
            `;
            this.deckDisplay.appendChild(emptyState);
            return;
        }

        const sortedCards = Array.from(firstOccurrence.entries())
            .sort((a, b) => a[1].index - b[1].index);

        sortedCards.forEach(([cardKey, { card }]) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';

            const img = document.createElement('img');
            img.src = card.images.small;
            img.alt = card.name;
            img.loading = 'lazy';

            const count = cardCounts.get(cardKey);
            const countBadge = document.createElement('div');
            countBadge.className = 'card-count';
            countBadge.textContent = `×${count}`;

            const priceData = this.getCardPriceData(card);
            
            let priceHTML = '';
            if (priceData.price) {
                priceHTML = `
                    <div class="price-badge">
                        <span class="price-value">$${priceData.price.toFixed(2)}</span>
                    </div>
                `;
            }

            const buttonsHTML = `
                <div class="card-buttons">
                    <button class="card-button decrease-button" title="Remove one" aria-label="Remove one">➖</button>
                    <button class="card-button increase-button" title="Add one" aria-label="Add one">➕</button>
                </div>
                ${priceHTML}
            `;

            cardElement.innerHTML = buttonsHTML;
            cardElement.insertBefore(img, cardElement.firstChild);
            cardElement.appendChild(countBadge);

            // Event listeners
            cardElement.addEventListener('click', (e) => {
                if (!e.target.classList.contains('card-button') && 
                    !e.target.closest('.price-badge')) {
                    this.showCardModal(card.images.large || card.images.small);
                }
            });

            const decreaseButton = cardElement.querySelector('.decrease-button');
            decreaseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.decreaseCardQuantity(card);
            });

            const increaseButton = cardElement.querySelector('.increase-button');
            increaseButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.increaseCardQuantity(card);
            });

            const priceBadge = cardElement.querySelector('.price-badge');
            if (priceBadge) {
                priceBadge.style.cursor = 'pointer';
                priceBadge.title = "View on TCGPlayer";
                priceBadge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openTCGPlayer(card);
                });
            }

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
        this.modalOverlay = document.querySelector('.modal-overlay');
        this.modalContent = document.querySelector('.modal-content');

        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.modalOverlay.classList.remove('active');
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalOverlay.classList.contains('active')) {
                this.modalOverlay.classList.remove('active');
            }
        });
    }

    removeCardFromDeck(index) {
        const removedCard = this.deck[index];
        this.removedCards.push(removedCard);
        
        this.deck.splice(index, 1);
        
        this.updateDeckDisplay();
        this.updateCounters();
        
        const undoBtn = document.getElementById('undoBtn');
        if (undoBtn) {
            undoBtn.style.display = this.removedCards.length > 0 ? 'block' : 'none';
        }
    }

    showCardModal(imageUrl) {
        this.modalContent.innerHTML = `<img src="${imageUrl}" alt="Card preview" style="max-width: 100%; height: auto;">`;
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

    // Modify loadSetsAndInitialize to loadSetsInBackground
    async loadSetsInBackground() {
        try {
            await this.createSetSuggestions();
        } catch (error) {
            console.error('Error during initialization:', error);
            // Show error message to user
            alert('Failed to load set data. Please refresh the page to try again.');
        }
    }

    async createSetSuggestions() {
        try {
            // Fetch sets from the Pokémon TCG API
            const response = await fetch('https://api.pokemontcg.io/v2/sets');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Store sets data for future use
            this.sets = data.data.sort((a, b) => 
                new Date(b.releaseDate) - new Date(a.releaseDate)
            );
            
            // Create datalist element
            const existingDatalist = document.getElementById('set-suggestions');
            if (existingDatalist) {
                existingDatalist.remove();
            }

            const datalist = document.createElement('datalist');
            datalist.id = 'set-suggestions';
            
            // Add suggestions for both set IDs and names
            this.sets.forEach(set => {
                // Add set ID suggestion with # prefix
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
            throw new Error('Failed to load set data from the API');
        }
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

    // Add direct search method for initialization
    initialBaseSetSearch() {
        const baseSetQuery = "set.id:\"base1\"";
        
        this.isLoading = true;
        this.lastSearchQuery = "#base1";
        this.currentPage = 1;
        
        fetch(`https://api.pokemontcg.io/v2/cards?q=${baseSetQuery}&page=1&pageSize=20`)
            .then(response => response.json())
            .then(data => {
                this.hasMoreResults = data.data.length === 20;
                this.displaySearchResults(data.data, false);
            })
            .catch(error => {
                console.error('Error in initial search:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
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