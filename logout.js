// =========================
// LOGOUT-FUNKTION
// =========================
async function logout() {
  if (!window.supabaseClient) {
    console.error('Supabase Client nicht verfügbar');
    return;
  }

  try {
    // Logout-Benachrichtigung senden BEVOR ausgeloggt wird
    if (window.sendGlobalLogoutNotification) {
      await window.sendGlobalLogoutNotification();
      // Kurz warten, damit die Benachrichtigung gesendet werden kann
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const { error } = await window.supabaseClient.auth.signOut();
    
    if (error) {
      console.error('Fehler beim Ausloggen:', error);
      alert('Fehler beim Ausloggen: ' + error.message);
      return;
    }

    // Erfolgreich ausgeloggt - zur Login-Seite weiterleiten
    window.location.href = "login.html";
  } catch (error) {
    console.error('Unerwarteter Fehler beim Ausloggen:', error);
    alert('Ein Fehler ist aufgetreten beim Ausloggen.');
  }
}

// Logout-Button Event Listener hinzufügen
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});
