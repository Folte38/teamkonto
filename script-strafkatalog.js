// =========================
// LOGIN CHECK & SEITEN-WECHSEL
// =========================
document.addEventListener("DOMContentLoaded", async function() {
  const auth = await window.checkAuthentication();
  
  if (!auth.authenticated) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    // Eingeloggt - prüfe Admin-Rechte
    checkAdminAndInitialize();
  }
});

// =========================
// ADMIN-BERECHTIGUNG PRÜFEN
// =========================
async function checkAdminAndInitialize() {
  try {
    const currentUser = await window.getCurrentUser();
    if (!currentUser) {
      document.getElementById('loginPage').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
      return;
    }

    // Alle eingeloggten Benutzer können die Seite sehen
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Admin-Status global speichern
    window.IS_ADMIN = currentUser.role === "admin";
    
    // App initialisieren
    initializeApp();
    initializeServerStatus();
    
    // Admin-Indikator im Header anzeigen/verstecken
    const adminIndicator = document.getElementById('adminIndicator');
    if (adminIndicator) {
      if (window.IS_ADMIN) {
        adminIndicator.style.display = 'inline';
        adminIndicator.style.color = '#4CAF50';
      } else {
        adminIndicator.style.display = 'none';
      }
    }
    
    // Login-Benachrichtigung prüfen (einmalig pro Session)
    if (window.checkAndSendLoginNotification) {
      setTimeout(() => {
        window.checkAndSendLoginNotification();
      }, 1000);
    }
    
  } catch (error) {
    console.error('Fehler beim Prüfen der Admin-Rechte:', error);
    // Bei Fehler - zeige Login-Seite
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
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
// APP INITIALISIERUNG
// =========================
function initializeApp() {
  loadProfile();
  loadPlayers();
  setupEventListeners();
  renderKalender();
}

// =========================
// GLOBALS
// =========================
let CURRENT_USER_ID = null;
let CURRENT_MC_NAME = null;
let IS_ADMIN = false;
let ALL_PLAYERS = [];
let ALL_PROFILES = [];
let CURRENT_DATE = new Date();
let SELECTED_DATE = null;
let SELECTED_PLAYERS = new Set(); // Set für ausgewählte Spieler
let STRAFEN_LIST = []; // Array für einzelne Strafen pro Spieler

// Strafen-Definitionen
const STRAFEN = {
  griefing: { name: "Griefing", amount: 50 },
  spam: { name: "Spam", amount: 20 },
  beleidigung: { name: "Beleidigung", amount: 30 },
  cheating: { name: "Cheating", amount: 100 },
  regeln_verletzung: { name: "Regelverletzung", amount: 25 },
  bugusing: { name: "Bugusing", amount: 40 },
  teamkill: { name: "Teamkill", amount: 35 },
  diebstahl: { name: "Diebstahl", amount: 60 }
};

// =========================
// PROFIL & NAV
// =========================
async function loadProfile() {
  const currentUser = await window.getCurrentUser();
  if (!currentUser) return;

  CURRENT_USER_ID = currentUser.id;
  CURRENT_MC_NAME = currentUser.mc_name;
  IS_ADMIN = currentUser.role === "admin";

  const navUser = document.getElementById("navUser");
  if (navUser) {
    navUser.style.display = "flex";
    navUser.innerHTML = `
      <span id="navUsername">${currentUser.mc_name}</span>
      <img id="navAvatar" src="https://mc-heads.net/avatar/${currentUser.mc_name}/64" alt="${currentUser.mc_name}">
    `;
  }

  // Logout-Button anzeigen
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.style.display = "block";
  }
}

// =========================
// ALLE PROFILE LADEN
// =========================
async function loadPlayers() {
  const { data: profiles } = await window.supabaseClient
    .from("profiles")
    .select("id, mc_name")
    .order("mc_name");

  if (profiles) {
    ALL_PROFILES = profiles;
    ALL_PLAYERS = profiles.map(p => p.mc_name);
  }
}

// =========================
// KALENDER FUNKTIONEN
// =========================
function renderKalender() {
  const year = CURRENT_DATE.getFullYear();
  const month = CURRENT_DATE.getMonth();
  
  // Monatsnamen
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];
  
  // Header aktualisieren
  document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
  
  // Ersten Tag des Monats finden
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Wochentag des ersten Tages (0=Sonntag, 1=Montag, ...)
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1; // Montag=0, Sonntag=6
  
  // Kalender-Grid leeren
  const grid = document.getElementById('kalenderGrid');
  grid.innerHTML = '';
  
  // Leere Tage am Anfang
  for (let i = 0; i < startDay; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'kalender-day empty';
    grid.appendChild(emptyDay);
  }
  
  // Tage des Monats
  for (let day = 1; day <= daysInMonth; day++) {
    const dayElement = document.createElement('div');
    dayElement.className = 'kalender-day';
    dayElement.textContent = day;
    
    const currentDate = new Date(year, month, day);
    const dateString = formatDateForDB(currentDate);
    
    // Prüfen ob für diesen Tag Strafeinträge existieren
    loadStrafenForDate(dateString, dayElement);
    
    // Klick-Event hinzufügen
    dayElement.addEventListener('click', () => openPlayerModal(currentDate, dayElement));
    
    grid.appendChild(dayElement);
  }
  
  // Leere Tage am Ende
  const totalCells = grid.children.length;
  const remainingCells = 42 - totalCells; // 6 Wochen × 7 Tage
  for (let i = 0; i < remainingCells; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'kalender-day empty';
    grid.appendChild(emptyDay);
  }
}

