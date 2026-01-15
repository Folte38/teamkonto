// =========================
// LOGIN CHECK & SEITEN-WECHSEL
// =========================
document.addEventListener("DOMContentLoaded", function() {
  window.supabaseClient.auth.getSession().then(({ data }) => {
    if (!data.session) {
      document.getElementById('loginPage').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
    } else {
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      initializeApp();
      initializeServerStatus();
    }
  });
});

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
let SELECTED_PLAYER = null;

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
    
    // Prüfen ob für diesen Tag ein Spieler eingetragen ist
    loadPlayerForDate(dateString, dayElement);
    
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

async function loadPlayerForDate(dateString, dayElement) {
  try {
    const { data: entry } = await window.supabaseClient
      .from("kalender_eintraege")
      .select("mc_name, note")
      .eq("date", dateString)
      .single();
    
    if (entry) {
      dayElement.classList.add('has-player');
      let dayHtml = `
        <div class="day-number">${dayElement.textContent}</div>
        <div class="player-avatar">
          <img src="https://mc-heads.net/avatar/${entry.mc_name}/24" 
               alt="${entry.mc_name}" 
               title="${entry.mc_name}">
        </div>
      `;
      
      // Notiz anzeigen falls vorhanden
      if (entry.note && entry.note.trim()) {
        dayHtml += `
          <div class="day-note" title="${entry.note}">
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
  SELECTED_PLAYER = null;
  
  const modal = document.getElementById('playerModal');
  const modalTitle = document.getElementById('modalTitle');
  const playerGrid = document.getElementById('playerGrid');
  const noteInput = document.getElementById('dayNote');
  
  modalTitle.textContent = formatDateDisplay(date);
  
  // Spieler-Grid füllen
  playerGrid.innerHTML = '';
  ALL_PROFILES.forEach(profile => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-select-item';
    playerItem.dataset.player = profile.mc_name;
    playerItem.innerHTML = `
      <img src="https://mc-heads.net/avatar/${profile.mc_name}/32" 
           alt="${profile.mc_name}" 
           class="player-select-avatar">
      <div class="player-select-name">${profile.mc_name}</div>
    `;
    
    playerItem.addEventListener('click', () => {
      document.querySelectorAll('.player-select-item').forEach(item => {
        item.classList.remove('selected');
      });
      playerItem.classList.add('selected');
      SELECTED_PLAYER = profile.mc_name;
    });
    
    playerGrid.appendChild(playerItem);
  });
  
  // Bestehenden Eintrag laden (falls vorhanden)
  try {
    const dateString = formatDateForDB(date);
    const { data: entry } = await window.supabaseClient
      .from("kalender_eintraege")
      .select("mc_name, note")
      .eq("date", dateString)
      .single();
    
    if (entry) {
      // Spieler auswählen
      document.querySelectorAll('.player-select-item').forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.player === entry.mc_name) {
          item.classList.add('selected');
          SELECTED_PLAYER = entry.mc_name;
        }
      });
      
      // Notiz eintragen
      if (noteInput) {
        noteInput.value = entry.note || '';
      }
    } else {
      // Notiz leeren
      if (noteInput) {
        noteInput.value = '';
      }
    }
  } catch (error) {
    // Kein Eintrag gefunden - Notiz leeren
    if (noteInput) {
      noteInput.value = '';
    }
  }
  
  modal.style.display = 'flex';
}

function closePlayerModal() {
  document.getElementById('playerModal').style.display = 'none';
  SELECTED_DATE = null;
  SELECTED_PLAYER = null;
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
  
  // Speichern-Button
  document.getElementById('savePlayer').addEventListener('click', savePlayerToCalendar);
  
  // Entfernen-Button
  document.getElementById('removePlayer').addEventListener('click', removePlayerFromCalendar);
  
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
// KALENDER DATENBANK OPERATIONEN
// =========================
async function savePlayerToCalendar() {
  if (!SELECTED_DATE) {
    alert('Kein Datum ausgewählt!');
    return;
  }
  
  try {
    const dateString = formatDateForDB(SELECTED_DATE);
    const noteInput = document.getElementById('dayNote');
    const note = noteInput ? noteInput.value.trim() : '';
    
    // Prüfen ob bereits ein Eintrag existiert
    const { data: existing } = await window.supabaseClient
      .from("kalender_eintraege")
      .select("id")
      .eq("date", dateString)
      .single();
    
    if (existing) {
      // Bestehenden Eintrag aktualisieren
      if (SELECTED_PLAYER) {
        await window.supabaseClient
          .from("kalender_eintraege")
          .update({ 
            mc_name: SELECTED_PLAYER,
            note: note 
          })
          .eq("date", dateString);
      } else {
        // Nur Notiz aktualisieren
        await window.supabaseClient
          .from("kalender_eintraege")
          .update({ note: note })
          .eq("date", dateString);
      }
    } else {
      // Neuen Eintrag erstellen (nur wenn Spieler ausgewählt)
      if (SELECTED_PLAYER) {
        await window.supabaseClient
          .from("kalender_eintraege")
          .insert([{ 
            date: dateString, 
            mc_name: SELECTED_PLAYER,
            note: note 
          }]);
      } else {
        alert('Bitte wähle einen Spieler aus!');
        return;
      }
    }
    
    // Benachrichtigung
    if (window.showTeamNotification) {
      const message = SELECTED_PLAYER 
        ? `${SELECTED_PLAYER} für ${formatDateDisplay(SELECTED_DATE)} eingetragen${note ? ' (mit Notiz)' : ''}`
        : `Notiz für ${formatDateDisplay(SELECTED_DATE)} aktualisiert`;
      
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

async function removePlayerFromCalendar() {
  if (!SELECTED_DATE) {
    alert('Kein Datum ausgewählt!');
    return;
  }
  
  try {
    const dateString = formatDateForDB(SELECTED_DATE);
    
    await window.supabaseClient
      .from("kalender_eintraege")
      .delete()
      .eq("date", dateString);
    
    // Benachrichtigung
    if (window.showTeamNotification) {
      window.showTeamNotification(
        CURRENT_MC_NAME,
        `Eintrag für ${formatDateDisplay(SELECTED_DATE)} entfernt`,
        'info'
      );
    }
    
    closePlayerModal();
    renderKalender();
    
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
