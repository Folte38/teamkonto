// OPSUCHT Marktplatz Dashboard
console.log("script-marktplatz.js geladen");

class MarketDashboard {
  constructor() {
    this.marketData = null;
    this.categories = [];
    this.filteredData = null;
    this.previousPrices = {};
    this.init();
  }

  async init() {
    await this.setupAuth();
    await this.loadMarketData();
    this.setupEventListeners();
    this.startAutoRefresh();
    this.initializeServerStatus();
  }

  async setupAuth() {
    const auth = await window.checkAuthentication();
    
    if (!auth.authenticated) {
      document.getElementById('loginPage').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
      return;
    }

    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Navigation Setup
    const currentUser = await window.getCurrentUser();
    if (currentUser) {
      const navUser = document.getElementById("navUser");
      const navUsername = document.getElementById("navUsername");
      const navAvatar = document.getElementById("navAvatar");

      if (navUser && navUsername && navAvatar) {
        navUsername.innerText = currentUser.mc_name;
        navAvatar.src = `https://mc-heads.net/avatar/${currentUser.mc_name}/64`;
        navUser.style.display = "flex";
      }
    }
  }

  async loadMarketData() {
    try {
      console.log("🔄 Lade Marktdaten...");
      
      // Lade Kategorien
      const categoriesResponse = await fetch('https://api.opsucht.net/market/categories');
      this.categories = await categoriesResponse.json();
      
      // Lade Preise
      const pricesResponse = await fetch('https://api.opsucht.net/market/prices');
      this.marketData = await pricesResponse.json();
      
      // Speichere vorherige Preise für Trend-Analyse
      if (!this.previousPrices || Object.keys(this.previousPrices).length === 0) {
        this.previousPrices = JSON.parse(JSON.stringify(this.marketData));
      }
      
      this.filteredData = this.marketData;
      
      console.log("✅ Marktdaten geladen:", this.marketData);
      
      this.updateStats();
      await this.renderItems();
      this.updateTopMovers();
      this.updateLastRefresh();
      
    } catch (error) {
      console.error("❌ Fehler beim Laden der Marktdaten:", error);
      this.showError("Marktdaten konnten nicht geladen werden");
    }
  }

  updateStats() {
    if (!this.marketData) return;

    let totalItems = 0;
    let totalPrice = 0;
    let priceChanges = { up: 0, down: 0 };

    Object.values(this.marketData).forEach(category => {
      Object.values(category).forEach(item => {
        if (item && item.length > 0) {
          totalItems++;
          
          // Verwende den BUY-Preis für Statistiken
          const buyOrder = item.find(order => order.orderSide === 'BUY');
          if (buyOrder) {
            totalPrice += buyOrder.price;
          }
        }
      });
    });

    const avgPrice = totalItems > 0 ? Math.round(totalPrice / totalItems) : 0;
    
    // Berechne Markt-Trend
    Object.entries(this.marketData).forEach(([categoryName, category]) => {
      Object.entries(category).forEach(([itemName, item]) => {
        if (item && item.length > 0) {
          const buyOrder = item.find(order => order.orderSide === 'BUY');
          if (buyOrder) {
            const key = `${categoryName}_${itemName}`;
            const previousPrice = this.getPreviousPrice(key);
            if (previousPrice && buyOrder.price > previousPrice) {
              priceChanges.up++;
            } else if (previousPrice && buyOrder.price < previousPrice) {
              priceChanges.down++;
            }
          }
        }
      });
    });

    // Update UI
    document.getElementById('totalItems').textContent = totalItems.toLocaleString();
    document.getElementById('avgPrice').textContent = avgPrice.toLocaleString() + ' $';
    
    // Markt-Trend Icon
    const trendIcon = document.getElementById('marketTrend');
    if (priceChanges.up > priceChanges.down) {
      trendIcon.textContent = '📈';
      trendIcon.title = 'Markt steigend';
    } else if (priceChanges.down > priceChanges.up) {
      trendIcon.textContent = '📉';
      trendIcon.title = 'Markt fallend';
    } else {
      trendIcon.textContent = '📊';
      trendIcon.title = 'Markt stabil';
    }
  }

