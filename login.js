// =========================
// LOGIN CHECK (NUR FÜR WEITERLEITUNG)
// =========================
// Die login.html sollte keine Session-Prüfung haben, da sie selbst die Login-Seite ist
// Wir prüfen nur, ob der Benutzer bereits eingeloggt ist, um ihn weiterzuleiten

window.supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    // Wenn bereits eingeloggt, direkt zur Hauptseite weiterleiten
    window.location.href = "index.html";
  }
  // Wenn nicht eingeloggt, bleibt der Benutzer auf der Login-Seite
});

// Formular-Submit Handler
function handleLoginSubmit(event) {
  event.preventDefault(); // Verhindert Seiten-Reload
  login();
}

// Enter-Taste Event Listener
document.addEventListener("DOMContentLoaded", function() {
  const mcNameInput = document.getElementById("mcName");
  const passwordInput = document.getElementById("password");
  
  // Enter-Taste in beiden Input-Feldern abfangen
  mcNameInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      passwordInput.focus(); // Springe zum Passwort-Feld
    }
  });
  
  passwordInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      login(); // Führe Login aus
    }
  });
});

async function login() {
  const mcNameInput = document.getElementById("mcName");
  const passwordInput = document.getElementById("password");
  const errorEl = document.getElementById("error");

  const mcName = mcNameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!mcName || !password) {
    errorEl.innerText = "Bitte Minecraft-Name und Passwort eingeben";
    errorEl.style.display = "block";
    return;
  }

  try {
    // 1. Zuerst prüfen, ob Profil existiert und additional_password überprüfen
    console.log("Suche Profil für:", mcName);
    
    // Case-insensitive Suche: zuerst alle Profile holen und dann im JavaScript filtern
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('additional_password, mc_name');
    
    if (profilesError) {
      console.error("Datenbank-Fehler:", profilesError);
      errorEl.innerText = "Datenbank-Fehler. Bitte kontaktiere einen Admin.";
      errorEl.style.display = "block";
      return;
    }
    
    // Case-insensitive Filterung
    const profile = profiles.find(p => p.mc_name.toLowerCase() === mcName.toLowerCase());
    
    console.log("Gefundenes Profil:", profile);

    if (!profile) {
      console.log("Kein Profil gefunden für:", mcName);
      errorEl.innerText = `Profil für "${mcName}" nicht gefunden. Bitte wende dich an einen Admin.`;
      errorEl.style.display = "block";
      return;
    }

    // 2. Zusätzliches Passwort überprüfen (falls gesetzt)
    if (profile.additional_password && profile.additional_password.trim() !== '') {
      console.log("Prüfe additional_password...");
      
      // Vor dem Login alle Session-Daten leren um Cache-Probleme zu vermeiden
      localStorage.clear();
      sessionStorage.clear();
      
      if (profile.additional_password === password) {
        // additional_password stimmt überein - Login mit localStorage
        localStorage.setItem('currentUser', JSON.stringify({
          mc_name: profile.mc_name,
          id: profile.mc_name,
          authenticated: true,
          method: 'additional_password'
        }));
        
        console.log("Login erfolgreich mit additional_password!");
        
        // Login-Benachrichtigung anzeigen
        if (window.showTeamNotification) {
          window.showTeamNotification(
            profile.mc_name,
            `${profile.mc_name} hat sich angemeldet.`,
            'success'
          );
        }
        
        window.location.href = "index.html";
        return;
      }
      // additional_password stimmt nicht überein - aber vielleicht ist es das Supabase Passwort
      console.log("additional_password falsch, versuche Supabase Auth...");
    }
    
    // 3. Supabase Authentication versuchen (immer, egal ob additional_password existiert)
    console.log("Versuche Supabase Auth mit:", `${mcName}@teamhp.local`);
    const { error: authError } = await window.supabaseClient.auth.signInWithPassword({
      email: `${mcName}@teamhp.local`,
      password
    });

    if (authError) {
      // Wenn additional_password existiert aber falsch war, spezifische Meldung
      if (profile.additional_password && profile.additional_password.trim() !== '') {
        errorEl.innerText = "Passwort falsch. Bitte überprüfe deine Eingabe (additional_password oder Supabase Passwort).";
      } else {
        errorEl.innerText = "Login fehlgeschlagen. Bitte überprüfe Name und Passwort.";
      }
      errorEl.style.display = "block";
      console.error("Supabase Auth-Fehler:", authError);
      return;
    }

    // ✅ Erfolgreich mit Supabase eingeloggt
    console.log("Login erfolgreich mit Supabase!");
    
    // Login-Benachrichtigung anzeigen
    if (window.showTeamNotification) {
      window.showTeamNotification(
        mcName,
        `${mcName} hat sich angemeldet.`,
        'success'
      );
    }
    
    window.location.href = "index.html";

  } catch (error) {
    errorEl.innerText = "Unerwarteter Fehler beim Login. Bitte versuche es erneut.";
    errorEl.style.display = "block";
    console.error("Login-Exception:", error);
  }
}
