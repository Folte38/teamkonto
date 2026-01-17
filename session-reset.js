// =========================
// SESSION-RESET TOOL - MANUELLES SESSION-CLEARING
// =========================

// Funktion zum sofortigen Löschen aller Session-Daten
function resetSession() {
  console.log("🧹 RESET SESSION - Lösche alle Session-Daten...");
  
  // Alle localStorage Daten löschen
  localStorage.removeItem('currentSession');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('authToken');
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('supabase.auth.refreshToken');
  
  // sessionStorage löschen
  sessionStorage.clear();
  
  // Globale Variablen zurücksetzen
  if (typeof CURRENT_USER_ID !== 'undefined') {
    CURRENT_USER_ID = null;
  }
  if (typeof CURRENT_MC_NAME !== 'undefined') {
    CURRENT_MC_NAME = null;
  }
  if (typeof IS_ADMIN !== 'undefined') {
    IS_ADMIN = false;
  }
  
  // Session-Manager zurücksetzen
  if (window.lastKnownUser) {
    window.lastKnownUser = null;
  }
  
  console.log("✅ Session komplett zurückgesetzt");
  
  // Seite neu laden für sauberen Start
  setTimeout(() => {
    window.location.reload();
  }, 100);
}

// Funktion zum Debuggen der aktuellen Session
function debugSession() {
  console.log("🔍 DEBUG SESSION:");
  console.log("localStorage currentSession:", localStorage.getItem('currentSession'));
  console.log("localStorage currentUser:", localStorage.getItem('currentUser'));
  console.log("window.lastKnownUser:", window.lastKnownUser);
  console.log("CURRENT_USER_ID:", typeof CURRENT_USER_ID !== 'undefined' ? CURRENT_USER_ID : 'undefined');
  console.log("CURRENT_MC_NAME:", typeof CURRENT_MC_NAME !== 'undefined' ? CURRENT_MC_NAME : 'undefined');
  console.log("IS_ADMIN:", typeof IS_ADMIN !== 'undefined' ? IS_ADMIN : 'undefined');
}

// Funktion zum sofortigen Account-Wechsel
function switchToAccount(accountName) {
  console.log("🔄 SWITCH TO ACCOUNT:", accountName);
  
  // Komplettes Reset
  resetSession();
  
  // Warten auf Reset und dann neuen Account setzen
  setTimeout(() => {
    const newUserData = {
      authenticated: true,
      mc_name: accountName,
      method: 'additional_password'
    };
    localStorage.setItem('currentUser', JSON.stringify(newUserData));
    
    // Session-Manager informieren
    if (window.clearOldSession) {
      window.clearOldSession();
    }
    
    console.log("✅ Account-Wechsel zu", accountName, "erfolgreich");
    
    // Seite neu laden
    setTimeout(() => {
      window.location.reload();
    }, 200);
  }, 150);
}

// Global verfügbar machen
window.resetSession = resetSession;
window.debugSession = debugSession;
window.switchToAccount = switchToAccount;

// Auto-Reset bei Account-Wechsel (falls nötig)
window.forceAccountReset = function(newAccountName) {
  console.log("🔄 FORCE ACCOUNT RESET für:", newAccountName);
  
  // Alte Session löschen
  resetSession();
  
  // Neuen Account in currentUser setzen (falls vorhanden)
  if (newAccountName) {
    const newUserData = {
      authenticated: true,
      mc_name: newAccountName,
      method: 'additional_password'
    };
    localStorage.setItem('currentUser', JSON.stringify(newUserData));
  }
};

// Sofortiges Gerry237 Switch
window.switchToGerry237 = function() {
  switchToAccount('Gerry237');
};

// Sofortiges TobiWanNoobie Switch
window.switchToTobiWanNoobie = function() {
  switchToAccount('TobiWanNoobie');
};

// Sofortiges Logout (komplett)
window.forceLogout = function() {
  console.log("🚪 FORCE LOGOUT - Komplettes Session-Clearing");
  
  // Alle localStorage Daten löschen
  localStorage.clear();
  
  // sessionStorage löschen
  sessionStorage.clear();
  
  // Globale Variablen zurücksetzen
  if (typeof CURRENT_USER_ID !== 'undefined') {
    CURRENT_USER_ID = null;
  }
  if (typeof CURRENT_MC_NAME !== 'undefined') {
    CURRENT_MC_NAME = null;
  }
  if (typeof IS_ADMIN !== 'undefined') {
    IS_ADMIN = false;
  }
  
  // Session-Manager zurücksetzen
  if (window.lastKnownUser) {
    window.lastKnownUser = null;
  }
  
  console.log("✅ Force Logout komplett - alle Daten gelöscht");
  
  // Sofortiger Redirect zur Login-Seite
  const timestamp = new Date().getTime();
  window.location.href = `login.html?t=${timestamp}&forceLogout=${timestamp}`;
};

// Debug-Logout (zeigt was gelöscht wird)
window.debugLogout = function() {
  console.log("🔍 DEBUG LOGOUT - Zeige aktuelle Session-Daten:");
  console.log("localStorage currentSession:", localStorage.getItem('currentSession'));
  console.log("localStorage currentUser:", localStorage.getItem('currentUser'));
  console.log("localStorage authToken:", localStorage.getItem('authToken'));
  console.log("localStorage supabase.auth.token:", localStorage.getItem('supabase.auth.token'));
  console.log("sessionStorage:", Object.keys(sessionStorage));
  console.log("Globale Variablen:", {
    CURRENT_USER_ID: typeof CURRENT_USER_ID !== 'undefined' ? CURRENT_USER_ID : 'undefined',
    CURRENT_MC_NAME: typeof CURRENT_MC_NAME !== 'undefined' ? CURRENT_MC_NAME : 'undefined',
    IS_ADMIN: typeof IS_ADMIN !== 'undefined' ? IS_ADMIN : 'undefined'
  });
  console.log("window.lastKnownUser:", window.lastKnownUser);
};

console.log("session-reset.js geladen - resetSession(), debugSession(), switchToAccount() verfügbar");
console.log("Sofort-Commands: switchToGerry237(), switchToTobiWanNoobie(), forceLogout(), debugLogout()");
