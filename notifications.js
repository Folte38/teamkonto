// =========================
// GEMEINSAME BENACHRICHTIGUNGS-FUNKTIONEN
// =========================

// Einfache Benachrichtigung anzeigen
function showNotification(message, type = 'info') {
  const existingNotification = document.querySelector('.simple-notification');
  if (existingNotification) existingNotification.remove();
  
  const notification = document.createElement('div');
  notification.className = `simple-notification ${type}`;
  
  notification.innerHTML = `
    <div class="notification-message">${message}</div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 8px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    transform: translateX(0);
    opacity: 1;
  `;
  
  document.body.appendChild(notification);
  
  // Automatisch entfernen nach 3 Sekunden
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

// Benachrichtigung mit MC-Kopf anzeigen
function showTeamNotification(mcName, message, type = 'info') {
  const existingNotification = document.querySelector('.team-notification');
  if (existingNotification) existingNotification.remove();
  
  const notification = document.createElement('div');
  notification.className = `team-notification ${type}`;
  
  const avatarUrl = `https://mc-heads.net/avatar/${mcName}/32`;
  
  notification.innerHTML = `
    <img src="${avatarUrl}" alt="${mcName}" class="notification-avatar" 
         onerror="this.src='https://mc-heads.net/avatar/Steve/32'">
    <div class="notification-content">
      <div class="notification-message">${message}</div>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 12px;
    background: ${type === 'success' ? 'rgba(76, 175, 80, 0.95)' : 'rgba(33, 150, 243, 0.95)'};
    color: white;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 5px 20px rgba(0,0,0,0.4);
    animation: slideInRight 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 250px;
    max-width: 400px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// CSS für Animationen hinzufügen
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .notification-avatar {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      flex-shrink: 0;
    }
    
    .notification-content {
      flex: 1;
    }
    
    .notification-message {
      line-height: 1.4;
    }
  `;
  document.head.appendChild(style);
}

// =========================
// REAL-TIME BENACHRICHTIGUNGEN SETUP
// =========================

let notificationsChannel = null;
let currentUserId = null;
let currentMcName = null;

// Aktuellen Benutzer laden
async function loadCurrentUser() {
  if (!window.supabaseClient) return;
  
  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (user) {
      currentUserId = user.id;
      
      // MC-Name aus Profil laden
      const { data: profile } = await window.supabaseClient
        .from("profiles")
        .select("mc_name")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        currentMcName = profile.mc_name;
      }
    }
  } catch (error) {
    console.error('Fehler beim Laden des aktuellen Benutzers:', error);
  }
}

