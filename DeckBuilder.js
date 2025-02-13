class DeckBuilder {
    constructor() {
        this.deck = [];
        this.initializeElements();
        this.setupEventListeners();
        
        // Add modal overlay to the document
        this.createModalOverlay();

        // Add export/import buttons to event listeners
        this.setupExportImport();

        this.cardBackUrl = null;
        this.fetchCardBack();
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
            const buttons = [
                {icon: '🔍', title: 'Zoom', handler: () => this.showCardModal(card.images.large || card.images.small)},
                {icon: 'ℹ️', title: 'Show details', handler: () => this.showCardDetails(card)},
                {icon: '✅', title: 'Add to deck', handler: () => this.addCardToDeck(card)}
            ];

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

            cardElement.innerHTML = `
                <div class="card-buttons">
                    ${buttons.map(btn => `
                        <button class="card-button" title="${btn.title}">${btn.icon}</button>
                    `).join('')}
                </div>
            `;
            
            // Insert the image at the beginning of the card element
            cardElement.insertBefore(img, cardElement.firstChild);

            const buttonElements = cardElement.querySelectorAll('.card-button');
            buttons.forEach((btn, i) => {
                buttonElements[i].addEventListener('click', (e) => {
                    e.stopPropagation();
                    btn.handler();
                });
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
            cardElement.className = `card ${card.energy ? 'energy-card' : ''}`;

            if (card.energy) {
                cardElement.innerHTML = `
                    <img src="${card.images.small}" alt="${card.name}">
                    <div class="card-info">
                        <h3>${card.name}</h3>
                        <p>Energy</p>
                    </div>
                `;
            } else {
                const buttons = [
                    {icon: '🔍', title: 'Zoom', handler: () => this.showCardModal(card.images.large || card.images.small)},
                    {icon: 'ℹ️', title: 'Show details', handler: () => this.showCardDetails(card)},
                    {icon: '🗑️', title: 'Remove from deck', handler: () => this.removeCardFromDeck(index)}
                ];

                cardElement.innerHTML = `
                    <img src="${card.images.small}" alt="${card.name}">
                    <div class="card-buttons">
                        ${buttons.map(btn => `
                            <button class="card-button" title="${btn.title}">${btn.icon}</button>
                        `).join('')}
                    </div>
                `;

                const buttonElements = cardElement.querySelectorAll('.card-button');
                buttons.forEach((btn, i) => {
                    buttonElements[i].addEventListener('click', (e) => {
                        e.stopPropagation();
                        btn.handler();
                    });
                });
            }
            
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
        this.deck.splice(index, 1);
        this.updateDeckDisplay();
        this.updateCounters();
    }

    showCardModal(imageUrl) {
        this.modalContent.innerHTML = `<img src="${imageUrl}" alt="Card preview">`;
        this.modalOverlay.classList.add('active');
    }

    showCardDetails(card) {
        const sections = [
            {
                title: null,
                items: [
                    ['Type', card.supertype],
                    ['Subtypes', card.subtypes?.join(', ')],
                    ['HP', card.hp],
                    ['Types', card.types?.join(', ')],
                    ['Evolves From', card.evolvesFrom]
                ]
            },
            {
                title: 'Abilities',
                items: card.abilities?.map(a => [`${a.name}`, a.text])
            },
            {
                title: 'Attacks',
                items: card.attacks?.map(a => [`${a.name}`, `Damage: ${a.damage || '0'}\n${a.text || ''}`])
            },
            {
                title: 'Rules',
                items: card.rules?.map(r => [null, r])
            }
        ];

        const detailsHTML = `
            <div class="card-details">
                <h2>${card.name}</h2>
                ${sections.map(section => {
                    if (!section.items?.length) return '';
                    
                    const content = section.items
                        .filter(([label, value]) => value)
                        .map(([label, value]) => `
                            <div class="${section.title ? section.title.toLowerCase() : 'detail-item'}">
                                ${label ? `<strong>${label}:</strong> ` : ''}${value}
                            </div>
                        `).join('');
                        
                    return content ? `
                        ${section.title ? `<h3>${section.title}</h3>` : ''}
                        <div class="${section.title ? `${section.title.toLowerCase()}-section` : 'details-grid'}">
                            ${content}
                        </div>
                    ` : '';
                }).join('')}
            </div>
        `;

        this.modalContent.innerHTML = detailsHTML;
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