  getPreviousPrice(key) {
    // Versuche vorherigen Preis zu finden
    const [categoryName, itemName] = key.split('_');
    if (this.previousPrices[categoryName] && this.previousPrices[categoryName][itemName]) {
      const previousItem = this.previousPrices[categoryName][itemName];
      const buyOrder = previousItem.find(order => order.orderSide === 'BUY');
      return buyOrder ? buyOrder.price : null;
    }
    return null;
  }

  async renderItems() {
    const grid = document.getElementById('itemsGrid');
    if (!this.filteredData) {
      grid.innerHTML = '<div class="loading">🔄 Lade Marktpreise...</div>';
      return;
    }

    let html = '';
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const activeCategory = document.querySelector('.filter-btn.active')?.dataset.category || 'all';

    Object.entries(this.filteredData).forEach(([categoryName, category]) => {
      if (activeCategory !== 'all' && categoryName !== activeCategory) return;
      
      Object.entries(category).forEach(([itemName, item]) => {
        if (!item || item.length === 0) return;
        
        if (searchTerm && !itemName.toLowerCase().includes(searchTerm)) return;

        const buyOrder = item.find(order => order.orderSide === 'BUY');
        const sellOrder = item.find(order => order.orderSide === 'SELL');
        
        if (!buyOrder && !sellOrder) return;

        const buyPrice = buyOrder ? buyOrder.price : 0;
        const sellPrice = sellOrder ? sellOrder.price : 0;
        
        // Berechne Preisänderung
        const key = `${categoryName}_${itemName}`;
        const previousPrice = this.getPreviousPrice(key);
        let priceChange = 0;
        let priceChangeClass = '';
        
        if (previousPrice && buyPrice) {
          priceChange = ((buyPrice - previousPrice) / previousPrice * 100).toFixed(1);
          if (priceChange > 0) {
            priceChangeClass = 'price-up';
          } else if (priceChange < 0) {
            priceChangeClass = 'price-down';
          }
        }

        html += `
          <div class="item-card" data-category="${categoryName}" data-item="${itemName}">
            <div class="item-header">
              <div class="item-icon">
                ${this.getItemIcon(itemName)}
              </div>
              <div class="item-title">
                <h4>${this.formatItemName(itemName)}</h4>
                <div class="item-player-heads" id="player-heads-${itemName}">
                  <!-- MC-Heads werden hier geladen -->
                </div>
              </div>
            </div>
            <div class="item-prices">
              ${buyOrder ? `<div class="price-buy">BUY: ${buyPrice.toLocaleString()} $</div>` : ''}
              ${sellOrder ? `<div class="price-sell">SELL: ${sellPrice.toLocaleString()} $</div>` : ''}
              ${priceChange !== 0 ? `
                <div class="price-change ${priceChangeClass}">
                  <span>${priceChange > 0 ? '📈' : '📉'}</span>
                  <span>${Math.abs(priceChange)}%</span>
                </div>
              ` : ''}
            </div>
            <div class="item-actions">
              <button class="item-action-btn view-btn" onclick="marketDashboard.showItemDetails('${itemName}', '${categoryName}')">📋 Details</button>
            </div>
          </div>
        `;
      });
    });

    grid.innerHTML = html || '<div class="error">Keine Items gefunden</div>';
    
    // MC-Heads für alle Items laden
    this.loadAllPlayerHeads();
  }

  async loadAllPlayerHeads() {
    // Lädt MC-Heads für alle sichtbaren Items
    const itemCards = document.querySelectorAll('.item-card');
    
    for (const card of itemCards) {
      const itemName = card.dataset.item;
      const headsContainer = document.getElementById(`player-heads-${itemName}`);
      
      if (headsContainer) {
        const playerHeads = await this.getPlayerHeadsForItem(itemName);
        headsContainer.innerHTML = playerHeads.map(head => 
          `<img src="${head.src}" alt="${head.alt}" title="${head.title}">`
        ).join('');
      }
    }
  }