function setupRealtimeNotifications() {
  if (!window.supabaseClient) {
    console.error('Supabase Client nicht verfügbar');
    return;
  }

  // Channel für Item-Benachrichtigungen erstellen
  notificationsChannel = window.supabaseClient
    .channel('team-item-notifications')
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'team_item_usage' 
      }, 
      async (payload) => {
        // Item wurde ausgeliehen
        const usage = payload.new;
        
        // Profil des Benutzers laden
        const { data: profile } = await window.supabaseClient
          .from("profiles")
          .select("mc_name")
          .eq("id", usage.user_id)
          .single();
        
        if (profile) {
          // Item-Name laden
          const { data: item } = await window.supabaseClient
            .from("team_items")
            .select("name")
            .eq("id", usage.item_id)
            .single();
          
          if (item && window.showTeamNotification) {
            // Aktuellen Benutzer prüfen für personalisierte Nachricht
            try {
              const { data: { user } } = await window.supabaseClient.auth.getUser();
              if (user && usage.user_id === user.id) {
                // Für sich selbst
                showTeamNotification(
                  profile.mc_name,
                  `${item.name} ausgeliehen`,
                  'success'
                );
              } else {
                // Für andere
                showTeamNotification(
                  profile.mc_name,
                  `${profile.mc_name} hat ${item.name} ausgeliehen`,
                  'info'
                );
              }
            } catch (error) {
              // Fallback wenn nicht eingeloggt
              showTeamNotification(
                profile.mc_name,
                `${profile.mc_name} hat ${item.name} ausgeliehen`,
                'info'
              );
            }
          }
        }
      }
    )
    .on('postgres_changes', 
      { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'team_item_usage' 
      }, 
      async (payload) => {
        // Item wurde zurückgelegt
        const oldUsage = payload.old;
        
        // Profil des Benutzers laden
        const { data: profile } = await window.supabaseClient
          .from("profiles")
          .select("mc_name")
          .eq("id", oldUsage.user_id)
          .single();
        
        if (profile) {
          // Item-Name laden
          const { data: item } = await window.supabaseClient
            .from("team_items")
            .select("name")
            .eq("id", oldUsage.item_id)
            .single();
          
          if (item && window.showTeamNotification) {
            // Aktuellen Benutzer prüfen für personalisierte Nachricht
            try {
              const { data: { user } } = await window.supabaseClient.auth.getUser();
              if (user && oldUsage.user_id === user.id) {
                // Für sich selbst
                showTeamNotification(
                  profile.mc_name,
                  `${item.name} zurückgelegt`,
                  'success'
                );
              } else {
                // Für andere
                showTeamNotification(
                  profile.mc_name,
                  `${profile.mc_name} hat ${item.name} zurückgelegt`,
                  'success'
                );
              }
            } catch (error) {
              // Fallback wenn nicht eingeloggt
              showTeamNotification(
                profile.mc_name,
                `${profile.mc_name} hat ${item.name} zurückgelegt`,
                'success'
              );
            }
          }
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Real-time Item-Benachrichtigungen aktiviert');
      }
    });
}

// Login-Benachrichtigung senden
async function sendLoginNotification() {
  if (!window.supabaseClient || !currentMcName) return;
  
  try {
    // Benachrichtigung in eine temporäre Tabelle schreiben oder direkt broadcasten
    // Da wir keine notifications-Tabelle haben, verwenden wir einen Broadcast-Channel
    const channel = window.supabaseClient.channel('login-broadcast');
    
    await channel.send({
      type: 'broadcast',
      event: 'login',
      payload: { mc_name: currentMcName }
    });
  } catch (error) {
    console.error('Fehler beim Senden der Login-Benachrichtigung:', error);
  }
}

// =========================
// LOGIN-SESSION VERWALTUNG
// =========================
let loginNotificationSent = false;
let currentSessionId = null;
let sessionInitialized = false;

// Session-ID generieren
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Login-Status prüfen und einmalige Benachrichtigung senden
async function checkAndSendLoginNotification() {
  if (!window.supabaseClient) return;
  
  try {
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
      loginNotificationSent = false;
      currentSessionId = null;
      sessionInitialized = false;
      return;
    }

    const { data: profile } = await window.supabaseClient
      .from("profiles")
      .select("mc_name")
      .eq("id", user.id)
      .single();

    if (!profile) return;

    // Prüfen ob dies eine neue Session ist
    const newSessionId = generateSessionId();
    if (!currentSessionId || currentSessionId !== newSessionId) {
      currentSessionId = newSessionId;
      loginNotificationSent = false;
      sessionInitialized = false;
    }

    // Nur senden wenn noch nicht gesendet in dieser Session UND Session noch nicht initialisiert
    if (!loginNotificationSent && !sessionInitialized) {
      console.log('Sende einmalige Login-Benachrichtigung für:', profile.mc_name);
      await sendGlobalLoginNotification();
      loginNotificationSent = true;
      sessionInitialized = true; // Session als initialisiert markieren
    }
  } catch (error) {
    console.error('Fehler beim Prüfen des Login-Status:', error);
  }
}

