document.addEventListener("DOMContentLoaded", async function() {
  // Navigation SOFORT anzeigen
  showNavigation();
  
  const auth = await window.checkAuthentication();
  
  if (!auth.authenticated) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Session-Change Listener für sofortige Navigation-Updates
    if (window.setupSessionChangeListener) {
      window.setupSessionChangeListener();
    }
    
    initializeApp();
    initializeServerStatus();
    
    // Login-Benachrichtigung prüfen (einmalig pro Session)
    if (window.checkAndSendLoginNotification) {
      setTimeout(() => {
        window.checkAndSendLoginNotification();
      }, 1000);
    }
  }
});

// EINFACHE NAVIGATION - AKTUELLE SESSION DATEN VERWENDEN
async function showNavigation() {
  console.log("🔍 showNavigation() aufgerufen");
  
  const navUser = document.getElementById("navUser");
  const navUsername = document.getElementById("navUsername");
  const navAvatar = document.getElementById("navAvatar");

  console.log("🔍 Navigation Elemente:", { navUser: !!navUser, navUsername: !!navUsername, navAvatar: !!navAvatar });

  if (navUser && navUsername && navAvatar) {
    // AKTUELLE SESSION DATEN LADEN - nicht hartcodiert
    try {
      const currentUser = await window.getCurrentUser();
      if (currentUser && currentUser.mc_name) {
        navUsername.innerText = currentUser.mc_name;
        navAvatar.src = `https://mc-heads.net/avatar/${currentUser.mc_name}/64`;
        navUser.style.display = "flex";
        
        console.log("✅ Navigation mit aktuellen Session-Daten angezeigt:", currentUser.mc_name);
        console.log("✅ MC-Kopf:", navAvatar.src);
        console.log("✅ Username:", navUsername.innerText);
        console.log("✅ Display:", navUser.style.display);
        
        // Globale Variablen aktualisieren
        window.CURRENT_USER_ID = currentUser.id;
        window.CURRENT_MC_NAME = currentUser.mc_name;
        window.IS_ADMIN = currentUser.role === "admin";
        
        return true;
      }
    } catch (error) {
      console.error("❌ Fehler beim Laden der aktuellen Session:", error);
    }
    
    // Fallback: localStorage auslesen
    const sessionData = localStorage.getItem('currentSession');
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        navUsername.innerText = parsed.mc_name || 'Unbekannt';
        navAvatar.src = `https://mc-heads.net/avatar/${parsed.mc_name || 'Steve'}/64`;
        navUser.style.display = "flex";
        
        console.log("✅ Navigation mit localStorage Daten angezeigt:", parsed.mc_name);
        return true;
      } catch (error) {
        console.error("❌ Fehler beim Lesen der Session:", error);
      }
    }
    
    // Letzter Fallback: Gerry237
    navUsername.innerText = "Gerry237";
    navAvatar.src = "https://mc-heads.net/avatar/Gerry237/64";
    navUser.style.display = "flex";
    console.log("✅ Navigation Fallback angezeigt: Gerry237");
    
  } else {
    console.error("❌ Navigation Elemente nicht gefunden!");
    return false;
  }
}

// SESSION-CHANGE LISTENER - Navigation sofort aktualisieren
function setupSessionChangeListener() {
  // Überwache Auth-Änderungen alle 2 Sekunden
  setInterval(async () => {
    try {
      const auth = await window.checkAuthentication();
      const currentUser = await window.getCurrentUser();
      
      if (auth.authenticated && currentUser) {
        // Navigation sofort aktualisieren
        await updateNavigationImmediate(currentUser);
      }
    } catch (error) {
      console.error("Session-Check Fehler:", error);
    }
  }, 2000);
}

// Navigation sofort aktualisieren
async function updateNavigationImmediate(currentUser) {
  // Für additional_password Methode müssen wir das Profil anders laden
  let profile;
  if (currentUser.method === 'additional_password') {
    profile = currentUser; // Profil ist bereits in getCurrentUser geladen
  } else {
    // Supabase Methode - altes Verhalten
    const { data: profileData, error } = await window.supabaseClient
      .from("profiles")
      .select("mc_name, role")
      .eq("id", currentUser.id)
      .single();

    if (error || !profileData) return;
    profile = profileData;
  }

  // Navigation sofort aktualisieren
  const navUser = document.getElementById("navUser");
  const navUsername = document.getElementById("navUsername");
  const navAvatar = document.getElementById("navAvatar");

  if (navUser && navUsername && navAvatar) {
    const currentName = navUsername.innerText;
    const newName = profile.mc_name;
    
    // Nur aktualisieren wenn sich der Name geändert hat
    if (currentName !== newName) {
      console.log(`🔄 Navigation aktualisiert: ${currentName} → ${newName}`);
      navUsername.innerText = newName;
      navAvatar.src = `https://mc-heads.net/avatar/${newName}/64`;
      navUser.style.display = "flex";
      
      // Globale Variablen aktualisieren
      CURRENT_USER_ID = currentUser.id;
      CURRENT_MC_NAME = newName;
      IS_ADMIN = profile.role === "admin";
    }
  }
}

// =========================
// SERVER STATUS FUNKTIONEN
// =========================
function initializeServerStatus() {
  updateServerStatus();
  // Alle 30 Sekunden aktualisieren
  setInterval(updateServerStatus, 30000);
}

async function updateServerStatus() {
  try {
    // mcstatus.io API für Java-Server
    const response = await fetch('https://api.mcstatus.io/v2/status/java/opsucht.net');
    const data = await response.json();
    
    if (data && data.online) {
      updateServerDisplay('online', data.players?.online || 0);
    } else {
      updateServerDisplay('offline', 0);
    }
  } catch (error) {
    console.error('Fehler beim Abrufen des Server-Status:', error);
    updateServerDisplay('error', 0);
  }
}