function formatDateForDB(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('de-DE', options);
}

async function loadStrafenForDate(dateString, dayElement) {
  try {
    console.log('Lade Strafen für Datum:', dateString);
    
    const { data: entries, error } = await window.supabaseClient
      .from("strafkatalog_eintraege")
      .select("*")
      .eq("date", dateString);
    
    if (error) {
      console.error('Datenbank-Fehler:', error);
      return;
    }
    
    console.log('Gefundene Einträge:', entries);
    
    if (entries && entries.length > 0) {
      dayElement.classList.add('has-player');
      dayElement.classList.add('has-strafe');
      
      let allPlayers = [];
      let totalStrafAmount = 0;
      
      entries.forEach(entry => {
        if (entry.player_name) {
          allPlayers.push(entry.player_name);
        }
        if (entry.strafe_amount) {
          totalStrafAmount += entry.strafe_amount;
        }
      });
      
      // Duplikate entfernen
      const uniquePlayers = [...new Set(allPlayers)];
      
      let dayHtml = `
        <div class="day-number">${dayElement.textContent}</div>
        <div class="player-avatars">
      `;
      
      // Alle Spieler-Avatare anzeigen (max 3, dann "+X")
      const displayPlayers = uniquePlayers.slice(0, 3);
      const remainingCount = uniquePlayers.length - 3;
      
      displayPlayers.forEach(playerName => {
        dayHtml += `
          <div class="player-avatar">
            <img src="https://mc-heads.net/avatar/${playerName}/20" 
                 alt="${playerName}" 
                 title="${playerName}">
          </div>
        `;
      });
      
      if (remainingCount > 0) {
        dayHtml += `
          <div class="player-avatar more-players" title="${uniquePlayers.slice(3).join(', ')}">
            +${remainingCount}
          </div>
        `;
      }
      
      dayHtml += `</div>`;
      
      // Gesamt-Strafsumme anzeigen
      if (totalStrafAmount > 0) {
        dayHtml += `
          <div class="strafe-indicator" title="Gesamtstrafen: $${totalStrafAmount}">
            ⚖️ $${totalStrafAmount}
          </div>
        `;
      }
      
      dayElement.innerHTML = dayHtml;
      console.log('Tag aktualisiert mit:', { uniquePlayers, totalStrafAmount });
    }
  } catch (error) {
    console.error('Fehler beim Laden der Strafen:', error);
  }
}