// Initialisierung beim Laden - warten bis Supabase bereit ist
function initializeNotifications() {
  // Prüfen ob Supabase Client verfügbar ist
  if (!window.supabaseClient) {
    console.log('Warte auf Supabase Client...');
    setTimeout(initializeNotifications, 100);
    return;
  }

  console.log('Initialisiere Benachrichtigungen...');
  loadCurrentUser();
  setupRealtimeNotifications();
  setupGlobalLoginNotifications();
  
  // Login-Status prüfen und einmalige Benachrichtigung senden
  setTimeout(() => {
    checkAndSendLoginNotification();
  }, 2000);
}

// Initialisierung starten
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNotifications);
} else {
  // DOM bereits geladen
  setTimeout(initializeNotifications, 100);
}

// =========================
// GLOBALE LOGIN-BENACHRICHTIGUNGEN
// =========================
let globalLoginChannel = null;
let globalLoginChannelReady = false;

function setupGlobalLoginNotifications() {
  if (!window.supabaseClient) {
    console.error('Supabase Client nicht verfügbar für Login-Benachrichtigungen');
    return;
  }
  
  // Prüfen ob bereits ein Channel existiert
  if (globalLoginChannel) {
    console.log('Login-Channel bereits vorhanden, entferne alten...');
    window.supabaseClient.removeChannel(globalLoginChannel);
  }
  
  // Einen einzigen globalen Channel für alle Seiten
  globalLoginChannel = window.supabaseClient.channel('team-login-notifications-global', {
    config: {
      broadcast: { self: true }
    }
  });
  
  globalLoginChannel.on('broadcast', { event: 'login' }, async (payload) => {
    console.log('Login-Broadcast empfangen:', payload);
    const { mc_name, user_id } = payload.payload;
    if (mc_name && window.showTeamNotification) {
      try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) {
          // Für alle Benutzer anzeigen (auch für sich selbst)
          console.log('Zeige Login-Benachrichtigung für:', mc_name);
          if (user.id === user_id) {
            showTeamNotification(mc_name, `Du hast dich angemeldet`, 'success');
          } else {
            showTeamNotification(mc_name, `${mc_name} hat sich angemeldet`, 'info');
          }
        }
      } catch (error) {
        console.error('Fehler beim Prüfen des Benutzers:', error);
      }
    }
  });
  
  // Logout-Benachrichtigungen
  globalLoginChannel.on('broadcast', { event: 'logout' }, async (payload) => {
    console.log('Logout-Broadcast empfangen:', payload);
    const { mc_name, user_id } = payload.payload;
    if (mc_name && window.showTeamNotification) {
      try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) {
          // Für alle Benutzer anzeigen (auch für sich selbst)
          console.log('Zeige Logout-Benachrichtigung für:', mc_name);
          if (user.id === user_id) {
            showTeamNotification(mc_name, `Du hast dich abgemeldet`, 'info');
          } else {
            showTeamNotification(mc_name, `${mc_name} hat sich abgemeldet`, 'info');
          }
        }
      } catch (error) {
        // Wenn nicht eingeloggt, ignoriere (Benutzer wurde bereits ausgeloggt)
      }
    }
  });
  
  globalLoginChannel.subscribe((status) => {
    console.log('Global Login-Channel Status:', status);
    if (status === 'SUBSCRIBED') {
      globalLoginChannelReady = true;
      console.log('✅ Login-Channel erfolgreich subscribed');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Global Login-Channel Fehler');
      globalLoginChannelReady = false;
    } else if (status === 'TIMED_OUT') {
      console.warn('⚠️ Login-Channel Timeout');
      globalLoginChannelReady = false;
    }
  });
}

