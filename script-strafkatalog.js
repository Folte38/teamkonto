// =========================
// LOGIN CHECK & SEITEN-WECHSEL
// =========================
document.addEventListener("DOMContentLoaded", function() {
  window.supabaseClient.auth.getSession().then(({ data }) => {
    if (!data.session) {
      // Nicht eingeloggt - zeige Login-Seite
      document.getElementById('loginPage').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
    } else {
      // Eingeloggt - prüfe Admin-Rechte
      checkAdminAndInitialize(data.session.user.id);
    }
  });
});

// =========================
// ADMIN-BERECHTIGUNG PRÜFEN
// =========================
async function checkAdminAndInitialize(userId) {
  try {
    const { data: profile } = await window.supabaseClient
      .from("profiles")
      .select("mc_name, role")
      .eq("id", userId)
      .single();

    if (!profile || profile.role !== "admin") {
      // Kein Admin - zeige Fehlerseite
      document.getElementById('loginPage').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
      
      const loginContent = document.querySelector('.login-overlay-content');
      loginContent.innerHTML = `
        <img src="logo.png" alt="Logo" class="login-logo">
        <h2>🚫 Zugriff verweigert</h2>
        <p>Du benötigst Admin-Rechte, um auf den Strafkatalog zugreifen zu können.</p>
        <button onclick="window.location.href='index.html'" class="login-btn">
          Zurück zur Startseite
        </button>
      `;
      return;
    }

    // Admin - zeige Inhalt
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    initializeApp();
    initializeServerStatus();
    
  } catch (error) {
    console.error('Fehler bei der Admin-Prüfung:', error);
    // Bei Fehler auch Zugriff verweigern
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
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return;

  CURRENT_USER_ID = user.id;

  const { data: profile } = await window.supabaseClient
    .from("profiles")
    .select("mc_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  CURRENT_MC_NAME = profile.mc_name;
  IS_ADMIN = profile.role === "admin";

  const navUser = document.getElementById("navUser");
  if (navUser) {
    document.getElementById("navUsername").innerText = profile.mc_name;
    document.getElementById("navAvatar").src =
      `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
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
    
    // Prüfen ob für diesen Tag ein Strafeintrag existiert
    loadStrafeForDate(dateString, dayElement);
    
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

async function loadStrafeForDate(dateString, dayElement) {
  try {
    const { data: entry } = await window.supabaseClient
      .from("strafkatalog_eintraege")
      .select("players, note, strafe_type, strafe_amount")
      .eq("date", dateString)
      .single();
    
    if (entry) {
      dayElement.classList.add('has-player');
      dayElement.classList.add('has-strafe');
      
      let players = [];
      let note = '';
      let strafeType = '';
      let strafeAmount = 0;
      
      try {
        players = entry.players || [];
        note = entry.note || '';
        strafeType = entry.strafe_type || '';
        strafeAmount = entry.strafe_amount || 0;
      } catch (e) {
        console.error('Fehler beim Parsen der Strafdaten:', e);
      }
      
      let dayHtml = `
        <div class="day-number">${dayElement.textContent}</div>
        <div class="player-avatars">
      `;
      
      // Alle Spieler-Avatare anzeigen (max 3, dann "+X")
      const displayPlayers = players.slice(0, 3);
      const remainingCount = players.length - 3;
      
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
          <div class="player-avatar more-players" title="${players.slice(3).join(', ')}">
            +${remainingCount}
          </div>
        `;
      }
      
      dayHtml += `</div>`;
      
      // Strafe anzeigen falls vorhanden
      if (strafeType && strafeAmount > 0) {
        const strafeName = STRAFEN[strafeType]?.name || strafeType;
        dayHtml += `
          <div class="strafe-indicator" title="${strafeName} - $${strafeAmount}">
            ⚖️ $${strafeAmount}
          </div>
        `;
      }
      
      // Notiz anzeigen falls vorhanden
      if (note && note.trim()) {
        dayHtml += `
          <div class="day-note" title="${note}">
            📝
          </div>
        `;
      }
      
      dayElement.innerHTML = dayHtml;
    }
  } catch (error) {
    // Kein Eintrag gefunden - das ist normal
  }
}