function updateServerDisplay(status, playerCount) {
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

// =========================
// APP INITIALISIERUNG (wird nur bei eingeloggten Nutzern aufgerufen)
// =========================
function initializeApp() {
  loadProfile().then(() => {
    loadAllProfiles().then(() => {
      loadPlayers();
      loadTeamItems();
      setupEventListeners();
      addGlobalEventListeners();
    });
  });
}

// =========================
// GLOBALS
// =========================
let CURRENT_USER_ID = null;
let CURRENT_MC_NAME = null;
let IS_ADMIN = false;
let SELECTED_PLAYER = null;
let SEARCH_TERM = '';
let ALL_PLAYERS = [];
let ALL_PROFILES = [];
let AUTH_METHOD = null; // Neue Variable für Auth-Methode

// =========================
// PROFIL & NAV - KOMPLETT ÜBERARBEITET
async function loadProfile() {
  const currentUser = await window.getCurrentUser();
  if (!currentUser) return Promise.resolve();

  console.log("🔍 loadProfile() currentUser:", currentUser);

  // PROFIL-DIREKT VERWENDEN - keine zusätzliche Datenbankabfragen
  let profile;
  if (currentUser.method === 'additional_password') {
    profile = currentUser; // Profil ist bereits in getCurrentUser geladen
    console.log("✅ loadProfile(): Additional Password Profil verwendet:", profile.mc_name);
  } else {
    // Supabase Methode - currentUser enthält bereits alle Daten
    profile = {
      mc_name: currentUser.mc_name,
      role: currentUser.role
    };
    console.log("✅ loadProfile(): Supabase Profil erstellt:", profile.mc_name);
  }

  // GLOBALE VARIABLEN SETZEN
  CURRENT_USER_ID = currentUser.id;
  CURRENT_MC_NAME = profile.mc_name;
  IS_ADMIN = profile.role === "admin";

  // GLOBALE VARIABLEN ALS WINDOW VARIABLEN SETZEN
  window.CURRENT_USER_ID = currentUser.id;
  window.CURRENT_MC_NAME = profile.mc_name;
  window.IS_ADMIN = profile.role === "admin";

  console.log("✅ loadProfile(): Globale Variablen gesetzt:", {
    CURRENT_USER_ID,
    CURRENT_MC_NAME,
    IS_ADMIN
  });

  console.log("✅ loadProfile(): Window Variablen gesetzt:", {
    window_CURRENT_USER_ID: window.CURRENT_USER_ID,
    window_CURRENT_MC_NAME: window.CURRENT_MC_NAME,
    window_IS_ADMIN: window.IS_ADMIN
  });

  // Navigation IMMER aktualisieren
  const navUser = document.getElementById("navUser");
  const navUsername = document.getElementById("navUsername");
  const navAvatar = document.getElementById("navAvatar");

  if (navUser) {
    navUsername.innerText = profile.mc_name;
    navAvatar.src = `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
    console.log("✅ Navigation aktualisiert (loadProfile):", profile.mc_name);
  } else {
    console.error("❌ navUser Element nicht gefunden!");
  }

  // Formular vorausfüllen
  const creditUser = document.getElementById("creditUser");
  if (creditUser) {
    creditUser.value = profile.mc_name;
  }

  // Logout-Button anzeigen
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.style.display = "block";
  }
} // Hier fehlte eine schließende Klammer

// =========================
// ALLE PROFILE LADEN
// =========================
async function loadAllProfiles() {
  const { data: profiles } = await window.supabaseClient
    .from("profiles")
    .select("id, mc_name")
    .order("mc_name");

  if (profiles) {
    ALL_PROFILES = profiles;
  }
}

// =========================
// SPIELER LADEN FÜR AUSWAHL
// =========================
async function loadPlayers() {
  const { data: items } = await window.supabaseClient
    .from("team_items")
    .select("storage")
    .order("storage");

  ALL_PLAYERS = ALL_PROFILES.map(p => p.mc_name).sort();
  
  const playerGrid = document.getElementById('playerSelectionGrid');
  if (playerGrid) {
    updatePlayerSelectionGrid(playerGrid, ALL_PLAYERS, 'player-select-item');
  }

  const ownerGrid = document.getElementById('ownerSelectionGrid');
  if (ownerGrid) {
    updatePlayerSelectionGrid(ownerGrid, ALL_PLAYERS, 'owner-select-item');
  }
}

// =========================
// HELPER: SPIELER-GRID AKTUALISIEREN
// =========================
function updatePlayerSelectionGrid(container, players, itemClass) {
  container.innerHTML = '';
  
  players.forEach(player => {
    const item = document.createElement('div');
    item.className = itemClass;
    item.dataset.player = player;
    item.innerHTML = `
      <img src="https://mc-heads.net/avatar/${player}/64" 
           class="${itemClass.includes('owner') ? 'owner-avatar' : 'player-select-avatar'}" 
           alt="${player}">
      <div class="${itemClass.includes('owner') ? 'owner-name' : 'player-select-name'}">${player}</div>
    `;
    
    item.addEventListener('click', () => {
      // Visuelles Feedback für Auswahl
      if (container.id === 'ownerSelectionGrid' || container.id === 'editOwnerSelectionGrid') {
        // Entferne Auswahl von allen anderen Elementen im selben Container
        document.querySelectorAll(`#${container.id} .${itemClass}`).forEach(el => {
          el.classList.remove('selected');
        });
        
        // Füge Auswahl zum geklickten Element hinzu
        item.classList.add('selected');
        
        // Zeige Feedback für die Auswahl
        const isEditModal = container.id === 'editOwnerSelectionGrid';
        const feedbackText = isEditModal 
          ? `Neuer Besitzer ausgewählt: ${player}` 
          : `${player} als Besitzer ausgewählt`;
        
        if (isEditModal) {
          showEditMessage(feedbackText, 'success');
        }
        
        // Füge temporären Fokus zum Container hinzu
        container.classList.add('focused');
        setTimeout(() => {
          container.classList.remove('focused');
        }, 1500);
      } else {
        // Normale Spieler-Auswahl für Single View
        document.querySelectorAll('.player-select-item').forEach(el => {
          el.classList.remove('selected');
        });
        item.classList.add('selected');
        SELECTED_PLAYER = player;
        switchToSingleView();
      }
    });
    
    container.appendChild(item);
  });
}

