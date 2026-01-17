// =========================
// LOGOUT-FUNKTION
// =========================
async function logout() {
  console.log("🚪 START LOGOUT - Komplettes Session-Clearing");
  
  try {
    // 1. Logout-Benachrichtigung senden BEVOR ausgeloggt wird
    if (window.sendGlobalLogoutNotification) {
      await window.sendGlobalLogoutNotification();
      console.log("✅ Logout-Benachrichtigung gesendet");
      // Kurz warten, damit die Benachrichtigung gesendet werden kann
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 2. KOMPLETTES SESSION-CLEARING
    console.log("🧹 Lösche alle Session-Daten...");
    
    // Alle localStorage Daten löschen
    localStorage.removeItem('currentSession');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    localStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('supabase.auth.refreshToken');
    
    // sessionStorage komplett löschen
    sessionStorage.clear();
    
    // Globale Variablen zurücksetzen (falls vorhanden)
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
    
    console.log("✅ Alle Session-Daten gelöscht");
    
    // 3. Supabase Logout
    if (window.supabaseClient) {
      const { error } = await window.supabaseClient.auth.signOut();
      
      if (error) {
        console.error('Fehler beim Supabase Logout:', error);
        // Trotzdem weitermachen mit lokalem Logout
      } else {
        console.log("✅ Supabase Logout erfolgreich");
      }
    }
    
    // 4. Erzwungener Redirect zur Login-Seite mit Cache-Busting
    const timestamp = new Date().getTime();
    console.log("🔄 Redirect zur Login-Seite mit Cache-Busting");
    window.location.href = `login.html?t=${timestamp}&logout=${timestamp}`;
    
  } catch (error) {
    console.error('Unerwarteter Fehler beim Ausloggen:', error);
    
    // Trotzdem erzwungener Redirect
    const timestamp = new Date().getTime();
    window.location.href = `login.html?t=${timestamp}&error=${timestamp}`;
  }
}

// Logout-Button Event Listener hinzufügen
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
    console.log("✅ Logout-Button Event Listener hinzugefügt");
  }
});

// Global verfügbar machen
window.logout = logout;