  async getPlayerHeadsForItem(itemName) {
    // Lädt alle Spieler mit diesem Item aus marktplatz_entries
    const players = [];
    
    try {
      const { data: entries } = await window.supabaseClient
        .from('marktplatz_entries')
        .select('player_name')
        .ilike('item_name', itemName);
      
      if (entries && entries.length > 0) {
        // Einzigartige Spieler extrahieren
        const uniquePlayers = [...new Set(entries.map(entry => entry.player_name))];
        return uniquePlayers.map(playerName => ({
          src: `https://mc-heads.net/avatar/${playerName}/20`,
          alt: playerName,
          title: playerName
        }));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Spieler-Heads:', error);
    }
    
    return players;
  }

  updateTopMovers() {
    const moversContainer = document.getElementById('topMovers');
    if (!this.marketData) {
      moversContainer.innerHTML = '<div class="loading">🔄 Lade...</div>';
      return;
    }

    const movers = [];
    
    Object.entries(this.marketData).forEach(([categoryName, category]) => {
      Object.entries(category).forEach(([itemName, item]) => {
        if (!item || item.length === 0) return;
        
        const buyOrder = item.find(order => order.orderSide === 'BUY');
        if (!buyOrder) return;

        const key = `${categoryName}_${itemName}`;
        const previousPrice = this.getPreviousPrice(key);
        
        if (previousPrice && buyOrder.price !== previousPrice) {
          const change = ((buyOrder.price - previousPrice) / previousPrice * 100);
          movers.push({
            name: this.formatItemName(itemName),
            change: change,
            price: buyOrder.price
          });
        }
      });
    });

    // Sortiere nach größten Veränderungen
    movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    
    // Top 5 anzeigen
    const top5 = movers.slice(0, 5);
    
    let html = '';
    top5.forEach(mover => {
      const changeClass = mover.change > 0 ? 'price-up' : 'price-down';
      const changeIcon = mover.change > 0 ? '📈' : '📉';
      
      html += `
        <div class="mover-item">
          <span class="mover-name">${mover.name}</span>
          <span class="mover-change ${changeClass}">
            <span>${changeIcon}</span>
            <span>${Math.abs(mover.change).toFixed(1)}%</span>
          </span>
        </div>
      `;
    });

    moversContainer.innerHTML = html || '<div class="loading">Keine Veränderungen</div>';
  }

  updateLastRefresh() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('de-DE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    document.getElementById('lastUpdate').textContent = timeString;
  }

  getItemIcon(itemName) {
    // Simple Icon-Mapping basierend auf Item-Namen
    const iconMap = {
      'DIAMOND': '💎',
      'GOLD': '🟡',
      'IRON': '⚪',
      'EMERALD': '💚',
      'COAL': '⚫',
      'WOOD': '🪵',
      'STONE': '🪨',
      'FOOD': '🍖',
      'SWORD': '⚔️',
      'PICKAXE': '⛏️',
      'BEACON': '🔺',
      'ELYTRA': '🪂',
      'DRAGON': '🐉',
      'TOTEM': '🏺'
    };

    for (const [key, icon] of Object.entries(iconMap)) {
      if (itemName.toUpperCase().includes(key)) {
        return icon;
      }
    }
    
    return '📦'; // Default Icon
  }

  formatItemName(itemName) {
    // Wandelt TECHNICAL_NAME in Readable Name um
    return itemName
      .toLowerCase()
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  handleSearch(searchTerm) {
    if (!this.marketData) return;
    
    console.log('🔍 DEBUG: Suche nach:', searchTerm);
    
    // Live-Suche ohne Neuladen der Daten
    let filtered = {};
    const searchTermLower = searchTerm.toLowerCase();
    
    Object.entries(this.marketData).forEach(([categoryName, category]) => {
      let filteredCategory = {};
      
      Object.entries(category).forEach(([itemName, item]) => {
        if (!item || item.length === 0) return;
        
        if (itemName.toLowerCase().includes(searchTermLower)) {
          filteredCategory[itemName] = item;
        }
      });
      
      if (Object.keys(filteredCategory).length > 0) {
        filtered[categoryName] = filteredCategory;
      }
    });
    
    this.filteredData = filtered;
    this.renderItems();
  }

  setupEventListeners() {
    // Search Box
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.category));
    });

    // Refresh Button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadMarketData());
    }

    // Item Click Events
    document.addEventListener('click', (e) => {
      const itemCard = e.target.closest('.item-card');
      if (itemCard) {
        const itemName = itemCard.dataset.item;
        const categoryName = itemCard.dataset.category;
        this.showItemDetails(itemName, categoryName);
      }
    });
  }

  showItemDetails(itemName, categoryName) {
    // Modal anzeigen
    const modal = document.getElementById('itemDetailsModal');
    if (!modal) return;
    
    console.log('🔍 DEBUG: showItemDetails aufgerufen für:', itemName);
    
    // Item-Details füllen
    this.fillItemDetails(itemName, categoryName);
    
    // Spieler laden
    console.log('🔍 DEBUG: Rufe loadItemPlayers auf...');
    this.loadItemPlayers(itemName);
    
    // Spieler-Dropdown füllen
    this.loadPlayerDropdown();
    
    // Modal anzeigen
    modal.style.display = 'flex';
    
    // Event Listener für Modal
    this.setupModalEventListeners();
    
    console.log(`Item-Details für ${itemName} aus ${categoryName}`);
  }

  async loadPlayerDropdown() {
    const playerSelect = document.getElementById('playerSelect');
    if (!playerSelect) return;
    
    try {
      // Alle Spieler aus profiles Tabelle laden
      const { data: profiles, error } = await window.supabaseClient
        .from('profiles')
        .select('mc_name')
        .order('mc_name', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Spieler:', error);
        return;
      }

      // Dropdown füllen
      playerSelect.innerHTML = '<option value="">-- Spieler auswählen --</option>';
      
      profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.mc_name;
        option.textContent = profile.mc_name;
        playerSelect.appendChild(option);
      });

    } catch (error) {
      console.error('Fehler beim Laden der Spieler:', error);
    }
  }

  fillItemDetails(itemName, categoryName) {
    // Icon
    const iconElement = document.getElementById('itemModalIcon');
    iconElement.textContent = this.getItemIcon(itemName);
    
    // Name
    const nameElement = document.getElementById('itemModalName');
    nameElement.textContent = this.formatItemName(itemName);
    
    // Kategorie
    const categoryElement = document.getElementById('itemModalCategory');
    categoryElement.textContent = categoryName;
    
    // Preise aus Marktdaten holen
    if (this.marketData && this.marketData[categoryName]) {
      const item = this.marketData[categoryName][itemName];
      if (item && item.length > 0) {
        const buyOrder = item.find(order => order.orderSide === 'BUY');
        const sellOrder = item.find(order => order.orderSide === 'SELL');
        
        const buyPriceElement = document.getElementById('itemModalBuyPrice');
        const sellPriceElement = document.getElementById('itemModalSellPrice');
        
        if (buyOrder) {
          buyPriceElement.textContent = `BUY: ${buyOrder.price.toLocaleString()} $`;
        }
        if (sellOrder) {
          sellPriceElement.textContent = `SELL: ${sellOrder.price.toLocaleString()} $`;
        }
      }
    }
    
    // Modal-Titel
    const titleElement = document.getElementById('itemModalTitle');
    titleElement.textContent = `📦 ${this.formatItemName(itemName)}`;
    
    // MC-Heads der Spieler mit diesem Item laden
    console.log('Lade MC-Heads für Item:', itemName);
    this.loadItemPlayerHeads(itemName);
  }

  async loadItemPlayerHeads(itemName) {
    const playersContainer = document.getElementById('itemModalPlayers');
    if (!playersContainer) {
      console.error('itemModalPlayers Element nicht gefunden!');
      return;
    }
    
    console.log('Starte MC-Heads Laden für Item:', itemName);
    
    try {
      // DEBUG: Prüfen welche Items in der Datenbank existieren
      const { data: allEntries, error: allError } = await window.supabaseClient
        .from('marktplatz_entries')
        .select('item_name, player_name')
        .limit(10);

      if (allError) {
        console.error('Fehler beim Laden aller Einträge:', allError);
        return;
      }
      
      console.log('Alle Einträge in DB:', allEntries);
      
      // Alle Einträge für dieses Item laden (case-insensitive)
      const { data: entries, error } = await window.supabaseClient
        .from('marktplatz_entries')
        .select('player_name')
        .ilike('item_name', itemName);

      if (error) {
        console.error('Fehler beim Laden der Spieler-Heads:', error);
        return;
      }

      console.log('Gefundene Einträge für', itemName, ':', entries);

      // Einzigartige Spieler-Namen extrahieren
      const uniquePlayers = [...new Set(entries.map(entry => entry.player_name))];
      console.log('Einzigartige Spieler:', uniquePlayers);
      
      // MC-Heads anzeigen
      playersContainer.innerHTML = '';
      uniquePlayers.forEach(playerName => {
        console.log('Füge MC-Head hinzu für:', playerName);
        const headImg = document.createElement('img');
        headImg.src = `https://mc-heads.net/avatar/${playerName}/20`;
        headImg.alt = playerName;
        headImg.title = playerName;
        headImg.className = 'item-modal-player-head';
        playersContainer.appendChild(headImg);
      });

      console.log('MC-Heads erfolgreich hinzugefügt');

    } catch (error) {
      console.error('Fehler beim Laden der Spieler-Heads:', error);
    }
  }

  async loadItemPlayers(itemName) {
    const playersList = document.getElementById('itemPlayersList');
    if (!playersList) {
      console.log('🔍 ERROR: itemPlayersList Element nicht gefunden!');
      return;
    }
    
    console.log('🔍 DEBUG: loadItemPlayers aufgerufen für:', itemName);
    playersList.innerHTML = '<div class="loading">🔄 Lade Spieler...</div>';
    
    try {
      // Hier würde die Datenbank-Abfrage für Spieler mit diesem Item stehen
      // Für jetzt simulieren wir einige Beispiel-Spieler
      const players = await this.getPlayersForItem(itemName);
      
      console.log('🔍 DEBUG: getPlayersForItem Ergebnis:', players);
      
      if (players.length === 0) {
        playersList.innerHTML = '<div class="loading">Keine Spieler mit diesem Item gefunden</div>';
        return;
      }
      
      // DEBUG: Aktuellen Benutzer und seine Rolle prüfen
      console.log('🔍 DEBUG: Rufe getCurrentUser auf...');
      const currentUser = await this.getCurrentUser();
      console.log('🔍 DEBUG: Aktueller Benutzer:', currentUser);
      console.log('🔍 DEBUG: Benutzer-Rolle:', currentUser?.role);
      
      // Prüfen ob aktueller Benutzer Admin ist (mit Fallback)
      const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.mc_name === 'TobiWanNoobie'); // Fallback für Tests
      
      console.log('🔍 DEBUG: Ist Admin?', isAdmin);
      
      let html = '';
      players.forEach(player => {
        const createdDate = new Date(player.created_at).toLocaleDateString('de-DE');
        const createdTime = new Date(player.created_at).toLocaleTimeString('de-DE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        // Prüfen ob der aktuelle Benutzer der Eintrags-Eigentümer ist
        const isOwner = currentUser && currentUser.mc_name === player.name;
        
        console.log('🔍 DEBUG: Spieler:', player.name, 'Ist Owner?', isOwner, 'Show Button?', isOwner || isAdmin);
        
        html += `
          <div class="player-item">
            <img class="player-avatar" src="https://mc-heads.net/avatar/${player.name}/64" alt="${player.name}">
            <div class="player-info">
              <div class="player-name">${player.name}</div>
              <div class="player-amount">Menge: ${player.amount}</div>
              ${player.note ? `<div class="player-note">${player.note}</div>` : ''}
              <div class="player-date">Eingetragen: ${createdDate} ${createdTime}</div>
            </div>
            <div class="player-actions">
              ${(isOwner || isAdmin) ? `
                <button class="player-action-btn delete-btn" onclick="marketDashboard.removePlayerEntry('${player.name}', '${itemName}')">
                  🗑️ Entfernen
                </button>
              ` : ''}
            </div>
          </div>
        `;
      });
      
      console.log('🔍 DEBUG: HTML wird gesetzt, Länge:', html.length);
      playersList.innerHTML = html;
      console.log('🔍 DEBUG: HTML gesetzt!');
      
    } catch (error) {
      console.error('🔍 ERROR: Fehler beim Laden der Spieler:', error);
      playersList.innerHTML = '<div class="error">Fehler beim Laden der Spieler</div>';
    }
  }

  async removePlayerEntry(playerName, itemName) {
    if (!confirm(`Möchtest du den Eintrag von ${playerName} für ${itemName} wirklich entfernen?`)) {
      return;
    }

    try {
      // DEBUG: Aktuellen Benutzer und seine Rolle prüfen
      const currentUser = await this.getCurrentUser();
      console.log('🗑️ DEBUG: Entfernen - Aktueller Benutzer:', currentUser);
      console.log('🗑️ DEBUG: Entfernen - Benutzer-Rolle:', currentUser?.role);
      
      // Prüfen ob der Benutzer berechtigt ist (mit Fallback)
      const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.mc_name === 'TobiWanNoobie'); // Fallback für Tests
      const isOwner = currentUser && currentUser.mc_name === playerName;
      
      console.log('🗑️ DEBUG: Entfernen - Ist Admin?', isAdmin);
      console.log('🗑️ DEBUG: Entfernen - Ist Owner?', isOwner);
      
      if (!isAdmin && !isOwner) {
        console.log('🗑️ Keine Berechtigung zum Entfernen');
        this.showNotification('Du bist nicht berechtigt, diesen Eintrag zu entfernen', 'error');
        return;
      }

      console.log('🗑️ DEBUG: Lösche Eintrag aus Datenbank...');
      console.log('🗑️ DEBUG: playerName:', playerName);
      console.log('🗑️ DEBUG: itemName:', itemName);

      // 🔥 FIX: Case-insensitive Löschung
      const { data: deletedEntry, error } = await window.supabaseClient
        .from('marktplatz_entries')
        .delete()
        .ilike('player_name', playerName) // Case-insensitive
        .ilike('item_name', itemName)   // Case-insensitive
        .select(); // Rückgabe des gelöschten Eintrags

      if (error) {
        console.error('🗑️ Fehler beim Entfernen des Eintrags:', error);
        this.showNotification('Fehler beim Entfernen des Eintrags', 'error');
        return;
      }

      console.log('🗑️ DEBUG: Gelöschter Eintrag:', deletedEntry);

      if (!deletedEntry || deletedEntry.length === 0) {
        console.log('🗑️ DEBUG: Kein Eintrag zum Löschen gefunden');
        this.showNotification('Kein Eintrag zum Löschen gefunden', 'error');
        return;
      }

      // Erfolgsmeldung
      this.showNotification(`✅ Eintrag von ${playerName} wurde entfernt`, 'success');
      
      // 🔥 LIVE-UPDATES - Alle Ansichten sofort aktualisieren
      console.log('🔄 LIVE-UPDATES: Starte nach Entfernen...');
      
      // 1. Spieler-Liste im Modal aktualisieren
      await this.loadItemPlayers(itemName);
      
      // 2. MC-Heads im Modal aktualisieren
      await this.loadItemPlayerHeads(itemName);
      
      // 3. Haupt-Grid aktualisieren (für MC-Heads)
      await this.renderItems();
      
      console.log('🔄 LIVE-UPDATES: Alle Ansichten nach Entfernen aktualisiert!');

    } catch (error) {
      console.error('🗑️ Fehler beim Entfernen des Eintrags:', error);
      this.showNotification('Fehler beim Entfernen des Eintrags', 'error');
    }
  }

  async getCurrentUser() {
    try {
      const user = await window.getCurrentUser();
      return user;
    } catch (error) {
      console.error('Fehler beim Abrufen des aktuellen Benutzers:', error);
      return null;
    }
  }

  async getPlayersForItem(itemName) {
    try {
      // Echte Datenbank-Abfrage für Marktplatz-Einträge (case-insensitive)
      console.log(' DEBUG: getPlayersForItem suche nach:', itemName);
      const { data: entries, error } = await window.supabaseClient
        .from('marktplatz_entries')
        .select('player_name, amount, note, created_at')
        .ilike('item_name', itemName) // Case-insensitive Suche wie bei MC-Heads
        .order('created_at', { ascending: false });

      console.log(' DEBUG: getPlayersForItem Ergebnis:', entries);
      
      if (error) {
        console.error('Fehler beim Laden der Marktplatz-Einträge:', error);
        return [];
      }

      // Einzigartige Spieler mit allen Daten zurückgeben
      const uniquePlayers = entries.map(entry => ({
        name: entry.player_name,
        amount: entry.amount,
        note: entry.note || '',
        created_at: entry.created_at
      }));
      
      console.log(' DEBUG: Einzigartige Spieler mit Daten:', uniquePlayers);
      return uniquePlayers;

    } catch (error) {
      console.error('Fehler bei der Datenbank-Abfrage:', error);
      return [];
    }
  }

  setupModalEventListeners() {
    // Modal schließen
    const closeBtn = document.getElementById('closeItemModalBtn');
    const cancelBtn = document.getElementById('cancelItemEntryBtn');
    const modalOverlay = document.getElementById('itemDetailsModal');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
      });
    }
    
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
      });
    }
    
    // Overlay klick zum Schließen
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
      }
    });
    
    // Eintragen Formular
    const entryForm = document.getElementById('itemEntryForm');
    if (entryForm) {
      entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleItemEntry();
      });
    }
  }

  async handleItemEntry() {
    const playerSelect = document.getElementById('playerSelect');
    const playerName = playerSelect.value.trim();
    const amount = parseInt(document.getElementById('itemAmount').value);
    const note = document.getElementById('itemNote').value.trim();
    const itemName = document.getElementById('itemModalName').textContent;
    const categoryName = document.getElementById('itemModalCategory').textContent;
    
    if (!playerName || !amount) {
      this.showNotification('Bitte Spieler auswählen und Menge eingeben', 'error');
      return;
    }
    
    try {
      // Neuen Eintrag in marktplatz_entries Tabelle erstellen
      const { data: newEntry, error: insertError } = await window.supabaseClient
        .from('marktplatz_entries')
        .insert({
          item_name: itemName,
          category: categoryName,
          player_name: playerName,
          amount: amount,
          note: note || null
        })
        .select()
        .single();

      if (insertError) {
        console.error('Fehler beim Einfügen:', insertError);
        this.showNotification('Fehler beim Speichern in der Datenbank', 'error');
        return;
      }

      // Erfolgsmeldung
      this.showNotification(`✅ ${playerName} wurde mit ${amount}x ${itemName} ${note ? `(${note})` : ''} eingetragen`, 'success');
      
      // Formular zurücksetzen
      document.getElementById('itemEntryForm').reset();
      
      // 🔥 LIVE-UPDATES - Alle Ansichten sofort aktualisieren
      console.log('🔄 LIVE-UPDATES: Starte nach Eintrag...');
      
      // 1. Spieler-Liste im Modal aktualisieren
      await this.loadItemPlayers(itemName);
      
      // 2. MC-Heads im Modal aktualisieren
      await this.loadItemPlayerHeads(itemName);
      
      // 3. Haupt-Grid aktualisieren (für MC-Heads)
      await this.renderItems();
      
      // 4. Modal NICHT schließen, damit man die Änderungen sieht
      
      console.log('🔄 LIVE-UPDATES: Alle Ansichten aktualisiert!');

    } catch (error) {
      console.error('Fehler beim Eintragen:', error);
      this.showNotification('Fehler beim Eintragen', 'error');
    }
  }

  showNotification(message, type = 'info') {
    // Visuelle Notification erstellen (wie bei anderen Seiten)
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease;
      font-weight: 500;
      max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  startAutoRefresh() {
    // Alle 30 Sekunden automatisch aktualisieren
    setInterval(() => {
      console.log("🔄 Auto-Refresh...");
      this.loadMarketData();
    }, 30000);
  }

  // SERVER STATUS
  initializeServerStatus() {
    this.updateServerStatus();
    setInterval(this.updateServerStatus, 30000);
  }

  async updateServerStatus() {
    try {
      const response = await fetch('https://api.mcstatus.io/v2/status/java/opsucht.net');
      const data = await response.json();
      
      if (data && data.online) {
        this.updateServerDisplay('online', data.players?.online || 0);
      } else {
        this.updateServerDisplay('offline', 0);
      }
    } catch (error) {
      this.updateServerDisplay('error', 0);
    }
  }

  updateServerDisplay(status, playerCount) {
    const statusIcon = document.getElementById('serverStatusIcon');
    const statusText = document.getElementById('serverStatusText');
    const countText = document.getElementById('serverCountText');
    
    if (!statusIcon || !statusText || !countText) return;
    
    switch (status) {
      case 'online':
        statusIcon.textContent = '🟢';
        statusText.textContent = 'Online';
        countText.textContent = playerCount;
        break;
      case 'offline':
        statusIcon.textContent = '🔴';
        statusText.textContent = 'Offline';
        countText.textContent = '0';
        break;
      case 'error':
        statusIcon.textContent = '🟡';
        statusText.textContent = 'Fehler';
        countText.textContent = '?';
        break;
    }
  }
}

// Init Dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.marketDashboard = new MarketDashboard();
});

// Export für andere Skripte
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarketDashboard;
}