// =========================
// ZU EINZELANSICHT WECHSELN
// =========================
function switchToSingleView() {
  if (!SELECTED_PLAYER) {
    alert('Bitte wähle zuerst einen Spieler aus!');
    return;
  }
  
  document.getElementById('viewAllBtn').classList.remove('active');
  document.getElementById('viewSingleBtn').classList.add('active');
  
  const playerContainer = document.getElementById('playerSelectionContainer');
  if (playerContainer) {
    playerContainer.style.display = 'none';
  }
  
  updateActiveFilters();
  loadTeamItems();
}

// =========================
// ZU GRID-ANSICHT WECHSELN
// =========================
function switchToGridView() {
  SELECTED_PLAYER = null;
  SEARCH_TERM = '';
  
  document.getElementById('viewAllBtn').classList.add('active');
  document.getElementById('viewSingleBtn').classList.remove('active');
  
  const playerContainer = document.getElementById('playerSelectionContainer');
  if (playerContainer) {
    playerContainer.style.display = 'block';
  }
  
  const searchInput = document.getElementById('itemSearchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  
  const activeFilters = document.getElementById('activeFilters');
  if (activeFilters) {
    activeFilters.style.display = 'none';
  }
  
  loadTeamItems();
}

// =========================
// AKTIVE FILTER ANZEIGEN
// =========================
function updateActiveFilters() {
  const activeFilters = document.getElementById('activeFilters');
  const filterTags = document.getElementById('filterTags');
  
  if (!activeFilters || !filterTags) return;
  
  const filters = [];
  
  if (SELECTED_PLAYER) {
    filters.push({
      type: 'player',
      label: SELECTED_PLAYER,
      icon: `https://mc-heads.net/avatar/${SELECTED_PLAYER}/24`
    });
  }
  
  if (SEARCH_TERM) {
    filters.push({
      type: 'search',
      label: `"${SEARCH_TERM}"`,
      icon: '🔍'
    });
  }
  
  if (filters.length > 0) {
    activeFilters.style.display = 'block';
    
    filterTags.innerHTML = filters.map(filter => `
      <div class="filter-tag">
        ${filter.icon.startsWith('http') ? `<img src="${filter.icon}" alt="${filter.label}">` : filter.icon}
        ${filter.label}
      </div>
    `).join('');
  } else {
    activeFilters.style.display = 'none';
  }
}

// =========================
// MODAL FUNKTIONEN FÜR BESTÄTIGUNGEN
// =========================
function showConfirmModal(title, message, confirmText, cancelText, onConfirm) {
  // Modal und Overlay erstellen, falls nicht vorhanden
  let modal = document.getElementById('confirmModal');
  let overlay = document.getElementById('confirmOverlay');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'confirm-modal';
    modal.innerHTML = `
      <div class="confirm-modal-content">
        <h3 class="confirm-modal-title"></h3>
        <div class="confirm-modal-message"></div>
        <div class="confirm-modal-actions">
          <button class="confirm-btn cancel-btn"></button>
          <button class="confirm-btn confirm-btn-primary"></button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirmOverlay';
    overlay.className = 'confirm-overlay';
    document.body.appendChild(overlay);
  }
  
  // Modal-Inhalt setzen
  modal.querySelector('.confirm-modal-title').textContent = title;
  modal.querySelector('.confirm-modal-message').textContent = message;
  modal.querySelector('.cancel-btn').textContent = cancelText || 'Abbrechen';
  modal.querySelector('.confirm-btn-primary').textContent = confirmText || 'Bestätigen';
  
  // Event-Handler für Bestätigung
  const confirmBtn = modal.querySelector('.confirm-btn-primary');
  const cancelBtn = modal.querySelector('.cancel-btn');
  
  const closeModal = () => {
    modal.style.display = 'none';
    overlay.style.display = 'none';
  };
  
  const confirmHandler = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  
  const cancelHandler = () => {
    closeModal();
  };
  
  // Alte Event-Listener entfernen
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  
  // Neue Event-Listener setzen
  modal.querySelector('.confirm-btn-primary').addEventListener('click', confirmHandler);
  modal.querySelector('.cancel-btn').addEventListener('click', cancelHandler);
  overlay.addEventListener('click', cancelHandler);
  
  // ESC-Taste zum Schließen
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cancelHandler();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // Modal anzeigen
  modal.style.display = 'block';
  overlay.style.display = 'block';
}

// =========================
// ITEMS LADEN MIT FILTER
// =========================
async function loadTeamItems() {
  const container = document.getElementById("teamItems");
  if (!container) return;

  console.log('=== Lade Team Items ===');
  console.log('CURRENT_USER_ID:', CURRENT_USER_ID);
  console.log('CURRENT_MC_NAME:', CURRENT_MC_NAME);
  console.log('IS_ADMIN:', IS_ADMIN);

  try {
    const { data: items, error: itemsError } = await window.supabaseClient
      .from("team_items")
      .select("id, name, storage")
      .order("storage")
      .order("name");

    if (itemsError) {
      console.error('Fehler beim Laden von team_items:', itemsError);
      console.error('Fehler Details:', {
        message: itemsError.message,
        details: itemsError.details,
        hint: itemsError.hint,
        code: itemsError.code
      });
      container.innerHTML = '<p class="no-items">Fehler beim Laden der Items: ' + itemsError.message + '</p>';
      return;
    }

    console.log('Gefundene Items:', items?.length || 0);
    if (items && items.length > 0) {
      console.log('Beispiel-Item:', items[0]);
    }

    const { data: usage, error: usageError } = await window.supabaseClient
      .from("team_item_usage")
      .select("item_id, user_id, profiles ( mc_name )");

    if (usageError) {
      console.error('Fehler beim Laden von team_item_usage:', usageError);
      console.error('Usage Fehler Details:', {
        message: usageError.message,
        details: usageError.details,
        hint: usageError.hint,
        code: usageError.code
      });
    } else {
      console.log('Gefundene Usage-Einträge:', usage?.length || 0);
    }

    let filteredItems = items || [];
    
    if (SELECTED_PLAYER) {
      filteredItems = filteredItems.filter(item => item.storage === SELECTED_PLAYER);
    }
    
    if (SEARCH_TERM) {
      filteredItems = filteredItems.filter(item => 
        item.name.toLowerCase().includes(SEARCH_TERM.toLowerCase()) ||
        item.storage.toLowerCase().includes(SEARCH_TERM.toLowerCase())
      );
    }

    console.log('Gefilterte Items:', filteredItems.length);

    const byStorage = {};
    filteredItems.forEach(item => {
      if (!byStorage[item.storage]) byStorage[item.storage] = [];
      byStorage[item.storage].push(item);
    });

    container.innerHTML = '';

    // EINZELANSICHT
    if (SELECTED_PLAYER) {
      const playerItems = byStorage[SELECTED_PLAYER] || [];
      
      const backBtn = document.createElement('button');
      backBtn.className = 'back-to-grid';
      backBtn.innerHTML = '← Zurück zur Übersicht';
      backBtn.addEventListener('click', switchToGridView);
      container.appendChild(backBtn);
      
      const singleView = document.createElement('div');
      singleView.className = 'single-player-view';
      singleView.innerHTML = `
        <div class="single-player-header">
          <img src="https://mc-heads.net/body/${SELECTED_PLAYER}/256" 
               class="single-player-avatar" 
               alt="${SELECTED_PLAYER}">
          <div class="single-player-info">
            <div class="single-player-name">${SELECTED_PLAYER}</div>
            <div class="single-player-stats">${playerItems.length} Items verfügbar</div>
          </div>
        </div>
        <div class="player-items">
      `;
      
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'player-items';
      itemsContainer.style.display = 'grid';
      itemsContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
      itemsContainer.style.gap = '12px';
      
      if (playerItems.length === 0) {
        itemsContainer.innerHTML = '<div class="no-items">Keine Items vorhanden</div>';
      } else {
        playerItems.forEach(item => {
          const holder = usage.find(u => u.item_id === item.id);
          let statusHtml = "";
          let isMine = false;
          let isHighlighted = SEARCH_TERM && item.name.toLowerCase().includes(SEARCH_TERM.toLowerCase());

          if (!holder) {
            statusHtml = `<div class="item-available">verfügbar</div>`;
          } else {
            const name = holder.profiles?.mc_name || "Unbekannt";
            isMine = AUTH_METHOD === 'additional_password' 
            ? (holder.profiles?.mc_name === CURRENT_MC_NAME) 
            : (holder.user_id === CURRENT_USER_ID);

            statusHtml = `
              <div class="item-holder">
                <img src="https://mc-heads.net/avatar/${name}/24">
                <span>ausgeliehen von ${name}</span>
                ${
                  IS_ADMIN && !isMine
                    ? `<span class="remove-holder"
                            data-item="${item.id}"
                            data-user="${holder.user_id}">✕</span>`
                    : ""
                }
              </div>
            `;
          }

          // Minimalistischer Entfernen-Button
          const removeButtonHtml = IS_ADMIN 
            ? `<button class="remove-item-btn admin-only" title="Item entfernen">×</button>`
            : '';

          // Edit-Button für Admins
          const editButtonHtml = IS_ADMIN 
            ? `<button class="edit-item-btn admin-only" title="Item bearbeiten">✏️</button>`
            : '';

          const itemElement = document.createElement('div');
          itemElement.className = `team-item ${isMine ? "mine" : ""} ${isHighlighted ? "item-highlight" : ""}`;
          itemElement.dataset.id = item.id;
          itemElement.dataset.name = item.name;
          itemElement.dataset.owner = item.storage;
          itemElement.innerHTML = `
            ${removeButtonHtml}
            ${editButtonHtml}
            <div class="item-name">${item.name}</div>
            ${statusHtml}
          `;
          
          itemsContainer.appendChild(itemElement);
        });
      }
      
      container.appendChild(singleView);
      singleView.appendChild(itemsContainer);
      
      return;
    }

    // GRID-ANSICHT
    const playersToShow = SEARCH_TERM 
      ? ALL_PLAYERS.filter(player => 
          player.toLowerCase().includes(SEARCH_TERM.toLowerCase()) ||
          (byStorage[player] && byStorage[player].some(item => 
            item.name.toLowerCase().includes(SEARCH_TERM.toLowerCase())
          ))
        )
      : ALL_PLAYERS;

    playersToShow.forEach(player => {
      const playerItems = byStorage[player] || [];
      const hasMatchingItems = SEARCH_TERM 
        ? playerItems.some(item => item.name.toLowerCase().includes(SEARCH_TERM.toLowerCase()))
        : true;

      if (SEARCH_TERM && !hasMatchingItems && !player.toLowerCase().includes(SEARCH_TERM.toLowerCase())) {
        return;
      }

      let rowHtml = `
        <div class="player-row">
          <div class="player-avatar">
            <img src="https://mc-heads.net/body/${player}/256">
            <div class="player-name">${player}</div>
          </div>

          <div class="player-items">
      `;

      if (playerItems.length === 0) {
        rowHtml += `
          <div class="no-items-message">
            Keine Items vorhanden
          </div>
        `;
      } else {
        playerItems.forEach(item => {
          const holder = usage.find(u => u.item_id === item.id);
          let statusHtml = "";
          let isMine = false;
          let isHighlighted = SEARCH_TERM && item.name.toLowerCase().includes(SEARCH_TERM.toLowerCase());

          if (!holder) {
            statusHtml = `<div class="item-available">verfügbar</div>`;
          } else {
            const name = holder.profiles?.mc_name || "Unbekannt";
            isMine = AUTH_METHOD === 'additional_password' 
  ? (holder.profiles?.mc_name === CURRENT_MC_NAME) 
  : (holder.user_id === CURRENT_USER_ID);

            statusHtml = `
              <div class="item-holder">
                <img src="https://mc-heads.net/avatar/${name}/24">
                <span>ausgeliehen von ${name}</span>
                ${
                  IS_ADMIN && !isMine
                    ? `<span class="remove-holder"
                            data-item="${item.id}"
                            data-user="${holder.user_id}">✕</span>`
                    : ""
                }
              </div>
            `;
          }

          // Minimalistischer Entfernen-Button
          const removeButtonHtml = IS_ADMIN 
            ? `<button class="remove-item-btn admin-only" title="Item entfernen">×</button>`
            : '';

          // Edit-Button für Admins
          const editButtonHtml = IS_ADMIN 
            ? `<button class="edit-item-btn admin-only" title="Item bearbeiten">✏️</button>`
            : '';

          rowHtml += `
            <div class="team-item ${isMine ? "mine" : ""} ${isHighlighted ? "item-highlight" : ""}"
                 data-id="${item.id}"
                 data-name="${item.name}"
                 data-owner="${player}">
              ${removeButtonHtml}
              ${editButtonHtml}
              <div class="item-name">${item.name}</div>
              ${statusHtml}
            </div>
          `;
        });
      }

      rowHtml += `
          </div>
        </div>
      `;

      container.innerHTML += rowHtml;
    });

    if (playersToShow.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          Keine Spieler oder Items gefunden für "${SEARCH_TERM}"
        </div>
      `;
    }
  } catch (error) {
    console.error('Fehler in loadTeamItems:', error);
    container.innerHTML = '<p class="no-items">Fehler beim Laden: ' + error.message + '</p>';
  }
}

