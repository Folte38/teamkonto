// =========================
// SESSION-CHANGE MANAGER - ZENTRALE NAVIGATIONS-AKTUALISIERUNG
// =========================
let lastKnownUser = null;

// Session-Clearing Funktion - Alte Session sofort löschen
function clearOldSession() {
  console.log("🧹 Lösche alte Session-Daten...");
  localStorage.removeItem('currentSession');
  localStorage.removeItem('currentUser');
  lastKnownUser = null;
  console.log("✅ Session-Daten gelöscht");
}

// Session-Change Listener für sofortige Navigation-Updates
function setupSessionChangeListener() {
  // Überwache Auth-Änderungen alle 500ms (schneller für sofortige Updates)
  setInterval(async () => {
    try {
      const auth = await window.checkAuthentication();
      const currentUser = await window.getCurrentUser();
      
      if (auth.authenticated && currentUser) {
        // IMMER prüfen auf Account-Wechsel
        if (!lastKnownUser || lastKnownUser.id !== currentUser.id || lastKnownUser.mc_name !== currentUser.mc_name) {
          console.log(`🔄 Session-Change erkannt: ${lastKnownUser?.mc_name || 'unbekannt'} → ${currentUser.mc_name}`);
          
          // Wenn sich der Account geändert hat, alte Session löschen
          if (lastKnownUser && lastKnownUser.id !== currentUser.id) {
            clearOldSession();
          }
          
          // Navigation sofort aktualisieren
          await updateNavigationImmediate(currentUser);
          
          // Globale Variablen sofort aktualisieren
          await updateGlobalVariables(currentUser);
          
          // Forms und andere Elemente aktualisieren
          await updateFormsAndElements(currentUser);
          
          // Benachrichtigungen sofort aktualisieren
          await updateNotifications(currentUser);
          
          // Session-Cookies aktualisieren
          await refreshSessionCookies(currentUser);
          
          lastKnownUser = { id: currentUser.id, mc_name: currentUser.mc_name };
          
          console.log("✅ Session-Change komplett aktualisiert - kein Reload nötig");
        }
      } else {
        // User ausgeloggt
        if (lastKnownUser) {
          console.log(`🔄 User ausgeloggt: ${lastKnownUser.mc_name}`);
          lastKnownUser = null;
          hideNavigation();
        }
      }
    } catch (error) {
      console.error("Session-Check Fehler:", error);
    }
  }, 500); // Alle 500ms prüfen für sofortige Updates
}

// Session-Cookies sofort aktualisieren
async function refreshSessionCookies(currentUser) {
  try {
    // Für additional_password Methode
    if (currentUser.method === 'additional_password') {
      // Session-Cookie aktualisieren
      const sessionData = {
        user_id: currentUser.id,
        mc_name: currentUser.mc_name,
        method: 'additional_password',
        timestamp: Date.now()
      };
      
      // In localStorage speichern für sofortige Erkennung
      localStorage.setItem('currentSession', JSON.stringify(sessionData));
      console.log("✅ Session-Cookie aktualisiert:", sessionData);
    }
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Session-Cookies:", error);
  }
}

// Globale Variablen sofort aktualisieren
async function updateGlobalVariables(currentUser) {
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

  // Globale Variablen aktualisieren (falls vorhanden)
  if (typeof CURRENT_USER_ID !== 'undefined') {
    CURRENT_USER_ID = currentUser.id;
    console.log("✅ CURRENT_USER_ID aktualisiert:", CURRENT_USER_ID);
  }
  if (typeof CURRENT_MC_NAME !== 'undefined') {
    CURRENT_MC_NAME = profile.mc_name;
    console.log("✅ CURRENT_MC_NAME aktualisiert:", CURRENT_MC_NAME);
  }
  if (typeof IS_ADMIN !== 'undefined') {
    IS_ADMIN = profile.role === "admin";
    console.log("✅ IS_ADMIN aktualisiert:", IS_ADMIN);
  }
}

// Forms und andere Elemente aktualisieren
async function updateFormsAndElements(currentUser) {
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

  // Formular vorausfüllen (falls vorhanden)
  const creditUser = document.getElementById("creditUser");
  if (creditUser) {
    creditUser.value = profile.mc_name;
    console.log("✅ Formular aktualisiert:", profile.mc_name);
  }
  
  // Lager-spezifische Elemente aktualisieren (falls vorhanden)
  const currentUserAvatar = document.getElementById("currentUserAvatar");
  const currentUserName = document.getElementById("currentUserName");
  
  if (currentUserAvatar) {
    currentUserAvatar.src = `https://mc-heads.net/avatar/${profile.mc_name}/32`;
  }
  if (currentUserName) {
    currentUserName.textContent = profile.mc_name;
  }
  
  // Admin-spezifische Elemente aktualisieren
  const adminIndicator = document.getElementById('adminIndicator');
  if (adminIndicator) {
    if (profile.role === "admin") {
      adminIndicator.style.display = 'inline';
      adminIndicator.style.color = '#4CAF50';
    } else {
      adminIndicator.style.display = 'none';
    }
  }
}

// Benachrichtigungen sofort aktualisieren
async function updateNotifications(currentUser) {
  // Benachrichtigungs-System sofort aktualisieren
  if (window.updateCurrentUser && typeof window.updateCurrentUser === 'function') {
    try {
      await window.updateCurrentUser();
      console.log("✅ Benachrichtigungen sofort aktualisiert");
    } catch (error) {
      console.error("❌ Fehler bei Benachrichtigungs-Update:", error);
    }
  }
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

  // Navigation sofort aktualisieren - IMMER aktualisieren
  const navUser = document.getElementById("navUser");
  const navUsername = document.getElementById("navUsername");
  const navAvatar = document.getElementById("navAvatar");

  if (navUser && navUsername && navAvatar) {
    const currentName = navUsername.innerText;
    const newName = profile.mc_name;
    
    // IMMER aktualisieren - keine Bedingung mehr
    console.log(`🔄 Navigation aktualisiert: ${currentName} → ${newName}`);
    navUsername.innerText = newName;
    navAvatar.src = `https://mc-heads.net/avatar/${newName}/64`;
    navUser.style.display = "flex";
    
    // Globale Variablen auch hier sofort aktualisieren
    if (typeof CURRENT_USER_ID !== 'undefined') {
      CURRENT_USER_ID = currentUser.id;
    }
    if (typeof CURRENT_MC_NAME !== 'undefined') {
      CURRENT_MC_NAME = newName;
    }
    if (typeof IS_ADMIN !== 'undefined') {
      IS_ADMIN = profile.role === "admin";
    }
  }
}

// Navigation ausblenden
function hideNavigation() {
  const navUser = document.getElementById("navUser");
  if (navUser) {
    navUser.style.display = "none";
  }
}

// Global verfügbar machen
window.setupSessionChangeListener = setupSessionChangeListener;
window.updateNavigationImmediate = updateNavigationImmediate;
window.updateGlobalVariables = updateGlobalVariables;
window.updateFormsAndElements = updateFormsAndElements;
window.updateNotifications = updateNotifications;
window.refreshSessionCookies = refreshSessionCookies;
window.clearOldSession = clearOldSession;
