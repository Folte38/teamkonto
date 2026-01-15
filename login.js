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

  // 👉 Interne Fake-Mail aus MC-Namen bauen
  const email = `${mcName}@teamhp.local`;

  const { error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    errorEl.innerText = "Login fehlgeschlagen (Name oder Passwort falsch)";
    errorEl.style.display = "block";
    console.error(error);
    return;
  }

  // ✅ Erfolgreich eingeloggt
  window.location.href = "index.html";
}