// =========================
// ITEM TOGGLE
// =========================
async function toggleItem(itemId) {
  // Item-Name aus dem DOM holen
  const itemElement = document.querySelector(`[data-id="${itemId}"]`);
  const itemName = itemElement ? itemElement.dataset.name || itemElement.querySelector('.item-name').textContent : 'Item';
  
  // Für additional_password Benutzer verwenden wir die mc_name statt user_id
  const userIdField = 'user_id';
  const userIdValue = CURRENT_USER_ID;
  
  const { data: existing } = await window.supabaseClient
    .from("team_item_usage")
    .select("id")
    .eq("item_id", itemId)
    .eq(userIdField, userIdValue)
    .single();

  if (existing) {
    // Item zurücklegen
    await window.supabaseClient
      .from("team_item_usage")
      .delete()
      .eq("id", existing.id);
    
    // Benachrichtigung
    if (window.showTeamNotification) {
      window.showTeamNotification(
        CURRENT_MC_NAME, // Spielername für den Kopf
        `${CURRENT_MC_NAME} hat "${itemName}" zurückgelegt.`, // Nachricht
        'info' // Typ
      );
    }
    
    setTimeout(loadTeamItems, 200);
    return;
  } else {
    // Item ausleihen
    await window.supabaseClient
      .from("team_item_usage")
      .insert([{ 
        item_id: itemId, 
        [userIdField]: userIdValue 
      }]);
    
    // Benachrichtigung
    if (window.showTeamNotification) {
      window.showTeamNotification(
        CURRENT_MC_NAME, // Spielername für den Kopf
        `${CURRENT_MC_NAME} hat "${itemName}" ausgeliehen.`,
        'success' // Typ
      );
    }
    
    setTimeout(loadTeamItems, 200);
    return;
  }
}