// =========================
// MODAL FUNKTIONEN
// =========================
async function openPlayerModal(date, dayElement) {
  SELECTED_DATE = date;
  SELECTED_PLAYERS.clear();
  STRAFEN_LIST = [];
  
  const modal = document.getElementById('playerModal');
  const modalTitle = document.getElementById('modalTitle');
  const playerGrid = document.getElementById('playerGrid');
  const selectedPlayersList = document.getElementById('selectedPlayersList');
  const strafenList = document.getElementById('strafenList');
  
  modalTitle.textContent = formatDateDisplay(date);
  
  // Spieler-Grid füllen
  playerGrid.innerHTML = '';
  ALL_PROFILES.forEach(profile => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-select-item';
    playerItem.dataset.playerId = profile.id;
    playerItem.dataset.playerName = profile.mc_name;
    playerItem.innerHTML = `
      <img src="https://mc-heads.net/avatar/${profile.mc_name}/32" 
           alt="${profile.mc_name}" 
           class="player-select-avatar">
      <div class="player-select-name">${profile.mc_name}</div>
    `;
    
    playerItem.addEventListener('click', () => {
      togglePlayerSelection(profile.id, profile.mc_name, playerItem);
    });
    
    playerGrid.appendChild(playerItem);
  });
  
  // Bestehende Einträge laden
  try {
    const dateString = formatDateForDB(date);
    console.log('Lade Einträge für Datum:', dateString);
    
    const { data: entries, error } = await window.supabaseClient
      .from("strafkatalog_eintraege")
      .select("*")
      .eq("date", dateString);
    
    if (error) {
      console.error('Datenbank-Fehler beim Laden:', error);
      alert('Fehler beim Laden der Straf-Einträge: ' + error.message);
      return;
    }
    
    console.log('Gefundene Einträge:', entries);
    
    // UI zurücksetzen
    selectedPlayersList.innerHTML = '<p class="no-players-selected">Noch keine Spieler ausgewählt</p>';
    strafenList.innerHTML = '';
    STRAFEN_LIST = [];
    
    if (entries && entries.length > 0) {
      // Spieler und Strafen wiederherstellen
      entries.forEach(entry => {
        if (entry.player_name) {
          const profile = ALL_PROFILES.find(p => p.mc_name === entry.player_name);
          if (profile && !SELECTED_PLAYERS.has(profile.id)) {
            SELECTED_PLAYERS.add(profile.id);
          }
        }
        
        // Strafe zur Liste hinzufügen
        STRAFEN_LIST.push({
          id: entry.id,
          players: [entry.player_name], // Immer nur ein Spieler
          strafe_type: entry.strafe_type || '',
          strafe_amount: entry.strafe_amount || 0,
          note: entry.note || ''
        });
      });
      
      updateSelectedPlayersList();
      renderStrafenList();
    }
    
  } catch (error) {
    console.error('Fehler beim Laden der Einträge:', error);
    alert('Fehler beim Laden: ' + error.message);
  }
  
  modal.style.display = 'flex';
}

function togglePlayerSelection(playerId, playerName, playerItem) {
  if (SELECTED_PLAYERS.has(playerId)) {
    SELECTED_PLAYERS.delete(playerId);
    playerItem.classList.remove('selected');
    
    // Strafe für diesen Spieler aus der Liste entfernen
    const index = STRAFEN_LIST.findIndex(strafe => 
      strafe.players && strafe.players.includes(playerName)
    );
    if (index !== -1) {
      STRAFEN_LIST.splice(index, 1);
      renderStrafenList();
    }
  } else {
    SELECTED_PLAYERS.add(playerId);
    playerItem.classList.add('selected');
    
    // Automatisch neue Strafe für diesen Spieler erstellen
    STRAFEN_LIST.push({
      id: 'new_' + Date.now() + '_' + Math.random(),
      players: [playerName],
      strafe_type: '',
      strafe_amount: 0,
      note: ''
    });
    renderStrafenList();
  }
  
  updateSelectedPlayersList();
}

