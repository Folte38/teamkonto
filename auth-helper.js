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
        
        // Setze current_setting für RLS Policies
        try {
          await supabaseClient.rpc('set_config', { 
            key: 'app.current_mc_name', 
            value: profile.mc_name 
          });
          console.log("Current setting gesetzt für:", profile.mc_name);
        } catch (settingError) {
          console.log("Konnte current_setting nicht setzen:", settingError);
        }
        
        return {
          ...profile,
          id: profile.id || auth.user.id,
          mc_name: profile.mc_name,
          email: `${profile.mc_name}@teamhp.local`,
          method: 'additional_password'
        };
      } else {
        console.log("Datenbankabfrage fehlgeschlagen, nutze localStorage Daten:", error);
        // Fallback: nutze die Daten aus localStorage
        return {
          ...auth.user,
          id: auth.user.id || auth.user.mc_name,
          mc_name: auth.user.mc_name,
          email: `${auth.user.mc_name}@teamhp.local`,
          role: 'user', // Standardrolle
          method: 'additional_password'
        };
      }
    } else {
      // Supabase Methode
      console.log("getCurrentUser: Supabase Methode für", auth.user.email);
      return {
        ...auth.user,
        method: 'supabase'
      };
    }
  }
  
  console.log("getCurrentUser: Nicht authentifiziert");
  return null;
}

// Logout Funktion für beide Methoden
async function logout() {
  try {
    // localStorage leeren
    localStorage.removeItem('currentUser');
    
    // Supabase logout
    await supabaseClient.auth.signOut();
    
    // Zur Login-Seite weiterleiten
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Logout Fehler:", error);
    // Trotzdem zur Login-Seite weiterleiten
    window.location.href = 'login.html';
  }
}

// Global verfügbar machen
window.checkAuthentication = checkAuthentication;
window.getCurrentUser = getCurrentUser;
window.logout = logout;
