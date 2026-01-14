async function login() {
  const mcNameInput = document.getElementById("mcName");
  const passwordInput = document.getElementById("password");
  const errorEl = document.getElementById("error");

  errorEl.innerText = "";

  const mcName = mcNameInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!mcName || !password) {
    errorEl.innerText = "Bitte Minecraft-Name und Passwort eingeben";
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
    console.error(error);
    return;
  }

  // ✅ Erfolgreich eingeloggt
  window.location.href = "index.html";
}