async function sendGlobalLoginNotification() {
  if (!window.supabaseClient) {
    console.warn('Supabase Client nicht verfügbar für Login-Benachrichtigung');
    return;
  }
  
  try {
    const { data: { user }, error: userError } = await window.supabaseClient.auth.getUser();
    if (userError || !user) {
      console.log('Kein eingeloggter Benutzer gefunden');
      return;
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("mc_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.warn('Profil nicht gefunden:', profileError);
      return;
    }

    console.log('Versuche Login-Benachrichtigung zu senden für:', profile.mc_name);

    // Warten bis Channel bereit ist, dann senden
    const maxAttempts = 30;
    let attempts = 0;
    
    const trySend = () => {
      if (globalLoginChannelReady && globalLoginChannel) {
        try {
          const result = globalLoginChannel.send({
            type: 'broadcast',
            event: 'login',
            payload: { mc_name: profile.mc_name, user_id: user.id }
          });
          console.log('✅ Login-Benachrichtigung gesendet:', profile.mc_name, result);
        } catch (error) {
          console.error('Fehler beim Senden der Login-Benachrichtigung:', error);
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(trySend, 300);
          }
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        if (attempts % 5 === 0) {
          console.log(`Warte auf Login-Channel... (Versuch ${attempts}/${maxAttempts})`);
        }
        setTimeout(trySend, 200);
      } else {
        console.warn('⚠️ Login-Benachrichtigung konnte nicht gesendet werden - Channel nicht bereit nach', maxAttempts, 'Versuchen');
      }
    };
    
    trySend();
  } catch (error) {
    console.error('Unerwarteter Fehler beim Senden der Login-Benachrichtigung:', error);
  }
}

// Test-Funktion für Benachrichtigungen (kann in der Konsole aufgerufen werden)
window.testNotification = function() {
  showTeamNotification('TestUser', 'Dies ist eine Test-Benachrichtigung', 'info');
};

// Logout-Benachrichtigung senden
async function sendGlobalLogoutNotification() {
  if (!window.supabaseClient) {
    console.warn('Supabase Client nicht verfügbar für Logout-Benachrichtigung');
    return;
  }
  
  try {
    const { data: { user }, error: userError } = await window.supabaseClient.auth.getUser();
    if (userError || !user) {
      console.log('Kein eingeloggter Benutzer gefunden für Logout');
      return;
    }

    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("mc_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.warn('Profil nicht gefunden für Logout:', profileError);
      return;
    }

    console.log('Versuche Logout-Benachrichtigung zu senden für:', profile.mc_name);

    // Warten bis Channel bereit ist, dann senden
    const maxAttempts = 10;
    let attempts = 0;
    
    const trySend = () => {
      if (globalLoginChannelReady && globalLoginChannel) {
        try {
          globalLoginChannel.send({
            type: 'broadcast',
            event: 'logout',
            payload: { mc_name: profile.mc_name, user_id: user.id }
          });
          console.log('✅ Logout-Benachrichtigung gesendet:', profile.mc_name);
          
          // Session vollständig zurücksetzen für nächsten Login
          loginNotificationSent = false;
          currentSessionId = null;
          sessionInitialized = false;
        } catch (error) {
          console.error('Fehler beim Senden der Logout-Benachrichtigung:', error);
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(trySend, 100);
      }
    };
    
    trySend();
  } catch (error) {
    console.error('Unerwarteter Fehler beim Senden der Logout-Benachrichtigung:', error);
  }
}

// Globale Funktionen exportieren
window.showTeamNotification = showTeamNotification;
window.setupRealtimeNotifications = setupRealtimeNotifications;
window.loadCurrentUser = loadCurrentUser;
window.setupGlobalLoginNotifications = setupGlobalLoginNotifications;
window.sendGlobalLoginNotification = sendGlobalLoginNotification;
window.sendGlobalLogoutNotification = sendGlobalLogoutNotification;
window.checkAndSendLoginNotification = checkAndSendLoginNotification;

// Cleanup beim Verlassen der Seite
window.addEventListener('beforeunload', () => {
  if (notificationsChannel) {
    window.supabaseClient.removeChannel(notificationsChannel);
  }
});