// =========================
// MODALE BESTÄTIGUNG FÜR ITEM-ENTFERNUNG
// =========================
function showDeleteConfirmation(itemId, itemName, playerName, isAdmin) {
  showConfirmModal(
    `${isAdmin ? 'Item entfernen (Admin)' : 'Item entfernen'}`,
    `Möchtest du das Item "${itemName}" von ${playerName} wirklich entfernen? Diese Aktion kann nicht rückgängig gemacht werden.`,
    'Ja, entfernen',
    'Abbrechen',
    async () => {
      const success = await removeItemFromDatabase(itemId, itemName, playerName);
      
      if (success) {
        showNotification(`Item "${itemName}" wurde erfolgreich entfernt.`, 'success');
        setTimeout(() => {
          loadTeamItems();
        }, 500);
      } else {
        showNotification('Fehler beim Entfernen des Items.', 'error');
      }
    }
  );
}

// =========================
// ITEM AUS DATENBANK ENTFERNEN
// =========================
async function removeItemFromDatabase(itemId, itemName, playerName) {
  try {
    // Zuerst alle Verwendungen des Items löschen
    await window.supabaseClient
      .from("team_item_usage")
      .delete()
      .eq("item_id", itemId);
    
    // Dann das Item selbst löschen
    const { error } = await window.supabaseClient
      .from("team_items")
      .delete()
      .eq("id", itemId);
    
    if (error) {
      console.error('Fehler beim Entfernen des Items:', error);
      return false;
    }
    
    console.log(`Item "${itemName}" von ${playerName} wurde erfolgreich entfernt`);
    return true;
  } catch (error) {
    console.error('Fehler beim Entfernen des Items:', error);
    return false;
  }
}

// =========================
// MODALE BESTÄTIGUNG FÜR ALLE ITEMS ZURÜCKLEGEN
// =========================
async function returnAllMyItems() {
  showConfirmModal(
    'Alle Items zurücklegen',
    'Willst du wirklich ALLE deine aktuell ausgeliehenen Items zurücklegen?',
    'Ja, zurücklegen',
    'Abbrechen',
    async () => {
      // Für additional_password Benutzer verwenden wir CURRENT_USER_ID statt auth.uid()
      if (!CURRENT_USER_ID) return;

      await window.supabaseClient
        .from("team_item_usage")
        .delete()
        .eq("user_id", CURRENT_USER_ID);

      loadTeamItems();
      showNotification(`${CURRENT_MC_NAME} hat alle Items zurückgelegt.`, 'success');
    }
  );
}

// =========================
// BENACHRICHTIGUNG ANZEIGEN
// =========================
function showMessage(text, type) {
  const modalBody = document.querySelector('#addItemModal .modal-body');
  if (!modalBody) return;
  
  const existingMessage = modalBody.querySelector('.message');
  if (existingMessage) existingMessage.remove();
  
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;
  
  const form = document.getElementById('addItemForm');
  if (form) {
    form.appendChild(message);
  }
}

