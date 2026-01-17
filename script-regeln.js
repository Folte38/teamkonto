// =========================
// LOGIN CHECK & SEITEN-WECHSEL
// =========================
document.addEventListener("DOMContentLoaded", async function() {
  const auth = await window.checkAuthentication();
  
  if (!auth.authenticated) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Navigation initialisieren wie bei index.html
    const navUser = document.getElementById("navUser");
    const navUsername = document.getElementById("navUsername");
    const navAvatar = document.getElementById("navAvatar");
    
    if (navUser && navUsername && navAvatar) {
      const currentUser = await window.getCurrentUser();
      if (currentUser) {
        navUsername.innerText = currentUser.mc_name;
        navAvatar.src = `https://mc-heads.net/avatar/${currentUser.mc_name}/64`;
        navUser.style.display = "flex";
      }
    }
    
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

// =========================
// APP INITIALISIERUNG
// =========================
function initializeApp() {
  loadProfile().then(() => {
    loadRegeln();
    setupEventListeners();
  });
}

// =========================
// PROFIL & NAV - EXAKTE LOGIK VON INDEX.HTML
// =========================
async function loadProfile() {
  const currentUser = await window.getCurrentUser();
  if (!currentUser) return Promise.resolve();

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

    if (error || !profileData) return Promise.resolve();
    profile = profileData;
  }

  // GLOBALE VARIABLEN SETZEN - WICHTIG FÜR API-AUFRUFE
  CURRENT_USER_ID = currentUser.id;
  CURRENT_MC_NAME = profile.mc_name;
  IS_ADMIN = profile.role === "admin";

  console.log("✅ loadProfile(): Globale Variablen gesetzt:", {
    CURRENT_USER_ID,
    CURRENT_MC_NAME,
    IS_ADMIN
  });

  // Navigation IMMER aktualisieren bei Benutzerwechsel
  const navUser = document.getElementById("navUser");
  const navUsername = document.getElementById("navUsername");
  const navAvatar = document.getElementById("navAvatar");

  if (navUser) {
    navUsername.innerText = profile.mc_name;
    navAvatar.src = `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
  }
}

// =========================
// GLOBALE VARIABLEN
// =========================
let CURRENT_USER_ID = null;
let CURRENT_MC_NAME = null;
let IS_ADMIN = false;

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
// EVENT LISTENER SETUP
// =========================
function setupEventListeners() {
  // Admin-Button sichtbar machen wenn Admin
  const editBtn = document.getElementById("editRulesBtn");
  if (editBtn) {
    if (IS_ADMIN) {
      editBtn.style.display = 'block';
      editBtn.addEventListener("click", openEditModal);
    } else {
      editBtn.style.display = 'none';
    }
  }
  
  // Modal Buttons
  const closeBtn = document.getElementById("closeEditModal");
  if (closeBtn) {
    closeBtn.addEventListener('click', closeEditModal);
  }

  const saveBtn = document.getElementById("saveRegeln");
  if (saveBtn) {
    saveBtn.addEventListener('click', saveRegeln);
  }

  const cancelBtn = document.getElementById("cancelEdit");
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeEditModal);
  }

  // ESC-Taste zum Schließen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
    }
  });

  // Modal Overlay klick
  const modal = document.getElementById('editModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeEditModal();
      }
    });
  }

  // Logout-Button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
}

// =========================
// REGELN LADEN & ANZEIGEN
// =========================
async function loadRegeln() {
  try {
    console.log('🔍 DEBUG - Lade Regeln aus Datenbank...');
    
    const { data: regeln } = await window.supabaseClient
      .from("team_regeln")
      .select("content, updated_at, change_note")
      .order("updated_at", { ascending: false })
      .limit(1);

    console.log('🔍 DEBUG - Gefundene Regeln:', regeln);

    if (regeln && regeln.length > 0) {
      const regel = regeln[0];
      console.log('🔍 DEBUG - Zeige Regeln:', regel.content);
      updateRegelnDisplay(regel.content);
      updateLastUpdated(regel.updated_at);
      
      // Letzte Änderung im Header anzeigen
      const lastUpdatedHeader = document.getElementById('lastUpdated');
      if (lastUpdatedHeader && regel.change_note) {
        const date = new Date(regel.updated_at);
        const formatted = date.toLocaleDateString('de-DE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        lastUpdatedHeader.textContent = `Letzte Änderung: ${formatted} - ${regel.change_note}`;
      }
    } else {
      console.log('🔍 DEBUG - Keine Regeln gefunden');
    }
  } catch (error) {
    console.error('Fehler beim Laden der Regeln:', error);
  }
}

function updateRegelnDisplay(content) {
  const container = document.getElementById('regelnContainer');
  if (container && content) {
    container.innerHTML = content;
  }
}

function updateLastUpdated(updatedAt) {
  const lastUpdated = document.getElementById('lastUpdated');
  if (lastUpdated && updatedAt) {
    const date = new Date(updatedAt);
    const formatted = date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    lastUpdated.textContent = `Letzte Änderung: ${formatted}`;
  }
}

// =========================
// EDIT MODAL FUNKTIONEN
// =========================
function openEditModal() {
  if (!IS_ADMIN) {
    alert('Nur Admins können die Regeln bearbeiten!');
    return;
  }

  const modal = document.getElementById('editModal');
  const regelnText = document.getElementById('regelnText');
  
  // Aktuelle Regeln in Textarea laden
  const currentContent = document.getElementById('regelnContainer').innerHTML;
  regelnText.value = currentContent;
  
  modal.style.display = 'flex';
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.style.display = 'none';
  
  // Formular zurücksetzen
  document.getElementById('regelnText').value = '';
  document.getElementById('changeNote').value = '';
}

async function saveRegeln() {
  if (!IS_ADMIN) {
    alert('Nur Admins können die Regeln speichern!');
    return;
  }

  const content = document.getElementById('regelnText').value;
  const changeNote = document.getElementById('changeNote').value;

  if (!content.trim()) {
    alert('Der Regeln-Text darf nicht leer sein!');
    return;
  }

  if (!changeNote.trim()) {
    alert('Bitte gib eine Änderungsnotiz ein!');
    return;
  }

  try {
    // Prüfen ob bereits Regeln existieren
    const { data: existing } = await window.supabaseClient
      .from("team_regeln")
      .select("id")
      .limit(1);

    if (existing && existing.length > 0) {
      // Bestehende Regeln aktualisieren
      await window.supabaseClient
        .from("team_regeln")
        .update({ 
          content: content,
          change_note: changeNote,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing[0].id);
    } else {
      // Neue Regeln erstellen
      await window.supabaseClient
        .from("team_regeln")
        .insert([{ 
          content: content,
          change_note: changeNote,
          created_by: CURRENT_USER_ID
        }]);
    }

    console.log('🔍 DEBUG - Regeln gespeichert:', { content, changeNote });

    // Benachrichtigung
    if (window.showTeamNotification) {
      window.showTeamNotification(
        CURRENT_MC_NAME,
        `Regeln wurden aktualisiert: ${changeNote}`,
        'success'
      );
    }

    // Modal schließen und neu laden
    closeEditModal();
    loadRegeln();

  } catch (error) {
    console.error('Fehler beim Speichern der Regeln:', error);
    alert('Fehler beim Speichern: ' + error.message);
  }
}

// =========================
// INITIALIZIERUNG
// =========================
