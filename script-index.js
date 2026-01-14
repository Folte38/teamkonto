// =========================
// LOGIN CHECK
// =========================
window.supabaseClient.auth.getSession().then(({ data }) => {
  if (!data.session) {
    window.location.href = "login.html";
  }
});

// =========================
// HILFSFUNKTIONEN
// =========================
function formatMoney(value) {
  return value.toLocaleString() + " $";
}

function getCurrentWeek() {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// =========================
// KONSTANTEN
// =========================
const START_BALANCE = 7000000;
const WEEKLY_CONTRIBUTION = 2000000;
const CURRENT_WEEK = getCurrentWeek();

let SELECTED_WEEK = CURRENT_WEEK;
let IS_ADMIN = false;

// =========================
// TEAMZIELE (DYNAMISCH)
// =========================
let EDITING_GOAL_ID = null; // ID des gerade bearbeiteten Ziels

async function loadTeamGoals() {
  console.log("🎯 loadTeamGoals() wurde aufgerufen!");
  const goalsEl = document.getElementById("goalsList");
  if (!goalsEl) {
    console.error("❌ goalsList Element nicht gefunden!");
    return;
  }

  console.log("✅ goalsList Element gefunden:", goalsEl);
  goalsEl.innerHTML = '<div class="loading">Lade Ziele...</div>';

  try {
    console.log("Lade Teamziele aus Datenbank...");
    
    const { data: goals, error } = await window.supabaseClient
      .from("team_goals")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    console.log("Teamziele Ergebnis:", { goals, error });

    if (error) {
      console.error("Fehler beim Laden der Teamziele:", error);
      goalsEl.innerHTML = `<div class="no-entries">Fehler: ${error.message}</div>`;
      return;
    }

    if (!goals || goals.length === 0) {
      console.log("Keine Teamziele gefunden");
      goalsEl.innerHTML = '<div class="no-entries">Keine Teamziele gesetzt</div>';
      return;
    }

    console.log(`${goals.length} Teamziele gefunden:`, goals);
    goalsEl.innerHTML = "";

    goals.forEach(goal => {
      console.log("Verarbeite Ziel:", goal);
      // Progress sicherstellen - falls null, 1 verwenden
      const progress = goal.progress !== null ? goal.progress : 1;
      const done = progress >= 100;
      const percent = progress;

      goalsEl.innerHTML += `
        <div class="goal-container ${done ? "done" : ""}" data-goal-id="${goal.id}">
          <div class="goal-header">
            <strong>${goal.name}</strong>
            ${done ? `<span class="goal-done">ABGESCHLOSSEN</span>` : ""}
            ${IS_ADMIN ? `
              <div class="goal-actions">
                <button class="goal-edit-btn" onclick="editGoal('${goal.id}', '${goal.name}', ${goal.cost}, ${progress})" title="Bearbeiten">✏️</button>
                <button class="goal-delete-btn" onclick="deleteGoal('${goal.id}')" title="Löschen">×</button>
              </div>
            ` : ""}
          </div>

          <div class="goal-details">
            <small><strong>Ziel:</strong> ${goal.cost.toLocaleString()} $</small><br>
            <small><strong>Aktuell:</strong> ${Math.round(goal.cost * progress / 100).toLocaleString()} $</small><br>
            <small><strong>Benötigt:</strong> ${Math.max(0, goal.cost - Math.round(goal.cost * progress / 100)).toLocaleString()} $</small><br>
            <small><strong>Fortschritt:</strong> ${percent}%</small><br>
            <small><strong>Erstellt:</strong> ${new Date(goal.created_at).toLocaleDateString('de-DE')}</small>
          </div>

          <div class="progress-bar">
            <div class="progress-fill" style="width:${percent}%"></div>
            <span class="progress-text">${percent}%</span>
          </div>
        </div>
      `;
    });
    
    console.log("✅ Teamziele erfolgreich geladen und angezeigt");
    console.log("🎯 goalsList Inhalt nach Laden:", goalsEl.innerHTML);
  } catch (error) {
    console.error("Unerwarteter Fehler beim Laden der Teamziele:", error);
    goalsEl.innerHTML = `<div class="error">Fehler: ${error.message}</div>`;
  }
}

// =========================
// PROFIL & NAV
// =========================
async function loadProfile() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return;

  const { data: profile, error } = await window.supabaseClient
    .from("profiles")
    .select("mc_name, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) return;

  IS_ADMIN = profile.role === "admin";

  const navUser = document.getElementById("navUser");
  const navUsername = document.getElementById("navUsername");
  const navAvatar = document.getElementById("navAvatar");

  if (navUser) {
    navUsername.innerText = profile.mc_name;
    navAvatar.src = `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
  }

  // Ausgabe-Option nur für Admins anzeigen (nur noch im Archiv-Modal)
  setTimeout(() => {
    const ausgabeOption = document.getElementById("ausgabeOption");
    if (ausgabeOption) {
      ausgabeOption.style.display = IS_ADMIN ? "block" : "none";
    }
    
    // Teamziele-+Button nur für Admins anzeigen
    const goalAddBtn = document.getElementById("goalAddBtn");
    if (goalAddBtn) {
      goalAddBtn.style.display = IS_ADMIN ? "flex" : "none";
    }
  }, 0);
}

// =========================
// WOCHEN DROPDOWN
// =========================
async function loadWeeks() {
  const { data, error } = await window.supabaseClient
    .from("payments")
    .select("week")
    .not("week", "is", null);

  if (error) return;

  const weeks = [...new Set(data.map(d => d.week))].sort().reverse();
  const select = document.getElementById("weekSelect");
  const wrapper = document.querySelector(".week-select");

  if (!select) return;

  select.innerHTML = "";

  weeks.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    if (w === CURRENT_WEEK) opt.selected = true;
    select.appendChild(opt);
  });

  SELECTED_WEEK = select.value || CURRENT_WEEK;

  if (wrapper) {
    wrapper.style.display = weeks.length > 1 ? "flex" : "none";
  }
}

const weekSelect = document.getElementById("weekSelect");
if (weekSelect) {
  weekSelect.addEventListener("change", () => {
    SELECTED_WEEK = weekSelect.value;
    loadPaymentsFromDB();
    loadPlayerPaymentStatus();
    loadArchive();
  });
}

// =========================
// KASSE / ZAHLEN
// =========================
async function loadPaymentsFromDB() {
  const { data: payments, error } = await window.supabaseClient
    .from("payments")
    .select("type, amount")
    .eq("week", SELECTED_WEEK || CURRENT_WEEK);

  if (error) return;

  let beitrag = 0, spende = 0, ausgabe = 0;

  payments.forEach(p => {
    if (p.type === "beitrag") beitrag += p.amount;
    if (p.type === "spende") spende += p.amount;
    if (p.type === "ausgabe") ausgabe += p.amount;
  });

  const income = beitrag + spende;
  const balance = START_BALANCE + income - ausgabe;

  document.getElementById("income").textContent = formatMoney(income);
  document.getElementById("expenses").textContent = formatMoney(ausgabe);
  document.getElementById("balance").textContent = formatMoney(balance);

  document.getElementById("incContrib").textContent = formatMoney(beitrag);
  document.getElementById("incExtra").textContent = formatMoney(spende);
}

// =========================
// SPIELERSTATUS
// =========================
async function loadPlayerPaymentStatus() {
  console.log("Lade Spielerstatus für Woche:", SELECTED_WEEK || CURRENT_WEEK);
  
  const el = document.getElementById("players");
  if (!el) {
    console.error("Spieler-Container nicht gefunden!");
    return;
  }

  // Loading-Status anzeigen
  el.innerHTML = '<div class="loading">Lade Spieler...</div>';
  
  // Footer auf "Wird geladen..." setzen
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.textContent = `Team Kasse · Stand diese Woche · Spieler werden geladen...`;
  }

  try {
    // Alle Profile laden
    const { data: profiles, error: profilesError } = await window.supabaseClient
      .from("profiles")
      .select("id, mc_name");
      
    if (profilesError || !profiles) {
      console.error("Fehler beim Laden der Profile:", profilesError);
      el.innerHTML = '<div class="error">Fehler beim Laden der Spieler</div>';
      
      // Footer mit Fehler aktualisieren
      if (footer) {
        footer.textContent = `Team Kasse · Stand diese Woche · Fehler beim Laden`;
      }
      return;
    }
    
    console.log("Profile geladen:", profiles.length);

    // Zahlungen für aktuelle Woche laden
    const { data: payments, error: paymentsError } = await window.supabaseClient
      .from("payments")
      .select("user_id, amount")
      .eq("type", "beitrag")
      .eq("week", SELECTED_WEEK || CURRENT_WEEK);
      
    if (paymentsError) {
      console.error("Fehler beim Laden der Zahlungen:", paymentsError);
    }
    
    console.log("Zahlungen geladen:", payments?.length || 0);

    const sums = {};
    if (payments) {
      payments.forEach(p => {
        sums[p.user_id] = (sums[p.user_id] || 0) + p.amount;
      });
    }

    el.innerHTML = "";
    
    // Spieler rendern
    profiles.forEach(p => {
      const sum = sums[p.id] || 0;
      let status = "unpaid";
      let label = "Nicht bezahlt";

      if (sum >= WEEKLY_CONTRIBUTION) {
        status = "paid";
        label = "Bezahlt";
      } else if (sum > 0) {
        status = "partial";
        label = "Teilzahlung";
      }

      el.innerHTML += `
        <div class="player ${status}">
          <img src="https://mc-heads.net/avatar/${p.mc_name}/64" 
               alt="${p.mc_name}"
               onerror="this.src='https://mc-heads.net/avatar/Steve/64'">
          <div class="name">${p.mc_name}</div>
          <small>${label}</small>
        </div>
      `;
    });

    const paidCount = profiles.filter(p => (sums[p.id] || 0) >= WEEKLY_CONTRIBUTION).length;
    const totalCount = profiles.length;
    
    // Status-Farbe basierend auf Anzahl der bezahlenden Spieler
    let statusClass = "";
    if (paidCount === 0) {
      statusClass = "status-red"; // Niemand bezahlt
    } else if (paidCount < totalCount) {
      statusClass = "status-orange"; // Teilweise bezahlt
    } else {
      statusClass = "status-green"; // Alle bezahlt
    }
    
    const statusLine = document.getElementById("statusLine");
    statusLine.innerText = `${SELECTED_WEEK} · ${paidCount} / ${totalCount} Spieler bezahlt`;
    statusLine.className = `status ${statusClass}`;
    
    // FOOTER AKTUALISIEREN - WICHTIG!
    if (footer) {
      footer.textContent = `with ♥️ by Folte38 & TobiWanNoobie · Team Kasse · Stand diese Woche · ${profiles.length} Spieler`;
      console.log(`Footer aktualisiert: ${profiles.length} Spieler`);
    }
    
  } catch (error) {
    console.error("Unerwarteter Fehler:", error);
    el.innerHTML = '<div class="error">Systemfehler beim Laden der Spieler</div>';
    
    if (footer) {
      footer.textContent = `Team Kasse · Stand diese Woche · Fehler aufgetreten`;
    }
  }
}

// =========================
// ARCHIV
// =========================
async function loadArchive() {
  const el = document.getElementById("archiveList");
  if (!el) return;

  const { data, error } = await window.supabaseClient
    .from("payments")
    .select(`
      type,
      amount,
      note,
      created_at,
      profiles ( mc_name )
    `)
    .eq(
      "week",
      SELECTED_WEEK && SELECTED_WEEK !== ""
        ? SELECTED_WEEK
        : CURRENT_WEEK
    )
    .order("created_at", { ascending: false })
    .limit(15); // Etwas mehr Einträge für Scrollbarkeit

  if (error) {
    console.error("Fehler beim Laden des Archivs:", error);
    el.innerHTML = '<div class="no-entries">Keine Einträge gefunden</div>';
    return;
  }

  if (!data || data.length === 0) {
    el.innerHTML = '<div class="no-entries">Keine Einträge für diese Woche</div>';
    return;
  }

  el.innerHTML = "";

  data.forEach(p => {
    const sign = p.type === "ausgabe" ? "-" : "+";
    const cls = p.type === "ausgabe" ? "expense" : "income";

    const label =
      p.type === "beitrag" ? "Wochenbeitrag" :
      p.type === "spende" ? "Spende" :
      "Ausgabe";

    el.innerHTML += `
      <div class="archive-entry ${cls}">
        <div class="amount">${sign} ${p.amount.toLocaleString()} $</div>
        <div class="description">${label}${p.note ? " · " + p.note : ""}</div>
        <div class="meta">${p.profiles?.mc_name || "—"} • ${new Date(p.created_at).toLocaleDateString('de-DE')}</div>
      </div>
    `;
  });
  
  // Container-Höhen nach Laden anpassen
  setTimeout(adjustContainerHeights, 50);
}

// =========================
// ARCHIV MODAL FUNKTIONEN
// =========================
function showArchiveModal() {
  const modal = document.getElementById("archiveModal");
  if (modal) {
    modal.style.display = "flex";
    
    // Admin-Option anzeigen/ausblenden
    const ausgabeOption = document.getElementById("archiveAusgabeOption");
    if (ausgabeOption) {
      ausgabeOption.style.display = IS_ADMIN ? "block" : "none";
    }
  }
}

function hideArchiveModal() {
  const modal = document.getElementById("archiveModal");
  if (modal) {
    modal.style.display = "none";
    document.getElementById("archivePaymentForm").reset();
    document.getElementById("archivePaymentMsg").innerText = "";
  }
}

// Archiv-Modal Event Listener
document.addEventListener("DOMContentLoaded", () => {
  // Archiv-+Button
  const archiveAddBtn = document.getElementById("archiveAddBtn");
  if (archiveAddBtn) {
    archiveAddBtn.addEventListener("click", showArchiveModal);
  }
  
  // Modal schließen
  const closeArchiveModal = document.getElementById("closeArchiveModal");
  if (closeArchiveModal) {
    closeArchiveModal.addEventListener("click", hideArchiveModal);
  }
  
  // Modal klick außerhalb schließen
  const archiveModal = document.getElementById("archiveModal");
  if (archiveModal) {
    archiveModal.addEventListener("click", (e) => {
      if (e.target === archiveModal) {
        hideArchiveModal();
      }
    });
  }
  
  // ESC-Taste zum Schließen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideArchiveModal();
    }
  });
});

// Archiv-Formular absenden
document.addEventListener("DOMContentLoaded", () => {
  const archivePaymentForm = document.getElementById("archivePaymentForm");
  if (archivePaymentForm) {
    archivePaymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return;

      const type = document.getElementById("archivePaymentType").value;
      const amount = parseInt(document.getElementById("archivePaymentAmount").value);
      const note = document.getElementById("archivePaymentNote").value;
      const archivePaymentMsg = document.getElementById("archivePaymentMsg");

      if (!amount || amount <= 0) {
        archivePaymentMsg.innerText = "❌ Bitte gültigen Betrag eingeben";
        return;
      }

      const { error } = await window.supabaseClient
        .from("payments")
        .insert([{
          user_id: user.id,
          type,
          amount,
          note,
          week: SELECTED_WEEK || CURRENT_WEEK
        }]);

      if (error) {
        archivePaymentMsg.innerText = error.message;
      } else {
        archivePaymentMsg.innerText = "✅ Eintrag gespeichert";
        archivePaymentForm.reset();
        loadPaymentsFromDB();
        loadPlayerPaymentStatus();
        loadArchive();
        
        // Modal nach 1 Sekunde schließen
        setTimeout(() => {
          hideArchiveModal();
        }, 1000);
      }
    });
  }
  
  // Kommentar-Sichtbarkeit für Archiv-Formular
  const archivePaymentTypeSelect = document.getElementById("archivePaymentType");
  const archivePaymentNoteInput = document.getElementById("archivePaymentNote");

  if (archivePaymentTypeSelect && archivePaymentNoteInput) {
    function updateArchiveNoteVisibility() {
      const type = archivePaymentTypeSelect.value;

      if (type === "spende" || type === "ausgabe") {
        archivePaymentNoteInput.style.display = "block";
      } else {
        archivePaymentNoteInput.style.display = "none";
        archivePaymentNoteInput.value = "";
      }
    }

    archivePaymentTypeSelect.addEventListener("change", updateArchiveNoteVisibility);
    updateArchiveNoteVisibility();
  }
});

// =========================
// TEAMZIELE MODAL FUNKTIONEN
// =========================
function showGoalModal() {
  const modal = document.getElementById("goalModal");
  if (modal) {
    modal.style.display = "flex";
    // Formular zurücksetzen für neues Ziel
    resetGoalForm();
  }
}

function hideGoalModal() {
  const modal = document.getElementById("goalModal");
  if (modal) {
    modal.style.display = "none";
    resetGoalForm();
  }
}

function resetGoalForm() {
  EDITING_GOAL_ID = null;
  document.getElementById("goalForm").reset();
  document.getElementById("goalModalTitle").textContent = " Neues Teamziel";
  document.getElementById("goalSubmitBtn").textContent = "Ziel hinzufügen";
  document.getElementById("goalMsg").innerText = "";
}

// Ziel bearbeiten
function editGoal(goalId, name, cost, progress) {
  EDITING_GOAL_ID = goalId;
  
  const modal = document.getElementById("goalModal");
  document.getElementById("goalModalTitle").textContent = " Teamziel bearbeiten";
  document.getElementById("goalSubmitBtn").textContent = "Ziel aktualisieren";
  document.getElementById("goalName").value = name;
  document.getElementById("goalCost").value = cost;
  
  // Aktuelle Summe berechnen und eintragen
  const currentAmount = Math.round(cost * progress / 100);
  document.getElementById("goalCurrent").value = currentAmount;
  
  modal.style.display = "flex";
}

// Ziel löschen (vollständig aus Datenbank)
async function deleteGoal(goalId) {
  console.log("🗑️ Lösche Ziel:", goalId);
  if (!confirm("Möchtest du dieses Ziel wirklich endgültig löschen?")) {
    console.log("❌ Löschen abgebrochen");
    return;
  }
  
  try {
    console.log("🗑️ Starte Löschen aus Datenbank...");
    const { error } = await window.supabaseClient
      .from("team_goals")
      .delete()
      .eq("id", goalId);
      
    console.log("🗑️ Delete Ergebnis:", { error });
      
    if (error) {
      console.error("❌ Fehler beim Löschen:", error);
      alert("Fehler beim Löschen: " + error.message);
    } else {
      console.log("✅ Ziel erfolgreich gelöschen!");
      alert("Ziel wurde erfolgreich gelöscht!");
      loadTeamGoals(); // Ziele neu laden
    }
  } catch (error) {
    console.error("❌ Unerwarteter Fehler beim Löschen:", error);
    alert("Fehler beim Löschen: " + error.message);
  }
}

// Teamziele-Modal Event Listener
document.addEventListener("DOMContentLoaded", () => {
  // Teamziele-+Button
  const goalAddBtn = document.getElementById("goalAddBtn");
  if (goalAddBtn) {
    goalAddBtn.addEventListener("click", showGoalModal);
  }
  
  // Modal schließen
  const closeGoalModal = document.getElementById("closeGoalModal");
  if (closeGoalModal) {
    closeGoalModal.addEventListener("click", hideGoalModal);
  }
  
  // Modal klick außerhalb schließen
  const goalModal = document.getElementById("goalModal");
  if (goalModal) {
    goalModal.addEventListener("click", (e) => {
      if (e.target === goalModal) {
        hideGoalModal();
      }
    });
  }
  
  // ESC-Taste zum Schließen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideGoalModal();
    }
  });
});

// Teamziele-Formular absenden
document.addEventListener("DOMContentLoaded", () => {
  const goalForm = document.getElementById("goalForm");
  if (goalForm) {
    goalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return;

      const name = document.getElementById("goalName").value;
      const cost = parseInt(document.getElementById("goalCost").value);
      const current = parseInt(document.getElementById("goalCurrent").value) || 0;
      
      // Fortschritt aus aktueller Summe berechnen
      const progress = Math.min(Math.max(Math.round((current / cost) * 100), 1), 100);
      
      const goalMsg = document.getElementById("goalMsg");

      if (!name || !cost || cost <= 0) {
        goalMsg.innerText = " Bitte alle Felder ausfüllen";
        return;
      }

      let result;
      if (EDITING_GOAL_ID) {
        // Bestehendes Ziel aktualisieren
        console.log("Aktualisiere Ziel:", EDITING_GOAL_ID, { name, cost, progress, current });
        result = await window.supabaseClient
          .from("team_goals")
          .update({
            name,
            cost,
            progress
          })
          .eq("id", EDITING_GOAL_ID);
          
        if (!result.error) {
          console.log("Ziel erfolgreich aktualisiert");
          goalMsg.innerText = "✅ Ziel aktualisiert";
        }
      } else {
        // Neues Ziel erstellen
        console.log("Erstelle neues Ziel:", { name, cost, progress, current, userId: user.id });
        result = await window.supabaseClient
          .from("team_goals")
          .insert([{
            name,
            cost,
            progress,
            created_by: user.id,
            is_active: true
          }]);
          
        if (!result.error) {
          console.log("Ziel erfolgreich erstellt:", result.data);
          goalMsg.innerText = "✅ Ziel hinzugefügt";
        }
      }

      console.log("Ergebnis:", result);
      
      if (result.error) {
        console.error("Fehler beim Speichern:", result.error);
        goalMsg.innerText = result.error.message;
      } else {
        goalForm.reset();
        console.log("Lade Teamziele neu...");
        
        // WICHTIG: Explizit warten und neu laden
        setTimeout(async () => {
          console.log(" Erzwinge Neuladen der Teamziele...");
          await loadTeamGoals();
          console.log("✅ Teamziele neu geladen");
        }, 100);
        
        // Modal nach 1 Sekunde schließen
        setTimeout(() => {
          hideGoalModal();
        }, 1000);
      }
    });
  }
});

// ... (rest of the code remains the same)
// LOGIN-BENACHRICHTIGUNG (verwendet globale Funktionen)
// =========================
// Die Login-Benachrichtigungen werden jetzt über notifications.js verwaltet

// =========================
// INIT - ORIGINAL VERSION
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 INIT wird ausgeführt...");
  
  await loadProfile();
  console.log("✅ loadProfile abgeschlossen");
  
  await loadWeeks();
  console.log("✅ loadWeeks abgeschlossen");
  
  loadPaymentsFromDB();
  console.log("✅ loadPaymentsFromDB abgeschlossen");
  
  loadPlayerPaymentStatus();
  console.log("✅ loadPlayerPaymentStatus abgeschlossen");
  
  loadTeamGoals();
  console.log("✅ loadTeamGoals aufgerufen");
  
  loadArchive();
  console.log("✅ loadArchive abgeschlossen");
  
  console.log("🎯 Alle Initialisierungen abgeschlossen!");
  
  // Login-Benachrichtigung wird automatisch über notifications.js gesendet
});