function updateSelectedPlayersList() {
  const selectedPlayersList = document.getElementById('selectedPlayersList');
  
  if (SELECTED_PLAYERS.size === 0) {
    selectedPlayersList.innerHTML = '<p class="no-players-selected">Noch keine Spieler ausgewählt</p>';
  } else {
    selectedPlayersList.innerHTML = '';
    SELECTED_PLAYERS.forEach(playerId => {
      const profile = ALL_PROFILES.find(p => p.id === playerId);
      if (profile) {
        const playerChip = document.createElement('div');
        playerChip.className = 'selected-player-chip';
        playerChip.innerHTML = `
          <img src="https://mc-heads.net/avatar/${profile.mc_name}/24" 
               alt="${profile.mc_name}">
          <span>${profile.mc_name}</span>
          <button class="remove-player-chip" data-player-id="${playerId}" data-player-name="${profile.mc_name}">×</button>
        `;
        
        // Remove-Button Event
        const removeBtn = playerChip.querySelector('.remove-player-chip');
        removeBtn.addEventListener('click', () => {
          removePlayerFromSelection(playerId, profile.mc_name);
        });
        
        selectedPlayersList.appendChild(playerChip);
      }
    });
  }
}

function removePlayerFromSelection(playerId, playerName) {
  SELECTED_PLAYERS.delete(playerId);
  
  // UI aktualisieren
  const playerItem = document.querySelector(`[data-player-id="${playerId}"]`);
  if (playerItem) {
    playerItem.classList.remove('selected');
  }
  
  // Strafe für diesen Spieler aus der Liste entfernen
  const index = STRAFEN_LIST.findIndex(strafe => 
    strafe.players && strafe.players.includes(playerName)
  );
  if (index !== -1) {
    STRAFEN_LIST.splice(index, 1);
    renderStrafenList();
  }
  
  updateSelectedPlayersList();
}

function updateAddStrafeButton() {
  const addStrafeBtn = document.getElementById('addStrafeBtn');
  if (addStrafeBtn) {
    addStrafeBtn.disabled = SELECTED_PLAYERS.size === 0;
  }
}

// =========================
// STRAFEN LISTE FUNKTIONEN
// =========================
function renderStrafenList() {
  const strafenList = document.getElementById('strafenList');
  strafenList.innerHTML = '';
  
  STRAFEN_LIST.forEach((strafe, index) => {
    const strafeItem = document.createElement('div');
    strafeItem.className = 'strafe-item';
    
    const playerNames = strafe.players.join(', ');
    const strafeTypeName = STRAFEN[strafe.strafe_type]?.name || strafe.strafe_type;
    const strafeAmount = strafe.strafe_amount || 0;
    
    strafeItem.innerHTML = `
      <div class="strafe-item-player">
        <img src="https://mc-heads.net/avatar/${strafe.players[0]}/24" 
             alt="${strafe.players[0]}" 
             class="strafe-item-avatar">
        <div class="strafe-item-name">${playerNames}</div>
      </div>
      
      <div class="strafe-item-details">
        <select class="strafe-item-select" data-index="${index}">
          <option value="">Keine Strafe</option>
          ${Object.entries(STRAFEN).map(([key, value]) => 
            `<option value="${key}" ${strafe.strafe_type === key ? 'selected' : ''}>
              ${value.name} - $${value.amount}
            </option>`
          ).join('')}
        </select>
        
        <input type="text" 
               class="strafe-item-note" 
               data-index="${index}"
               placeholder="Notiz..." 
               value="${strafe.note || ''}">
        
        <button class="strafe-item-remove" data-index="${index}" title="Strafe entfernen">
          ×
        </button>
      </div>
    `;
    
    strafenList.appendChild(strafeItem);
  });
  
  // Event Listener für die neuen Elemente
  document.querySelectorAll('.strafe-item-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      updateStrafe(index, e.target.value);
    });
  });
  
  document.querySelectorAll('.strafe-item-note').forEach(note => {
    note.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      updateStrafeNote(index, e.target.value);
    });
  });
  
  document.querySelectorAll('.strafe-item-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeStrafe(index);
    });
  });
}