// BENACHRICHTIGUNG ANZEIGEN
// =========================
function showNotification(message, type) {
  const existingNotification = document.querySelector('.item-notification');
  if (existingNotification) existingNotification.remove();
  
  const notification = document.createElement('div');
  notification.className = `item-notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 10px;
    background: ${type === 'success' ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)'};
    color: white;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// =========================
// CLICK HANDLER
// =========================
document.addEventListener("click", async (e) => {
  // ❌ Admin: fremdes Item freigeben
  const removeBtn = e.target.closest(".remove-holder");
  if (removeBtn) {
    // Für additional_password Benutzer verwenden wir die mc_name statt user_id
    const userIdField = 'user_id';
    const userIdValue = removeBtn.dataset.user;
    
    await window.supabaseClient
      .from("team_item_usage")
      .delete()
      .eq("item_id", removeBtn.dataset.item)
      .eq(userIdField, userIdValue);

    // Benachrichtigung für Admin-Aktion
    const itemElement = removeBtn.closest('.team-item');
    const itemName = itemElement ? itemElement.dataset.name || itemElement.querySelector('.item-name').textContent : 'Item';
    const playerName = removeBtn.dataset.player || 'Unbekannt';
    
    if (window.showTeamNotification) {
      window.showTeamNotification(
        CURRENT_MC_NAME, // Admin-Name für den Kopf
        `${CURRENT_MC_NAME} hat "${itemName}" von ${playerName} zurückgelegt.`, // Nachricht
        'info' // Typ
      );
    }

    setTimeout(loadTeamItems, 200);
    return;
  }

  // 🗑️ Item entfernen - Das X in der Item-Box
  const deleteBtn = e.target.closest(".remove-item-btn");
  if (deleteBtn) {
    e.stopPropagation();
    
    const itemElement = deleteBtn.closest('.team-item');
    const itemId = itemElement.dataset.id;
    const itemName = itemElement.dataset.name || itemElement.querySelector('.item-name').textContent;
    const playerName = itemElement.dataset.owner || 
                      itemElement.closest('.player-row')?.querySelector('.player-name')?.textContent || 
                      itemElement.closest('.single-player-view')?.querySelector('.single-player-name')?.textContent;
    
    const isAdminAction = deleteBtn.classList.contains('admin-only');
    showDeleteConfirmation(itemId, itemName, playerName, isAdminAction);
    return;
  }

  // ✏️ Item bearbeiten - Der Edit-Button
  const editBtn = e.target.closest(".edit-item-btn");
  if (editBtn) {
    e.stopPropagation();
    
    const itemElement = editBtn.closest('.team-item');
    const itemId = itemElement.dataset.id;
    const itemName = itemElement.dataset.name || itemElement.querySelector('.item-name').textContent;
    const currentOwner = itemElement.dataset.owner || 
                        itemElement.closest('.player-row')?.querySelector('.player-name')?.textContent || 
                        itemElement.closest('.single-player-view')?.querySelector('.single-player-name')?.textContent;
    
    showEditItemModal(itemId, itemName, currentOwner);
    return;
  }

  // 👆 Item nehmen / zurücklegen
  const item = e.target.closest(".team-item");
  if (item && !e.target.closest(".remove-item-btn") && !e.target.closest(".edit-item-btn")) {
    toggleItem(item.dataset.id);
  }
});

// =========================
// MODAL FUNKTIONEN (Add Item)
// =========================
function showAddItemModal() {
  const modal = document.getElementById('addItemModal');
  if (modal) {
    modal.style.display = 'flex';
    
    const form = document.getElementById('addItemForm');
    if (form) {
      form.reset();
      document.querySelectorAll('.owner-select-item.selected').forEach(el => {
        el.classList.remove('selected');
      });
      
      const currentUserItem = document.querySelector(`.owner-select-item[data-player="${CURRENT_MC_NAME}"]`);
      if (currentUserItem) {
        currentUserItem.click();
      }
    }
  }
}

function hideAddItemModal() {
  const modal = document.getElementById('addItemModal');
  if (modal) {
    modal.style.display = 'none';
    
    const messages = modal.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
  }
}

// =========================
// MODAL FUNKTIONEN (Edit Item)
// =========================
function showEditItemModal(itemId, itemName, currentOwner) {
  const modal = document.getElementById('editItemModal');
  if (modal) {
    // Setze die aktuellen Werte
    document.getElementById('editItemId').value = itemId;
    document.getElementById('editItemName').value = itemName;
    
    // Zeige das Modal
    modal.style.display = 'flex';
    
    // Lade die Spieler für das Edit Modal
    const editOwnerGrid = document.getElementById('editOwnerSelectionGrid');
    if (editOwnerGrid) {
      updatePlayerSelectionGrid(editOwnerGrid, ALL_PLAYERS, 'edit-owner-select-item');
      
      // Füge Fokus-Klasse für visuelles Feedback hinzu
      editOwnerGrid.classList.add('focused');
      
      // Wähle den aktuellen Besitzer
      setTimeout(() => {
        const currentOwnerItem = document.querySelector(`.edit-owner-select-item[data-player="${currentOwner}"]`);
        if (currentOwnerItem) {
          currentOwnerItem.click();
          
          // Visuelles Feedback für die Auswahl
          showEditMessage(`Aktuell ausgewählt: ${currentOwner}`, 'success');
        }
      }, 100);
      
      // Entferne Fokus nach Auswahl
      setTimeout(() => {
        editOwnerGrid.classList.remove('focused');
      }, 2000);
    }
    
    // Entferne alte Nachrichten
    const messages = modal.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
  }
}

function hideEditItemModal() {
  const modal = document.getElementById('editItemModal');
  if (modal) {
    modal.style.display = 'none';
    
    const messages = modal.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
  }
}

// =========================
// EDIT NACHRICHT ANZEIGEN
// =========================
function showEditMessage(text, type) {
  const modalBody = document.querySelector('#editItemModal .modal-body');
  if (!modalBody) return;
  
  const existingMessages = modalBody.querySelectorAll('.message');
  existingMessages.forEach(msg => msg.remove());
  
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;
  
  const form = document.getElementById('editItemForm');
  if (form) {
    form.appendChild(message);
  }
}

// =========================
// NEUES ITEM HINZUFÜGEN
// =========================
async function addNewItem(event) {
  event.preventDefault();
  
  const itemName = document.getElementById('itemName').value.trim();
  const selectedOwner = document.querySelector('.owner-select-item.selected');
  
  if (!itemName) {
    showMessage('Bitte gib einen Item-Namen ein.', 'error');
    return;
  }
  
  if (!selectedOwner) {
    showMessage('Bitte wähle einen Besitzer aus.', 'error');
    return;
  }
  
  const owner = selectedOwner.dataset.player;
  
  try {
    const timestamp = Date.now();
    const uniqueKey = `item_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await window.supabaseClient
      .from('team_items')
      .insert([
        {
          key: uniqueKey,
          name: itemName,
          storage: owner
        }
      ]);
    
    if (error) {
      console.error('Fehler beim Hinzufügen des Items:', error);
      showMessage('Fehler beim Hinzufügen des Items: ' + error.message, 'error');
      return;
    }
    
    showMessage(`Item "${itemName}" wurde erfolgreich ${owner} hinzugefügt!`, 'success');
    document.getElementById('itemName').value = '';
    
    setTimeout(() => {
      hideAddItemModal();
      loadTeamItems();
    }, 1500);
    
  } catch (error) {
    console.error('Fehler beim Hinzufügen des Items:', error);
    showMessage('Ein unerwarteter Fehler ist aufgetreten.', 'error');
  }
}