async function openPlayerModal(date, dayElement) {
  SELECTED_DATE = date;
  SELECTED_PLAYERS.clear();
  
  const modal = document.getElementById('playerModal');
  const modalTitle = document.getElementById('modalTitle');
  const playerGrid = document.getElementById('playerGrid');
  const noteInput = document.getElementById('dayNote');
  const selectedPlayersList = document.getElementById('selectedPlayersList');
  const strafeSelect = document.getElementById('strafeSelect');
  const strafeAmountDisplay = document.getElementById('strafeAmountDisplay');
  const strafeAmount = document.getElementById('strafeAmount');
  
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
  
  // Bestehende Einträge laden und vor-auswählen
  try {
    const dateString = formatDateForDB(date);
    const { data: entry } = await window.supabaseClient
      .from("strafkatalog_eintraege")
      .select("players, note, strafe_type, strafe_amount")
      .eq("date", dateString)
      .single();
    
    if (entry) {
      let players = [];
      let note = '';
      let strafeType = '';
      
      players = entry.players || [];
      note = entry.note || '';
      strafeType = entry.strafe_type || '';
      
      // Spieler auswählen
      players.forEach(playerName => {
        const profile = ALL_PROFILES.find(p => p.mc_name === playerName);
        if (profile) {
          SELECTED_PLAYERS.add(profile.id);
          
          // UI aktualisieren
          const playerItem = document.querySelector(`[data-player-name="${playerName}"]`);
          if (playerItem) {
            playerItem.classList.add('selected');
          }
        }
      });
      
      // Strafe auswählen
      if (strafeSelect) {
        strafeSelect.value = strafeType || '';
        updateStrafeAmount();
      }
      
      // Notiz eintragen
      if (noteInput) {
        noteInput.value = note || '';
      }
      
      // Ausgewählte Spieler anzeigen
      updateSelectedPlayersList();
    } else {
      // Felder leeren
      if (noteInput) {
        noteInput.value = '';
      }
      if (strafeSelect) {
        strafeSelect.value = '';
      }
      updateStrafeAmount();
      selectedPlayersList.innerHTML = '<p class="no-players-selected">Noch keine Spieler ausgewählt</p>';
    }
  } catch (error) {
    // Kein Eintrag gefunden - Felder leeren
    if (noteInput) {
      noteInput.value = '';
    }
    if (strafeSelect) {
      strafeSelect.value = '';
    }
    updateStrafeAmount();
    selectedPlayersList.innerHTML = '<p class="no-players-selected">Noch keine Spieler ausgewählt</p>';
  }
  
  modal.style.display = 'flex';
}

