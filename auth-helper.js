// Session-Management für beide Auth-Methoden
console.log("auth-helper.js geladen");

// Prüft ob der Benutzer authentifiziert ist (entweder Supabase oder localStorage)
async function checkAuthentication() {
  try {
    // 1. Zuerst prüfen, ob Benutzer im localStorage ist (additional_password Methode)
    const localUser = localStorage.getItem('currentUser');
    if (localUser) {
      const user = JSON.parse(localUser);
      if (user.authenticated && user.method === 'additional_password') {
        console.log("Benutzer über additional_password authentifiziert:", user.mc_name);
        return { 
          authenticated: true, 
          user: user,
          method: 'additional_password'
        };
      }
    }

    // 2. Dann prüfen, ob Supabase Session existiert
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (session && !error) {
      console.log("Benutzer über Supabase authentifiziert:", session.user.email);
      return { 
        authenticated: true, 
        user: session.user,
        method: 'supabase'
      };
    }

    // 3. Nicht authentifiziert
    return { authenticated: false, user: null, method: null };

  } catch (error) {
    console.error("Auth-Check Fehler:", error);
    return { authenticated: false, user: null, method: null };
  }
}

// Holt den aktuellen Benutzer (egal welche Methode)
async function getCurrentUser() {
  // Zuerst prüfen, ob ein neuer Account angemeldet wurde (über currentUser)
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    try {
      const parsed = JSON.parse(currentUser);
      if (parsed.authenticated && parsed.method === 'additional_password') {
        console.log("🔄 getCurrentUser: Neuer Account erkannt:", parsed.mc_name);
        
        // Alte Session-Daten löschen
        localStorage.removeItem('currentSession');
        
        // Profil aus Datenbank holen
        const { data: profile, error } = await supabaseClient
          .from('profiles')
          .select('*')
          .eq('mc_name', parsed.mc_name)
          .single();
        
        if (profile && !error) {
          console.log("✅ getCurrentUser: Neues Profil geladen:", profile);
          
          // Neue Session-Daten speichern
          const newSessionData = {
            user_id: profile.id,
            mc_name: profile.mc_name,
            role: profile.role,
            method: 'additional_password',
            timestamp: Date.now()
          };
          localStorage.setItem('currentSession', JSON.stringify(newSessionData));
          
          return {
            id: profile.id,
            mc_name: profile.mc_name,
            role: profile.role,
            method: 'additional_password',
            ...profile
          };
        }
      }
    } catch (error) {
      console.error("❌ getCurrentUser: Fehler beim Lesen von currentUser:", error);
    }
  }
  
  // Dann localStorage prüfen für Session-Daten
  const sessionData = localStorage.getItem('currentSession');
  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData);
      console.log("🔄 getCurrentUser: Daten aus localStorage:", parsed);
      
      // Session-Daten validieren (nicht älter als 5 Minuten)
      if (parsed.timestamp && (Date.now() - parsed.timestamp) < 300000) {
        console.log("✅ getCurrentUser: Verwende localStorage Daten für:", parsed.mc_name);
        return parsed;
      } else {
        console.log("⚠️ getCurrentUser: localStorage Daten abgelaufen, lade neu");
        localStorage.removeItem('currentSession');
      }
    } catch (error) {
      console.error("❌ getCurrentUser: Fehler beim Lesen von localStorage:", error);
    }
  }
  
  const auth = await checkAuthentication();
  
  if (auth.authenticated) {
    if (auth.method === 'additional_password') {
      console.log("getCurrentUser: additional_password Methode für", auth.user.mc_name);
      
      // Für additional_password Methode, Profil aus Datenbank holen
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('mc_name', auth.user.mc_name)
        .single();
      
      if (profile && !error) {
        console.log("Profil aus Datenbank geladen:", profile);
        
        // set_config RPC existiert nicht, überspringen
        try {
          await supabaseClient.rpc('set_config', {
            p_user_id: profile.id,
            p_mc_name: profile.mc_name,
            p_role: profile.role
          });
        } catch (rpcError) {
          console.log("Überspringe set_config (RPC existiert nicht)");
        }
        
        // Session-Daten in localStorage speichern
        const newSessionData = {
          user_id: profile.id,
          mc_name: profile.mc_name,
          role: profile.role,
          method: 'additional_password',
          timestamp: Date.now()
        };
        localStorage.setItem('currentSession', JSON.stringify(newSessionData));
        
        return {
          id: profile.id,
          mc_name: profile.mc_name,
          role: profile.role,
          method: 'additional_password',
          ...profile
        };
      } else {
        console.error('Fehler beim Laden des Profils:', error);
        return null;
      }
    } else {
      // Supabase Methode - Session-Clearing bei Account-Wechsel
      console.log("getCurrentUser: Supabase Methode - prüfe auf Account-Wechsel");
      
      // Zuerst localStorage prüfen ob Account-Wechsel stattgefunden hat
      const sessionData = localStorage.getItem('currentSession');
      let hasAccountChanged = false;
      
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          const { data: { user } } = await supabaseClient.auth.getUser();
          
          if (user && parsed.mc_name && user.email !== parsed.email) {
            console.log("🔄 Account-Wechsel erkannt - alte Session löschen");
            localStorage.removeItem('currentSession');
            hasAccountChanged = true;
          }
        } catch (error) {
          console.error("❌ Fehler bei Account-Wechsel Prüfung:", error);
        }
      }
      
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error || !user) {
        console.error('Fehler beim Abrufen des Benutzers:', error);
        return null;
      }
      
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('mc_name, role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Fehler beim Abrufen des Profils:', profileError);
        return null;
      }
      
      // Session-Daten in localStorage speichern (immer bei Supabase)
      const newSessionData = {
        user_id: user.id,
        mc_name: profile.mc_name,
        role: profile.role,
        method: 'supabase',
        email: user.email, // Für Account-Wechsel Erkennung
        timestamp: Date.now()
      };
      localStorage.setItem('currentSession', JSON.stringify(newSessionData));
      
      console.log("✅ getCurrentUser: Supabase Session gespeichert für:", profile.mc_name);
      
      return {
        id: user.id,
        mc_name: profile.mc_name,
        role: profile.role,
        method: 'supabase',
        email: user.email,
        ...profile
      };
    }
  } else {
    console.log('Kein authentifizierter Benutzer gefunden');
    return null;
async function logout() {
  console.log("🔄 LOGOUT: Starte vollständiges Session-Clearing");
  
  try {
    // 1. localStorage komplett löschen
    localStorage.removeItem('currentSession');
    localStorage.removeItem('currentUser');
    console.log("✅ LOGOUT: localStorage komplett gelöscht");
    
    // 2. Supabase Logout falls angemeldet
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      await supabaseClient.auth.signOut();
      console.log("✅ LOGOUT: Supabase User ausgeloggt");
    }
    
    // 4. Globale Variablen zurücksetzen
    console.log("🧹 Setze globale Variablen zurück...");
    if (typeof CURRENT_USER_ID !== 'undefined') {
      CURRENT_USER_ID = null;
    }
    if (typeof CURRENT_MC_NAME !== 'undefined') {
      CURRENT_MC_NAME = null;
    }
    if (typeof IS_ADMIN !== 'undefined') {
      IS_ADMIN = false;
    }
    
    // 5. Session-Manager zurücksetzen
    if (window.lastKnownUser) {
      window.lastKnownUser = null;
    }
    
    console.log("✅ Logout komplett - alle Daten gelöscht");
    
    // 6. Erzwungener Reload zur Login-Seite (mit Cache-Busting)
    const timestamp = new Date().getTime();
    console.log("🔄 Redirect zur Login-Seite mit Cache-Busting");
    window.location.href = `login.html?t=${timestamp}&logout=${timestamp}`;
    
  } catch (error) {
    console.error("Logout Fehler:", error);
    // Trotzdem erzwungener Reload
    window.location.href = `login.html?t=${new Date().getTime()}`;
  }
}

// Global verfügbar machen
window.checkAuthentication = checkAuthentication;
window.getCurrentUser = getCurrentUser;
window.logout = logout;
