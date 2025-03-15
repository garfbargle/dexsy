# 📕 Dexsy: Pokémon TCG Deck Builder

## Application Overview

Dexsy is a web-based application for building and managing custom Pokémon Trading Card Game (TCG) decks. The application allows users to search for Pokémon cards, add them to decks, view detailed information, and export/import decks for later use.

## Key Features

- **Card Search**: Search for cards by name, set ID, set name, or special subtypes
- **Deck Management**: Build decks by adding and removing cards
- **Deck Statistics**: Real-time tracking of card counts and deck price
- **Export/Import**: Save your deck to JSON files and import them later
- **Game Simulation**: Simulate starting hands and prize cards for decks with 40+ cards
- **Card Zoom**: View detailed card images
- **Card Sorting**: Organize cards in your deck by type, name, and other attributes
- **TCGPlayer Integration**: View cards on TCGPlayer for purchasing information

## APIs Used

### 1. Pokémon TCG API (api.pokemontcg.io)

Dexsy primarily uses the [Pokémon TCG API](https://docs.pokemontcg.io/) to fetch card data. This is a RESTful API that provides comprehensive information about Pokémon cards.

**Endpoints Used:**

- `GET /v2/cards` - Search for cards with various filters
- `GET /v2/sets` - Retrieve information about card sets

**Key Query Parameters:**

- `q` - Search query with syntax like `name:"*Pikachu*"` or `set.id:"swsh1"`
- `page` - Page number for pagination
- `pageSize` - Number of results per page

**Example API Call:**
```javascript
fetch(`https://api.pokemontcg.io/v2/cards?q=name:"*Pikachu*"&page=1&pageSize=20`)
```

## How to Use the App

### 1. Search for Cards

The search box supports several search formats:
- Simple card name search: Just type the card name (e.g., "Charizard")
- Set ID search: Use # prefix (e.g., "#swsh1" for Sword & Shield base set)
- Set number search: Use # prefix with set ID and card number (e.g., "#swsh1-1")
- Set name search: Use @ prefix (e.g., "@Vivid Voltage")
- Card subtype search: Use $ prefix (e.g., "$VMAX" for VMAX cards)

Special subtype searches supported:
- `$V` - V cards
- `$GX` - GX cards
- `$EX` - EX cards
- `$VSTAR` - VSTAR cards
- `$VMAX` - VMAX cards
- `$Prism` - Prism Star cards
- `$ACESPEC` - ACE SPEC cards

### 2. Deck Building

- Click the "+" button on a card to add it to your deck
- Cards in the deck display their quantity
- Use the "+" and "-" buttons on cards in your deck to adjust quantities
- Click "×" to remove the card completely from your deck
- The status indicator (✓/❌) shows if a card is already in your deck

### 3. Deck Management

- **Undo**: Restore the last removed card from your deck
- **Sort**: Organize your deck by card type, name, and other attributes
- **Clear**: Remove all cards from your deck
- **Save**: Export your deck as a JSON file
- **Import**: Load a previously saved deck

### 4. Game Simulation

For decks with at least 40 cards, you can simulate a game start:
1. Click the stacked cards button in the bottom right corner
2. The app will shuffle your deck and draw:
   - 7 cards for your hand
   - 6 cards for prizes

### 5. Deck Statistics

The statistics panel shows:
- Total card count
- Pokémon card count
- Energy card count
- Trainer card count
- Total deck price (based on TCGPlayer market prices)

## Technical Details

Dexsy is built with vanilla JavaScript, HTML5, and CSS3. It does not require any backend server and can be run directly in a web browser by opening the `index.html` file.

The application uses:
- Local storage for session persistence
- JSON file exports for deck saving
- Browser's fetch API for API calls
- CSS3 for responsive design and animations

## Getting Started

1. Clone the repository
2. Open `index.html` in your browser
3. Start building your deck!

## Notes

- Card prices are based on TCGPlayer market data embedded in the Pokémon TCG API
- The app simulates random shuffling for game starts, matching real gameplay
- Deck validation follows general Pokémon TCG rules but doesn't enforce all format-specific restrictions 