// ITEM BEARBEITEN
// =========================
async function editItem(event) {
  event.preventDefault();
  
  const itemId = document.getElementById('editItemId').value;
  const itemName = document.getElementById('editItemName').value.trim();
  const selectedOwner = document.querySelector('.edit-owner-select-item.selected');
  
  if (!itemName) {
    showEditMessage('Bitte gib einen Item-Namen ein.', 'error');
    return;
  }
  
  if (!selectedOwner) {
    showEditMessage('Bitte wähle einen Besitzer aus.', 'error');
    return;
  }
  
  const newOwner = selectedOwner.dataset.player;
  
  try {
    // Hole die aktuellen Item-Informationen um den alten Besitzer zu vergleichen
    const { data: currentItem, error: fetchError } = await window.supabaseClient
      .from('team_items')
      .select('storage')
      .eq('id', itemId)
      .single();
    
    if (fetchError) {
      console.error('Fehler beim Abrufen des aktuellen Items:', fetchError);
      showEditMessage('Fehler beim Abrufen des aktuellen Items.', 'error');
      return;
    }
    
    const oldOwner = currentItem.storage;
    
    // 1. Aktualisiere den Item-Namen und Besitzer in der team_items Tabelle
    const { data, error } = await window.supabaseClient
      .from('team_items')
      .update({
        name: itemName,
        storage: newOwner
      })
      .eq('id', itemId);
    
    if (error) {
      console.error('Fehler beim Bearbeiten des Items:', error);
      showEditMessage('Fehler beim Bearbeiten des Items: ' + error.message, 'error');
      return;
    }
    
    // 2. Wenn sich der Besitzer geändert hat, aktualisiere auch die Item-Verwendung
    if (oldOwner !== newOwner) {
      // Entferne das Item vom alten Besitzer (falls es ihm ausgeliehen war)
      await window.supabaseClient
        .from('team_item_usage')
        .delete()
        .eq('item_id', itemId)
        .eq('user_id', (await getUserIdByName(oldOwner)));
      
      // Füge das Item zum neuen Besitzer hinzu (falls es nicht bereits ausgeliehen ist)
      const { data: existingUsage } = await window.supabaseClient
        .from('team_item_usage')
        .select('id')
        .eq('item_id', itemId)
        .eq('user_id', (await getUserIdByName(newOwner)))
        .single();
      
      if (!existingUsage) {
        await window.supabaseClient
          .from('team_item_usage')
          .insert([{ 
            item_id: itemId, 
            user_id: await getUserIdByName(newOwner) 
          }]);
      }
    }
    
    showEditMessage(`Item "${itemName}" wurde erfolgreich aktualisiert! ${oldOwner !== newOwner ? `Besitzer wurde von ${oldOwner} zu ${newOwner} geändert.` : ''}`, 'success');
    
    setTimeout(() => {
      hideEditItemModal();
      loadTeamItems();
    }, 1500);
    
  } catch (error) {
    console.error('Fehler beim Bearbeiten des Items:', error);
    showEditMessage('Ein unerwarteter Fehler ist aufgetreten.', 'error');
  }
}

// Hilfsfunktion: User-ID anhand des Namens holen
async function getUserIdByName(playerName) {
  const { data: profile } = await window.supabaseClient
    .from('profiles')
    .select('id')
    .eq('mc_name', playerName)
    .single();
  
  return profile ? profile.id : null;
}

// =========================
// EVENT LISTENER SETUP
// =========================
function setupEventListeners() {
  const filterBtn = document.getElementById('filterToggleBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      if (document.getElementById('viewSingleBtn').classList.contains('active')) {
        const playerContainer = document.getElementById('playerSelectionContainer');
        if (playerContainer) {
          playerContainer.style.display = playerContainer.style.display === 'none' ? 'block' : 'none';
        }
      }
    });
  }

  const viewAllBtn = document.getElementById('viewAllBtn');
  const viewSingleBtn = document.getElementById('viewSingleBtn');
  
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      switchToGridView();
    });
  }
  
  if (viewSingleBtn) {
    viewSingleBtn.addEventListener('click', () => {
      const playerContainer = document.getElementById('playerSelectionContainer');
      if (playerContainer) {
        playerContainer.style.display = 'block';
        if (!SELECTED_PLAYER && ALL_PLAYERS.length > 0) {
          const firstPlayer = document.querySelector('.player-select-item');
          if (firstPlayer) {
            firstPlayer.click();
          }
        }
      }
    });
  }

  const searchInput = document.getElementById('itemSearchInput');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        SEARCH_TERM = e.target.value.trim();
        updateActiveFilters();
        loadTeamItems();
      }, 300);
    });
  }

  const clearSearchBtn = document.getElementById('clearSearchBtn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      SEARCH_TERM = '';
      if (searchInput) searchInput.value = '';
      updateActiveFilters();
      loadTeamItems();
    });
  }

  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      SELECTED_PLAYER = null;
      SEARCH_TERM = '';
      if (searchInput) searchInput.value = '';
      switchToGridView();
    });
  }

  const addItemBtn = document.getElementById('addItemBtn');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', showAddItemModal);
  }
  
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', hideAddItemModal);
  }
  
  if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', hideAddItemModal);
  }
  
  const addItemForm = document.getElementById('addItemForm');
  if (addItemForm) {
    addItemForm.addEventListener('submit', addNewItem);
  }
  
  const modalOverlay = document.getElementById('addItemModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        hideAddItemModal();
      }
    });
  }

  const closeEditModalBtn = document.getElementById('closeEditModalBtn');
  const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');
  
  if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener('click', hideEditItemModal);
  }
  
  if (cancelEditModalBtn) {
    cancelEditModalBtn.addEventListener('click', hideEditItemModal);
  }
  
  const editItemForm = document.getElementById('editItemForm');
  if (editItemForm) {
    editItemForm.addEventListener('submit', editItem);
  }
  
  const editModalOverlay = document.getElementById('editItemModal');
  if (editModalOverlay) {
    editModalOverlay.addEventListener('click', (e) => {
      if (e.target === editModalOverlay) {
        hideEditItemModal();
      }
    });
  }

  const returnAllBtn = document.getElementById("returnAllBtn");
  if (returnAllBtn) {
    returnAllBtn.addEventListener("click", returnAllMyItems);
  }
}

