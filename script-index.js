// =========================
// SAUBERE VERSION - KEINE WORKAROUNDS MEHR
// =========================

// LOGIN CHECK & SEITEN-WECHSEL
window.supabaseClient.auth.getSession().then(({ data }) => {
  if (!data.session) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    initializeApp();
  }
});

// APP INITIALISIERUNG
function initializeApp() {
  loadProfile().then(() => {
    loadWeeks();
    loadPaymentsFromDB();
    loadPlayerPaymentStatus();
    loadArchive();
    loadTeamGoals();
    setupEventListeners();
  });
}

// EVENT LISTENER SETUP
function setupEventListeners() {
  const weekSelect = document.getElementById("weekSelect");
  if (weekSelect && !weekSelect.hasAttribute('data-listener-added')) {
    weekSelect.addEventListener("change", () => {
      SELECTED_WEEK = weekSelect.value;
      loadPaymentsFromDB();
      loadPlayerPaymentStatus();
      loadArchive();
    });
    weekSelect.setAttribute('data-listener-added', 'true');
  }
}

// HILFSFUNKTIONEN
function formatMoney(value) {
  return value.toLocaleString() + " $";
}

function getCurrentWeek() {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// KONSTANTEN
const START_BALANCE = 7000000;
const WEEKLY_CONTRIBUTION = 2000000;
const CURRENT_WEEK = getCurrentWeek();

let SELECTED_WEEK = CURRENT_WEEK;
let IS_ADMIN = false;
let EDITING_GOAL_ID = null;

// TEAMZIELE
async function loadTeamGoals() {
  const goalsEl = document.getElementById("goalsList");
  if (!goalsEl) return;

  goalsEl.innerHTML = '<div class="loading">Lade Ziele...</div>';

  try {
    const { data: goals, error } = await window.supabaseClient
      .from("team_goals")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      goalsEl.innerHTML = `<div class="no-entries">Fehler: ${error.message}</div>`;
      return;
    }

    if (!goals || goals.length === 0) {
      goalsEl.innerHTML = '<div class="no-entries">Keine Teamziele gesetzt</div>';
      return;
    }

    goalsEl.innerHTML = "";

    goals.forEach(goal => {
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
            <small><strong>Aktuell:</strong> ${goal.current_exact ? goal.current_exact.toLocaleString() : Math.round(goal.cost * goal.progress / 100).toLocaleString()} $</small><br>
            <small><strong>Benötigt:</strong> ${goal.current_exact ? Math.max(0, goal.cost - goal.current_exact).toLocaleString() : Math.max(0, goal.cost - Math.round(goal.cost * goal.progress / 100)).toLocaleString()} $</small><br>
            <small><strong>Fortschritt:</strong> ${goal.progress}%</small><br>
            <small><strong>Erstellt:</strong> ${new Date(goal.created_at).toLocaleDateString('de-DE')}</small>
          </div>

          <div class="progress-bar">
            <div class="progress-fill" style="width:${percent}%"></div>
            <span class="progress-text">${percent}%</span>
          </div>
        </div>
      `;
    });
    
  } catch (error) {
    goalsEl.innerHTML = `<div class="error">Fehler: ${error.message}</div>`;
  }
}

// PROFIL & NAV
async function loadProfile() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return Promise.resolve();

  const { data: profile, error } = await window.supabaseClient
    .from("profiles")
    .select("mc_name, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) return Promise.resolve();

  IS_ADMIN = profile.role === "admin";

  const navUser = document.getElementById("navUser");
  const navUsername = document.getElementById("navUsername");
  const navAvatar = document.getElementById("navAvatar");

  if (navUser) {
    navUsername.innerText = profile.mc_name;
    navAvatar.src = `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
  }

  // Admin-Optionen anzeigen
  setTimeout(() => {
    const ausgabeOption = document.getElementById("archiveAusgabeOption");
    if (ausgabeOption) {
      ausgabeOption.style.display = IS_ADMIN ? "block" : "none";
    }
    
    const goalAddBtn = document.getElementById("goalAddBtn");
    if (goalAddBtn) {
      goalAddBtn.style.display = IS_ADMIN ? "flex" : "none";
    }
  }, 0);
  
  return Promise.resolve();
}

// WOCHEN DROPDOWN
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

// KASSE / ZAHLEN
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
}

// SPIELERSTATUS
async function loadPlayerPaymentStatus() {
  const el = document.getElementById("players");
  if (!el) return;

  el.innerHTML = '<div class="loading">Lade Spieler...</div>';

  try {
    const { data: profiles, error: profilesError } = await window.supabaseClient
      .from("profiles")
      .select("id, mc_name, payment_status");
    
    if (profilesError || !profiles) {
      el.innerHTML = '<div class="error">Fehler beim Laden der Spieler</div>';
      return;
    }
    
    el.innerHTML = "";
    
    profiles.forEach(p => {
      const status = p.payment_status === 1 ? "paid" : "unpaid";
      const label = p.payment_status === 1 ? "Bezahlt" : "Nicht bezahlt";
      
      el.innerHTML += `
        <div class="player ${status} ${IS_ADMIN ? 'clickable' : ''}" data-player-id="${p.id}" data-player-name="${p.mc_name}">
          <img src="https://mc-heads.net/avatar/${p.mc_name}/64" 
               alt="${p.mc_name}"
               onerror="this.src='https://mc-heads.net/avatar/Steve/64'">
          <div class="name">${p.mc_name}</div>
          <small>${label}</small>
        </div>
      `;
    });
    
    const paidCount = profiles.filter(p => p.payment_status === 1).length;
    const totalCount = profiles.length;
    
    let statusClass = "";
    if (paidCount === 0) {
      statusClass = "status-red";
    } else if (paidCount < totalCount) {
      statusClass = "status-orange";
    } else {
      statusClass = "status-green";
    }
    
    const statusLine = document.getElementById("statusLine");
    if (statusLine) {
      const statusText = `${SELECTED_WEEK} · ${paidCount} / ${totalCount} Spieler bezahlt`;
      statusLine.innerText = statusText;
      statusLine.className = `status ${statusClass}`;
    }
    
    const footer = document.querySelector('.footer');
    if (footer) {
      footer.textContent = `♥️ by Folte38 & TobiWanNoobie · Dashboard · Stand diese Woche · ${profiles.length} Spieler`;
    }
    
  } catch (error) {
    el.innerHTML = '<div class="error">Systemfehler beim Laden der Spieler</div>';
  }
}

// ADMIN: SPIELER ALS BEZAHLT MARKIEREN
async function markPlayerAsPaid(playerId, playerName) {
  if (!IS_ADMIN) {
    alert("Nur Admins können diese Aktion durchführen!");
    return;
  }
  
  if (!confirm(`Möchtest du ${playerName} für diese Woche als bezahlt markieren?`)) {
    return;
  }
  
  try {
    // Spielerstatus aktualisieren
    const { error: statusError } = await window.supabaseClient
      .from("profiles")
      .update({ payment_status: 1 })
      .eq("id", playerId);
      
    if (statusError) {
      alert("Fehler beim Aktualisieren des Status: " + statusError.message);
      return;
    }
    
    // Archiv-Eintrag erstellen
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    
    if (user) {
      const { error: archiveError } = await window.supabaseClient
        .from("payments")
        .insert([{
          user_id: user.id,
          type: "beitrag",
          amount: 2000000,
          note: playerName,
          week: SELECTED_WEEK || CURRENT_WEEK
        }]);
        
      if (archiveError) {
        console.error("Fehler beim Archiv-Eintrag:", archiveError);
      }
    }
    
    alert(`${playerName} wurde erfolgreich als bezahlt markiert!`);
    
    // UI aktualisieren
    await Promise.all([
      loadPlayerPaymentStatus(),
      loadPaymentsFromDB(),
      loadArchive()
    ]);
    
  } catch (error) {
    alert("Fehler: " + error.message);
  }
}

// ADMIN: SPIELER ALS NICHT BEZAHLT MARKIEREN
async function markPlayerAsUnpaid(playerId, playerName) {
  if (!IS_ADMIN) {
    alert("Nur Admins können diese Aktion durchführen!");
    return;
  }
  
  if (!confirm(`Möchtest du ${playerName} für diese Woche als nicht bezahlt markieren?\n\nDer +2.000.000 $ Eintrag wird gelöscht!`)) {
    return;
  }
  
  try {
    // 2.000.000 Eintrag finden und löschen
    const { data: existingPayments } = await window.supabaseClient
      .from("payments")
      .select("*")
      .eq("type", "beitrag")
      .eq("amount", 2000000)
      .eq("note", playerName)
      .eq("week", SELECTED_WEEK || CURRENT_WEEK)
      .order("created_at", { ascending: false })
      .limit(1);
      
    if (existingPayments && existingPayments.length > 0) {
      const paymentToDelete = existingPayments[0];
      
      // Mit RPC löschen (umgeht RLS)
      const { error: deleteError } = await window.supabaseClient
        .rpc('delete_payment_admin', { payment_id: paymentToDelete.id });
        
      if (deleteError) {
        // Fallback: Direktes Delete
        const { error: fallbackError } = await window.supabaseClient
          .from("payments")
          .delete()
          .eq("id", paymentToDelete.id);
          
        if (fallbackError) {
          alert("Fehler beim Löschen des Eintrags: " + fallbackError.message);
          return;
        }
      }
    }
    
    // Spielerstatus aktualisieren
    const { error: statusError } = await window.supabaseClient
      .rpc('mark_player_as_unpaid', { player_uuid: playerId });
      
    if (statusError) {
      // Fallback: Direktes Update
      const { error: fallbackError } = await window.supabaseClient
        .from("profiles")
        .update({ payment_status: 0 })
        .eq("id", playerId);
        
      if (fallbackError) {
        alert("Fehler beim Aktualisieren des Status: " + fallbackError.message);
        return;
      }
    }
    
    alert(`${playerName} wurde erfolgreich als nicht bezahlt markiert!`);
    
    // UI aktualisieren
    await Promise.all([
      loadPlayerPaymentStatus(),
      loadPaymentsFromDB(),
      loadArchive()
    ]);
    
  } catch (error) {
    alert("Fehler: " + error.message);
  }
}

// ARCHIV
async function loadArchive() {
  const el = document.getElementById("archiveList");
  if (!el) return;

  const { data, error } = await window.supabaseClient
    .from("payments")
    .select(`
      id,
      type,
      amount,
      note,
      created_at,
      profiles ( mc_name )
    `)
    .eq("week", SELECTED_WEEK && SELECTED_WEEK !== "" ? SELECTED_WEEK : CURRENT_WEEK)
    .order("created_at", { ascending: false })
    .limit(15);

  if (error) {
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

    const label = p.type === "beitrag" ? "Wochenbeitrag" :
                 p.type === "spende" ? "Spende" : "Ausgabe";

    const escapedNote = (p.note || '').replace(/'/g, "\\'");

    el.innerHTML += `
      <div class="archive-entry ${cls}" data-payment-id="${p.id}">
        <div class="archive-content">
          <div class="amount">${sign} ${p.amount.toLocaleString()} $</div>
          <div class="description">${label}${p.note ? " · " + p.note : ""}</div>
          <div class="meta">${p.profiles?.mc_name || "—"} • ${new Date(p.created_at).toLocaleDateString('de-DE')}</div>
        </div>
        ${IS_ADMIN ? `<div class="archive-actions"><button class="archive-delete-btn" onclick="deleteArchiveEntry('${p.id}', '${p.type}', ${p.amount}, '${escapedNote}')" title="Eintrag löschen">×</button></div>` : ''}
      </div>
    `;
  });
}

// ADMIN: ARCHIV-EINTRAG LÖSCHEN
async function deleteArchiveEntry(paymentId, type, amount, note) {
  if (!IS_ADMIN) {
    alert("Nur Admins können diese Aktion durchführen!");
    return;
  }
  
  const typeLabel = type === "beitrag" ? "Wochenbeitrag" : type === "spende" ? "Spende" : "Ausgabe";
  const noteText = note ? ` (${note})` : "";
  
  if (!confirm(`Möchtest du diesen Eintrag wirklich löschen?\n\n${typeLabel}${noteText}: ${amount.toLocaleString()} $`)) {
    return;
  }
  
  try {
    // Mit RPC löschen
    const { error } = await window.supabaseClient
      .rpc('delete_payment_admin', { payment_id: paymentId });
      
    if (error) {
      // Fallback: Direktes Delete
      const { error: fallbackError } = await window.supabaseClient
        .from("payments")
        .delete()
        .eq("id", paymentId);
        
      if (fallbackError) {
        alert("Fehler beim Löschen: " + fallbackError.message);
        return;
      }
    }
    
    // Wenn es ein Wochenbeitrag war, Spielerstatus aktualisieren
    if (type === "beitrag" && note) {
      const { data: profile } = await window.supabaseClient
        .from("profiles")
        .select("id")
        .eq("mc_name", note)
        .single();
        
      if (profile) {
        await window.supabaseClient
          .from("profiles")
          .update({ payment_status: 0 })
          .eq("id", profile.id);
      }
    }
    
    alert("Eintrag wurde erfolgreich gelöscht!");
    
    // UI aktualisieren
    await Promise.all([
      loadPaymentsFromDB(),
      loadArchive(),
      loadPlayerPaymentStatus()
    ]);
    
  } catch (error) {
    alert("Fehler: " + error.message);
  }
}

// ARCHIV MODAL
function showArchiveModal() {
  const modal = document.getElementById("archiveModal");
  if (modal) {
    modal.style.display = "flex";
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

// TEAMZIELE MODAL
function showGoalModal() {
  const modal = document.getElementById("goalModal");
  if (modal) {
    modal.style.display = "flex";
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

function editGoal(goalId, name, cost, progress) {
  EDITING_GOAL_ID = goalId;
  
  const modal = document.getElementById("goalModal");
  document.getElementById("goalModalTitle").textContent = " Teamziel bearbeiten";
  document.getElementById("goalSubmitBtn").textContent = "Ziel aktualisieren";
  document.getElementById("goalName").value = name;
  document.getElementById("goalCost").value = cost;
  
  const currentAmount = Math.round(cost * progress / 100);
  document.getElementById("goalCurrent").value = currentAmount;
  
  modal.style.display = "flex";
}

async function deleteGoal(goalId) {
  if (!confirm("Möchtest du dieses Ziel wirklich endgültig löschen?")) {
    return;
  }
  
  try {
    const { error } = await window.supabaseClient
      .from("team_goals")
      .delete()
      .eq("id", goalId);
      
    if (error) {
      alert("Fehler beim Löschen: " + error.message);
    } else {
      alert("Ziel wurde erfolgreich gelöscht!");
      loadTeamGoals();
    }
  } catch (error) {
    alert("Fehler: " + error.message);
  }
}

// EVENT LISTENER
document.addEventListener("DOMContentLoaded", () => {
  // Archiv Modal
  const archiveAddBtn = document.getElementById("archiveAddBtn");
  if (archiveAddBtn) {
    archiveAddBtn.addEventListener("click", showArchiveModal);
  }
  
  const closeArchiveModal = document.getElementById("closeArchiveModal");
  if (closeArchiveModal) {
    closeArchiveModal.addEventListener("click", hideArchiveModal);
  }
  
  const archiveModal = document.getElementById("archiveModal");
  if (archiveModal) {
    archiveModal.addEventListener("click", (e) => {
      if (e.target === archiveModal) {
        hideArchiveModal();
      }
    });
  }
  
  // Teamziele Modal
  const goalAddBtn = document.getElementById("goalAddBtn");
  if (goalAddBtn) {
    goalAddBtn.addEventListener("click", showGoalModal);
  }
  
  const closeGoalModal = document.getElementById("closeGoalModal");
  if (closeGoalModal) {
    closeGoalModal.addEventListener("click", hideGoalModal);
  }
  
  const goalModal = document.getElementById("goalModal");
  if (goalModal) {
    goalModal.addEventListener("click", (e) => {
      if (e.target === goalModal) {
        hideGoalModal();
      }
    });
  }
  
  // ESC Taste
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideArchiveModal();
      hideGoalModal();
    }
  });
  
  // Spieler Click Handler
  document.addEventListener("click", (e) => {
    const playerBox = e.target.closest(".player.clickable");
    if (playerBox && IS_ADMIN) {
      const playerId = playerBox.dataset.playerId;
      const playerName = playerBox.dataset.playerName;
      const isPaid = playerBox.classList.contains("paid");
      
      if (isPaid) {
        markPlayerAsUnpaid(playerId, playerName);
      } else {
        markPlayerAsPaid(playerId, playerName);
      }
    }
  });
  
  // Archiv Formular
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
        
        setTimeout(() => {
          hideArchiveModal();
        }, 1000);
      }
    });
  }
  
  // Kommentar-Sichtbarkeit
  const archivePaymentTypeSelect = document.getElementById("archivePaymentType");
  const archivePaymentNoteInput = document.getElementById("archivePaymentNote");

  if (archivePaymentTypeSelect && archivePaymentNoteInput) {
    function updateArchiveNoteVisibility() {
      const type = archivePaymentTypeSelect.value;
      archivePaymentNoteInput.style.display = (type === "spende" || type === "ausgabe") ? "block" : "none";
      if (type === "beitrag") {
        archivePaymentNoteInput.value = "";
      }
    }

    archivePaymentTypeSelect.addEventListener("change", updateArchiveNoteVisibility);
    updateArchiveNoteVisibility();
  }
  
  // Teamziele Formular
  const goalForm = document.getElementById("goalForm");
  if (goalForm) {
    goalForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return;

      const name = document.getElementById("goalName").value;
      const cost = parseInt(document.getElementById("goalCost").value);
      const current = parseInt(document.getElementById("goalCurrent").value) || 0;
      
      const progress = Math.min(Math.max((current / cost) * 100, 0.01), 100);
      
      const goalMsg = document.getElementById("goalMsg");

      if (!name || !cost || cost <= 0) {
        goalMsg.innerText = "❌ Bitte alle Felder ausfüllen";
        return;
      }

      let result;
      if (EDITING_GOAL_ID) {
        result = await window.supabaseClient
          .from("team_goals")
          .update({
            name,
            cost,
            progress,
            current_exact: current
          })
          .eq("id", EDITING_GOAL_ID);
          
        if (!result.error) {
          goalMsg.innerText = "✅ Ziel aktualisiert";
        }
      } else {
        result = await window.supabaseClient
          .from("team_goals")
          .insert([{
            name,
            cost,
            progress,
            current_exact: current,
            created_by: user.id,
            is_active: true
          }]);
          
        if (!result.error) {
          goalMsg.innerText = "✅ Ziel hinzugefügt";
        }
      }

      if (result.error) {
        goalMsg.innerText = result.error.message;
      } else {
        goalForm.reset();
        
        setTimeout(async () => {
          await loadTeamGoals();
        }, 100);
        
        setTimeout(() => {
          hideGoalModal();
        }, 1000);
      }
    });
  }
  
  // Server Status
  initializeServerStatus();
});

// SERVER STATUS
function initializeServerStatus() {
  updateServerStatus();
  setInterval(updateServerStatus, 30000);
}

async function updateServerStatus() {
  try {
    const response = await fetch('https://api.mcstatus.io/v2/status/java/opsucht.net');
    const data = await response.json();
    
    if (data && data.online) {
      updateServerDisplay('online', data.players?.online || 0);
    } else {
      updateServerDisplay('offline', 0);
    }
  } catch (error) {
    updateServerDisplay('error', 0);
  }
}

function updateServerDisplay(status, playerCount) {
  const statusIcon = document.getElementById('serverStatusIcon');
  const statusText = document.getElementById('serverStatusText');
  const countText = document.getElementById('serverCountText');
  
  if (!statusIcon || !statusText || !countText) return;
  
  switch (status) {
    case 'online':
      statusIcon.textContent = '🟢';
      statusText.textContent = 'Online';
      countText.textContent = playerCount;
      break;
    case 'offline':
      statusIcon.textContent = '🔴';
      statusText.textContent = 'Offline';
      countText.textContent = '0';
      break;
    case 'error':
      statusIcon.textContent = '🟡';
      statusText.textContent = 'Fehler';
      countText.textContent = '?';
      break;
  }
}