function togglePlayerSelection(playerId, playerName, playerItem) {
  if (SELECTED_PLAYERS.has(playerId)) {
    SELECTED_PLAYERS.delete(playerId);
    playerItem.classList.remove('selected');
  } else {
    SELECTED_PLAYERS.add(playerId);
    playerItem.classList.add('selected');
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
  
  updateSelectedPlayersList();
}

function updateStrafeAmount() {
  const strafeSelect = document.getElementById('strafeSelect');
  const strafeAmountDisplay = document.getElementById('strafeAmountDisplay');
  const strafeAmount = document.getElementById('strafeAmount');
  
  if (strafeSelect.value && STRAFEN[strafeSelect.value]) {
    strafeAmountDisplay.style.display = 'block';
    strafeAmount.textContent = STRAFEN[strafeSelect.value].amount;
  } else {
    strafeAmountDisplay.style.display = 'none';
    strafeAmount.textContent = '0';
  }
}

function closePlayerModal() {
  document.getElementById('playerModal').style.display = 'none';
  SELECTED_DATE = null;
  SELECTED_PLAYERS.clear();
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
  
  // Strafen-Auswahl
  document.getElementById('strafeSelect').addEventListener('change', updateStrafeAmount);
  
  // Speichern-Button
  document.getElementById('savePlayers').addEventListener('click', saveStrafeToCalendar);
  
  // Entfernen-Button
  document.getElementById('removePlayer').addEventListener('click', removePlayersFromCalendar);
  
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
// STRAFKATALOG DATENBANK OPERATIONEN
// =========================
async function saveStrafeToCalendar() {
  if (!SELECTED_DATE) {
    alert('Kein Datum ausgewählt!');
    return;
  }
  
  if (SELECTED_PLAYERS.size === 0) {
    alert('Bitte wähle mindestens einen Spieler aus!');
    return;
  }
  
  try {
    const dateString = formatDateForDB(SELECTED_DATE);
    const noteInput = document.getElementById('dayNote');
    const strafeSelect = document.getElementById('strafeSelect');
    const note = noteInput ? noteInput.value.trim() : '';
    const strafeType = strafeSelect ? strafeSelect.value : '';
    const strafeAmount = strafeType && STRAFEN[strafeType] ? STRAFEN[strafeType].amount : 0;
    
    // Spieler-Informationen sammeln
    const playerNames = Array.from(SELECTED_PLAYERS).map(id => {
      const profile = ALL_PROFILES.find(p => p.id === id);
      return profile ? profile.mc_name : '';
    }).filter(name => name);
    
    // Prüfen ob bereits ein Eintrag existiert
    const { data: existing } = await window.supabaseClient
      .from("strafkatalog_eintraege")
      .select("id")
      .eq("date", dateString)
      .single();
    
    if (existing) {
      // Bestehenden Eintrag aktualisieren
      await window.supabaseClient
        .from("strafkatalog_eintraege")
        .update({ 
          players: playerNames,
          note: note,
          strafe_type: strafeType,
          strafe_amount: strafeAmount,
          updated_by: CURRENT_USER_ID
        })
        .eq("date", dateString);
    } else {
      // Neuen Eintrag erstellen
      await window.supabaseClient
        .from("strafkatalog_eintraege")
        .insert([{ 
          date: dateString, 
          players: playerNames,
          note: note,
          strafe_type: strafeType,
          strafe_amount: strafeAmount,
          created_by: CURRENT_USER_ID
        }]);
    }
    
    // Benachrichtigung
    if (window.showTeamNotification) {
      let message = `${playerNames.length} Spieler für ${formatDateDisplay(SELECTED_DATE)} eingetragen`;
      if (strafeType && STRAFEN[strafeType]) {
        message += ` (${STRAFEN[strafeType].name} - $${strafeAmount})`;
      }
      if (note) {
        message += ' (mit Notiz)';
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
    
    // Aktuelle Einträge holen
    const { data: existing } = await window.supabaseClient
      .from("strafkatalog_eintraege")
      .select("players, note, strafe_type, strafe_amount")
      .eq("date", dateString)
      .single();
    
    if (existing && existing.players) {
      const currentPlayers = existing.players || [];
      const selectedPlayerNames = Array.from(SELECTED_PLAYERS).map(id => {
        const profile = ALL_PROFILES.find(p => p.id === id);
        return profile ? profile.mc_name : '';
      }).filter(name => name);
      
      const remainingPlayerNames = currentPlayers.filter(name => 
        !selectedPlayerNames.includes(name)
      );
      
      if (remainingPlayerNames.length > 0) {
        // Eintrag mit verbleibenden Spielern aktualisieren
        await window.supabaseClient
          .from("strafkatalog_eintraege")
          .update({
            players: remainingPlayerNames,
            updated_by: CURRENT_USER_ID
          })
          .eq("date", dateString);
      } else {
        // Kompletten Eintrag löschen
        await window.supabaseClient
          .from("strafkatalog_eintraege")
          .delete()
          .eq("date", dateString);
      }
      
      // Benachrichtigung
      if (window.showTeamNotification) {
        const removedCount = SELECTED_PLAYERS.size;
        window.showTeamNotification(
          CURRENT_MC_NAME,
          `${removedCount} Spieler von ${formatDateDisplay(SELECTED_DATE)} entfernt`,
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