// =========================
// CSS FÜR MODALE UND BUTTONS
// =========================
function addCustomStyles() {
  if (!document.getElementById('custom-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'custom-modal-styles';
    style.textContent = `
      /* Bestätigungs-Modal */
      .confirm-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        display: none;
      }
      
      .confirm-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 25px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        min-width: 350px;
        max-width: 90%;
        display: none;
      }
      
      .confirm-modal-content {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .confirm-modal-title {
        margin: 0;
        font-size: 20px;
        color: #333;
        font-weight: 600;
      }
      
      .confirm-modal-message {
        color: #555;
        font-size: 15px;
        line-height: 1.5;
      }
      
      .confirm-modal-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 10px;
      }
      
      .confirm-btn {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }
      
      .confirm-btn.cancel-btn {
        background: #f0f0f0;
        color: #555;
      }
      
      .confirm-btn.cancel-btn:hover {
        background: #e0e0e0;
      }
      
      .confirm-btn.confirm-btn-primary {
        background: #4CAF50;
        color: white;
      }
      
      .confirm-btn.confirm-btn-primary:hover {
        background: #45a049;
      }
      
      /* NEU: Zentrierte Button-Reihe für Actions */
      .action-buttons-row {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-left: auto; /* Nach rechts schieben */
        margin-right: 15px;
      }
      
      /* Anpassung für Suchcontainer */
      .items-controls {
        display: flex;
        align-items: center;
        gap: 15px;
        flex-wrap: wrap;
        justify-content: space-between;
      }
      
      .search-container {
        display: flex;
        align-items: center;
        flex: 0 1 300px; /* Flexible Breite, max 300px */
        min-width: 200px;
      }
      
      .search-input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        min-width: 150px;
      }
      
      /* Button-Styling */
      #addItemBtn {
        background-color: #4CAF50;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }
      
      #addItemBtn:hover {
        background-color: #45a049;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
      }
      
      #returnAllBtn {
        background-color: #ff9800;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }
      
      #returnAllBtn:hover {
        background-color: #f57c00;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
      }
      
      /* Filter-Container anpassen */
      .filter-container {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      
      /* View-Toggle Buttons */
      .view-toggle {
        display: flex;
        gap: 5px;
      }
      
      /* Minimalistischer Entfernen-Button */
      .remove-item-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 20px;
        height: 20px;
        background: rgba(220, 53, 69, 0.1);
        border: 1px solid rgba(220, 53, 69, 0.3);
        border-radius: 50%;
        color: #dc3545;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        opacity: 0.7;
        transition: all 0.2s;
        z-index: 10;
      }
      
      .remove-item-btn:hover {
        opacity: 1;
        background: rgba(220, 53, 69, 0.2);
        border-color: #dc3545;
      }
      
      .team-item:hover .remove-item-btn {
        opacity: 1;
      }
      
      /* Minimalistischer Edit-Button */
      .edit-item-btn {
        position: absolute;
        top: 6px;
        right: 30px;
        width: 20px;
        height: 20px;
        background: rgba(40, 167, 69, 0.1);
        border: 1px solid rgba(40, 167, 69, 0.3);
        border-radius: 50%;
        color: #28a745;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        opacity: 0.7;
        transition: all 0.2s;
        z-index: 10;
      }
      
      .edit-item-btn:hover {
        opacity: 1;
        background: rgba(40, 167, 69, 0.2);
        border-color: #28a745;
      }
      
      .team-item:hover .edit-item-btn {
        opacity: 1;
      }
      
      /* Minimalistischer Remove-Holder Button */
      .remove-holder {
        margin-left: 6px;
        cursor: pointer;
        color: #999;
        font-size: 12px;
        padding: 2px 4px;
        border-radius: 3px;
        transition: all 0.2s;
      }
      
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      
      /* Responsive Design */
      @media (max-width: 768px) {
        .items-controls {
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }
        
        .action-buttons-row {
          margin-left: 0;
          margin-right: 0;
          justify-content: center;
          width: 100%;
        }
        
        .search-container {
          flex: 1;
          min-width: 100%;
        }
        
        .filter-container {
          justify-content: center;
          width: 100%;
        }
      }
      
      @media (max-width: 480px) {
        .action-buttons-row {
          flex-direction: column;
          gap: 8px;
        }
        
        #addItemBtn, #returnAllBtn {
          width: 100%;
        }
        
        .search-input {
          font-size: 13px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// =========================
// LOGIN-BENACHRICHTIGUNGEN (werden über notifications.js verwaltet)
// =========================
// Die Login-Benachrichtigungen werden jetzt zentral über notifications.js verwaltet

// =========================
// INIT (wird über initializeApp() gesteuert)
// =========================
function addGlobalEventListeners() {
  addCustomStyles(); // Custom Styles hinzufügen
  
  // Real-time Benachrichtigungen initialisieren
  if (window.setupRealtimeNotifications) {
    setTimeout(() => {
      window.setupRealtimeNotifications();
    }, 500);
  }
  
  // Login-Benachrichtigungen werden automatisch über notifications.js verwaltet
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideAddItemModal();
      hideEditItemModal();
    }
  });
}