function addStrafeForSelectedPlayers() {
  if (SELECTED_PLAYERS.size === 0) {
    alert('Bitte wähle zuerst Spieler aus!');
    return;
  }
  
  const playerNames = Array.from(SELECTED_PLAYERS).map(id => {
    const profile = ALL_PROFILES.find(p => p.id === id);
    return profile ? profile.mc_name : '';
  }).filter(name => name);
  
  // Neue Strafe für jeden ausgewählten Spieler erstellen
  playerNames.forEach(playerName => {
    STRAFEN_LIST.push({
      id: 'new_' + Date.now() + '_' + Math.random(),
      players: [playerName],
      strafe_type: '',
      strafe_amount: 0,
      note: ''
    });
  });
  
  renderStrafenList();
}

function updateStrafe(index, strafeType) {
  if (STRAFEN_LIST[index]) {
    STRAFEN_LIST[index].strafe_type = strafeType;
    STRAFEN_LIST[index].strafe_amount = strafeType && STRAFEN[strafeType] ? STRAFEN[strafeType].amount : 0;
  }
}

function updateStrafeNote(index, note) {
  if (STRAFEN_LIST[index]) {
    STRAFEN_LIST[index].note = note;
  }
}

function removeStrafe(index) {
  STRAFEN_LIST.splice(index, 1);
  renderStrafenList();
}

function closePlayerModal() {
  document.getElementById('playerModal').style.display = 'none';
  SELECTED_DATE = null;
  SELECTED_PLAYERS.clear();
  STRAFEN_LIST = [];
}

// =========================
// EVENT LISTENER
// =========================
function setupEventListeners() {
  // Monats-Navigation
  document.getElementById('prevMonth').addEventListener('click', () => {
    CURRENT_DATE.setMonth(CURRENT_DATE.getMonth() - 1);
    renderKalender();
  });
  
  document.getElementById('nextMonth').addEventListener('click', () => {
    CURRENT_DATE.setMonth(CURRENT_DATE.getMonth() + 1);
    renderKalender();
  });
  
  // Modal-Buttons
  document.getElementById('closeModal').addEventListener('click', closePlayerModal);
  document.getElementById('cancelModal').addEventListener('click', closePlayerModal);
  
  // Speichern-Button - NUR FÜR ADMINS
  const saveBtn = document.getElementById('savePlayers');
  if (saveBtn) {
    if (window.IS_ADMIN) {
      saveBtn.addEventListener('click', saveStrafenToCalendar);
      saveBtn.style.display = 'inline-block';
      saveBtn.disabled = false;
    } else {
      saveBtn.style.display = 'none';
    }
  }
  
  // Entfernen-Button - NUR FÜR ADMINS
  const removeBtn = document.getElementById('removePlayer');
  if (removeBtn) {
    if (window.IS_ADMIN) {
      removeBtn.addEventListener('click', removePlayersFromCalendar);
      removeBtn.style.display = 'inline-block';
      removeBtn.disabled = false;
    } else {
      removeBtn.style.display = 'none';
    }
  }
  
  // Modal schließen wenn außerhalb geklickt wird
  document.getElementById('playerModal').addEventListener('click', (e) => {
    if (e.target.id === 'playerModal') {
      closePlayerModal();
    }
  });
  
  // ESC-Taste zum Schließen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePlayerModal();
    }
  });
}

// =========================
// DATENBANK OPERATIONEN
// =========================
async function saveStrafenToCalendar() {
  if (!SELECTED_DATE) {
    alert('Kein Datum ausgewählt!');
    return;
  }
  
  if (STRAFEN_LIST.length === 0) {
    alert('Keine Strafen definiert!');
    return;
  }
  
  try {
    const dateString = formatDateForDB(SELECTED_DATE);
    
    // Alte Einträge für dieses Datum löschen
    await window.supabaseClient
      .from("strafkatalog_eintraege")
      .delete()
      .eq("date", dateString);
    
    // Neue Einträge erstellen - JEDER Spieler bekommt EINEN Eintrag
    const entriesToInsert = STRAFEN_LIST.filter(strafe => 
      strafe.players && strafe.players.length > 0
    ).map(strafe => ({
      date: dateString,
      player_name: strafe.players[0], // Einzelner Spieler statt Array
      note: strafe.note || null,
      strafe_type: strafe.strafe_type || null,
      strafe_amount: strafe.strafe_amount || 0,
      created_by: CURRENT_USER_ID
    }));
    
    if (entriesToInsert.length > 0) {
      console.log('Speichere Einträge:', entriesToInsert);
      await window.supabaseClient
        .from("strafkatalog_eintraege")
        .insert(entriesToInsert);
    }
    
    // Benachrichtigung
    if (window.showTeamNotification) {
      const totalPlayers = entriesToInsert.length;
      const totalAmount = entriesToInsert.reduce((sum, entry) => sum + (entry.strafe_amount || 0), 0);
      
      let message = `${totalPlayers} Spieler für ${formatDateDisplay(SELECTED_DATE)} bestraft`;
      if (totalAmount > 0) {
        message += ` (Gesamt: $${totalAmount})`;
      }
      
      window.showTeamNotification(
        CURRENT_MC_NAME,
        message,
        'success'
      );
    }
    
    closePlayerModal();
    renderKalender();
    
  } catch (error) {
    console.error('Fehler beim Speichern:', error);
    alert('Fehler beim Speichern: ' + error.message);
  }
}

async function removePlayersFromCalendar() {
  if (!SELECTED_DATE) {
    alert('Kein Datum ausgewählt!');
    return;
  }
  
  if (SELECTED_PLAYERS.size === 0) {
    alert('Keine Spieler zum Entfernen ausgewählt!');
    return;
  }
  
  try {
    const dateString = formatDateForDB(SELECTED_DATE);
    const selectedPlayerNames = Array.from(SELECTED_PLAYERS).map(id => {
      const profile = ALL_PROFILES.find(p => p.id === id);
      return profile ? profile.mc_name : '';
    }).filter(name => name);
    
    // Aktuelle Einträge holen
    const { data: entries, error } = await window.supabaseClient
      .from("strafkatalog_eintraege")
      .select("*")
      .eq("date", dateString);
    
    if (error) {
      console.error('Datenbank-Fehler:', error);
      alert('Fehler beim Entfernen: ' + error.message);
      return;
    }
    
    if (entries && entries.length > 0) {
      // Einträge filtern - nur die betroffenen Spieler entfernen
      const remainingEntries = entries.filter(entry => 
        !selectedPlayerNames.includes(entry.player_name)
      );
      
      // Alte Einträge löschen
      await window.supabaseClient
        .from("strafkatalog_eintraege")
        .delete()
        .eq("date", dateString);
      
      // Verbleibende Einträge wieder einfügen
      if (remainingEntries.length > 0) {
        await window.supabaseClient
          .from("strafkatalog_eintraege")
          .insert(remainingEntries);
      }
      
      // Benachrichtigung
      if (window.showTeamNotification) {
        window.showTeamNotification(
          CURRENT_MC_NAME,
          `${selectedPlayerNames.length} Spieler von ${formatDateDisplay(SELECTED_DATE)} entfernt`,
          'info'
        );
      }
      
      closePlayerModal();
      renderKalender();
    }
    
  } catch (error) {
    console.error('Fehler beim Entfernen:', error);
    alert('Fehler beim Entfernen: ' + error.message);
  }
}

// Logout-Button Event Listener
document.addEventListener("DOMContentLoaded", function() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
});
