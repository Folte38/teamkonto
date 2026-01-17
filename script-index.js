// =========================
// SAUBERE VERSION - KEINE WORKAROUNDS MEHR
// =========================

// LOGIN CHECK & SEITEN-WECHSEL
async function checkLoginStatus() {
  const auth = await window.checkAuthentication();
  
  if (!auth.authenticated) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  } else {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    initializeApp();
    
    // Login-Benachrichtigung prüfen (einmalig pro Session)
    if (window.checkAndSendLoginNotification) {
      setTimeout(() => {
        window.checkAndSendLoginNotification();
      }, 1000);
    }
  }
}

// Auth-Check starten
checkLoginStatus();

// APP INITIALISIERUNG
function initializeApp() {
  loadProfile().then(() => {
    loadWeeks();
    loadPaymentsFromDB();
    loadPlayerPaymentStatus();
    loadArchive();
    loadTeamGoals();
    // Event Listener werden nach DOM-Laden eingerichtet
  });
}

// Event Listener nach DOM-Laden einrichten
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM geladen, warte auf App-Initialisierung...");
  
  // Warte kurz, bis die App initialisiert ist
  setTimeout(() => {
    console.log("Richte Event Listener ein...");
    console.log("IS_ADMIN Status:", IS_ADMIN);
    setupEventListeners();
  }, 1000);
});

// EVENT LISTENER SETUP
function setupEventListeners() {
  // Week Select Event Listener
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
    try {
      const playerBox = e.target.closest(".player.clickable");
      console.log("Spieler Click:", playerBox, "IS_ADMIN:", IS_ADMIN);
      
      if (playerBox && IS_ADMIN) {
        const playerId = playerBox.dataset.playerId;
        const playerName = playerBox.dataset.playerName;
        const isPaid = playerBox.classList.contains("paid");
        
        console.log("Spieler Daten:", { playerId, playerName, isPaid });
        
        if (isPaid) {
          console.log("Rufe markPlayerAsUnpaid auf...");
          markPlayerAsUnpaid(playerId, playerName);
        } else {
          console.log("Rufe markPlayerAsPaid auf...");
          markPlayerAsPaid(playerId, playerName);
        }
      }
    } catch (error) {
      console.error("Fehler im Spieler Click Handler:", error);
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

      try {
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
          console.error("Fehler beim Speichern:", error);
          archivePaymentMsg.innerText = "❌ Fehler: " + error.message;
        } else {
          archivePaymentMsg.innerText = "✅ Eintrag gespeichert";
          archivePaymentForm.reset();
          
          // Sofortige UI-Aktualisierung - neuen Eintrag direkt hinzufügen
          const archiveList = document.getElementById("archiveList");
          if (archiveList) {
            // Wenn "Keine Einträge" Nachricht da ist, entferne sie
            if (archiveList.firstChild && archiveList.firstChild.classList && archiveList.firstChild.classList.contains('no-entries')) {
              archiveList.innerHTML = '';
            }
            
            const newEntry = document.createElement('div');
            const sign = type === "ausgabe" ? "-" : "+";
            const cls = type === "ausgabe" ? "expense" : "income";
            const label = type === "beitrag" ? "Wochenbeitrag" : type === "spende" ? "Spende" : "Ausgabe";
            const escapedNote = note.replace(/'/g, "\\'");
            
            newEntry.className = `archive-entry ${cls}`;
            newEntry.setAttribute('data-payment-id', 'temp-' + Date.now());
            newEntry.innerHTML = `
              <div class="archive-content">
                <div class="amount">${sign} ${amount.toLocaleString()} $</div>
                <div class="description">${label}${note ? " · " + note : ""}</div>
                <div class="meta">${user.user_metadata?.mc_name || "—"} • ${new Date().toLocaleDateString('de-DE')}</div>
              </div>
              ${IS_ADMIN ? `<div class="archive-actions"><button class="archive-delete-btn" onclick="deleteArchiveEntry('temp-${Date.now()}', '${type}', ${amount}, '${escapedNote}')" title="Eintrag löschen">×</button></div>` : ''}
            `;
            newEntry.style.opacity = '0';
            archiveList.insertBefore(newEntry, archiveList.firstChild);
            setTimeout(() => {
              newEntry.style.opacity = '1';
              newEntry.style.transition = 'opacity 0.3s';
            }, 100);
          }
          
          // UI im Hintergrund aktualisieren (für Konsistenz)
          Promise.all([
            loadPaymentsFromDB(),
            loadPlayerPaymentStatus(),
            loadArchive()
          ]).then(() => {
            console.log("Hintergrund-Aktualisierung abgeschlossen");
          });
          
          // Modal nach kurzer Verzögerung schließen
          setTimeout(() => {
            hideArchiveModal();
            archivePaymentMsg.innerText = ""; // Nachricht zurücksetzen
          }, 1000);
        }
      } catch (error) {
        console.error("Unerwarteter Fehler:", error);
        archivePaymentMsg.innerText = "❌ Unerwarteter Fehler: " + error.message;
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
  const currentUser = await window.getCurrentUser();
  if (!currentUser) return Promise.resolve();

  // Für additional_password Methode müssen wir das Profil anders laden
  let profile;
  if (currentUser.method === 'additional_password') {
    profile = currentUser; // Profil ist bereits in getCurrentUser geladen
  } else {
    // Supabase Methode - altes Verhalten
    const { data: profileData, error } = await window.supabaseClient
      .from("profiles")
      .select("mc_name, role")
      .eq("id", currentUser.id)
      .single();

    if (error || !profileData) return Promise.resolve();
    profile = profileData;
  }

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
  }, 500);
  
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

  // Füge immer die aktuelle Woche hinzu
  const currentWeekOpt = document.createElement("option");
  currentWeekOpt.value = CURRENT_WEEK;
  currentWeekOpt.textContent = CURRENT_WEEK;
  currentWeekOpt.selected = true;
  select.appendChild(currentWeekOpt);

  // Füge andere Wochen hinzu (außer die aktuelle Woche)
  weeks.forEach(w => {
    if (w !== CURRENT_WEEK) {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      select.appendChild(opt);
    }
  });

  SELECTED_WEEK = CURRENT_WEEK; // Immer aktuelle Woche als Standard

  if (wrapper) {
    wrapper.style.display = "flex"; // Immer anzeigen
  }
}

// KASSE / ZAHLEN
async function loadPaymentsFromDB() {
  // Lade alle Zahlungen bis zur aktuellen Woche für Gesamtbilanz
  const { data: allPayments, error: allError } = await window.supabaseClient
    .from("payments")
    .select("type, amount, week")
    .lte("week", CURRENT_WEEK); // Alle Wochen bis einschließlich aktuelle Woche

  // Lade Zahlungen der ausgewählten Woche für Anzeige
  const { data: weekPayments, error: weekError } = await window.supabaseClient
    .from("payments")
    .select("type, amount")
    .eq("week", SELECTED_WEEK || CURRENT_WEEK);

  if (allError || weekError) return;

  // Berechne Gesamtbilanz über alle Wochen
  let totalBeitrag = 0, totalSpende = 0, totalAusgabe = 0;
  allPayments.forEach(p => {
    if (p.type === "beitrag") totalBeitrag += p.amount;
    if (p.type === "spende") totalSpende += p.amount;
    if (p.type === "ausgabe") totalAusgabe += p.amount;
  });

  // Berechne Werte der ausgewählten Woche
  let weekBeitrag = 0, weekSpende = 0, weekAusgabe = 0;
  weekPayments.forEach(p => {
    if (p.type === "beitrag") weekBeitrag += p.amount;
    if (p.type === "spende") weekSpende += p.amount;
    if (p.type === "ausgabe") weekAusgabe += p.amount;
  });

  const totalIncome = totalBeitrag + totalSpende;
  const weekIncome = weekBeitrag + weekSpende;
  const totalBalance = START_BALANCE + totalIncome - totalAusgabe;

  // Zeige Gesamtbilanz und Werte der ausgewählten Woche an
  document.getElementById("income").textContent = formatMoney(weekIncome);
  document.getElementById("expenses").textContent = formatMoney(weekAusgabe);
  document.getElementById("balance").textContent = formatMoney(totalBalance);
}

// SPIELERSTATUS
async function loadPlayerPaymentStatus() {
  const el = document.getElementById("players");
  if (!el) return;

  el.innerHTML = '<div class="loading">Lade Spieler...</div>';

  try {
    const { data: profiles, error: profilesError } = await window.supabaseClient
      .from("profiles")
      .select("id, mc_name, payment_status, role");
    
    if (profilesError || !profiles) {
      el.innerHTML = '<div class="error">Fehler beim Laden der Spieler</div>';
      return;
    }
    
    // Sortiere die Spieler: Admins zuerst, dann bezahlte Mitglieder, dann nicht bezahlte
    profiles.sort((a, b) => {
      // Priorität 1: Admins zuerst
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (b.role === "admin" && a.role !== "admin") return 1;
      
      // Priorität 2: Bezahlte vor nicht bezahlten (nur bei Mitgliedern)
      if (a.role !== "admin" && b.role !== "admin") {
        if (a.payment_status === 1 && b.payment_status === 0) return -1;
        if (b.payment_status === 1 && a.payment_status === 0) return 1;
      }
      
      // Priorität 3: Alphabetisch bei gleicher Priorität
      return a.mc_name.localeCompare(b.mc_name);
    });
    
    el.innerHTML = "";
    
    profiles.forEach(p => {
      const status = p.payment_status === 1 ? "paid" : "unpaid";
      const label = p.payment_status === 1 ? "Bezahlt" : "Nicht bezahlt";
      const isAdmin = p.role === "admin";
      const isMember = p.role === "member";
      
      // Bestimme das Icon und den Tooltip basierend auf der Rolle
      let roleIcon = '';
      let roleTooltip = '';
      
      if (isAdmin) {
        roleIcon = '⚙️';
        roleTooltip = 'Administrator';
      } else if (isMember) {
        roleIcon = '👤';
        roleTooltip = 'Mitglied';
      }
      
      el.innerHTML += `
        <div class="player ${status} ${IS_ADMIN ? 'clickable' : ''}" data-player-id="${p.id}" data-player-name="${p.mc_name}">
          <img src="https://mc-heads.net/avatar/${p.mc_name}/64" 
               alt="${p.mc_name}"
               onerror="this.src='https://mc-heads.net/avatar/Steve/64'">
          <div class="name">${p.mc_name}</div>
          <small>${label}</small>
          ${roleIcon ? `<div class="role-icon" title="${roleTooltip}">${roleIcon}</div>` : ''}
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
  showConfirmModal(
    "Spieler als bezahlt markieren",
    `Möchtest du ${playerName} für diese Woche wirklich als bezahlt markieren?\n\nEs wird ein 2.000.000 $ Wochenbeitrag-Eintrag erstellt.`,
    "Ja, als bezahlt markieren",
    "Abbrechen",
    async () => {
      try {
        // Sofortige UI-Aktualisierung - VOR der Datenbank-Operation
        showNotification(`${playerName} wird als bezahlt markiert...`, "info");
        
        // Sofortige UI-Aktualisierung - Spieler-Status ändern
        const allPlayers = document.querySelectorAll('.player');
        allPlayers.forEach(player => {
          if (player.dataset.playerName === playerName) {
            player.classList.add('paid');
            player.classList.remove('unpaid');
            const statusElement = player.querySelector('small');
            if (statusElement) {
              statusElement.textContent = 'Bezahlt';
            }
          }
        });
        
        // Sofortige UI-Aktualisierung - füge den neuen Eintrag zum Archiv hinzu
        const archiveList = document.getElementById("archiveList");
        if (archiveList) {
          // Wenn "Keine Einträge" Nachricht da ist, entferne sie
          if (archiveList.firstChild && archiveList.firstChild.classList && archiveList.firstChild.classList.contains('no-entries')) {
            archiveList.innerHTML = '';
          }
          
          const newEntry = document.createElement('div');
          newEntry.className = 'archive-entry income';
          newEntry.setAttribute('data-payment-id', 'temp-' + Date.now());
          newEntry.innerHTML = `
            <div class="archive-content">
              <div class="amount">+ 2.000.000 $</div>
              <div class="description">Wochenbeitrag · ${playerName}</div>
              <div class="meta">${playerName} • ${new Date().toLocaleDateString('de-DE')}</div>
            </div>
            ${IS_ADMIN ? `<div class="archive-actions"><button class="archive-delete-btn" onclick="deleteArchiveEntry('temp-${Date.now()}', 'beitrag', 2000000, '${playerName}')" title="Eintrag löschen">×</button></div>` : ''}
          `;
          newEntry.style.opacity = '0';
          archiveList.insertBefore(newEntry, archiveList.firstChild);
          setTimeout(() => {
            newEntry.style.opacity = '1';
            newEntry.style.transition = 'opacity 0.3s';
          }, 100);
        }
        
        // Sofortige UI-Aktualisierung - Statuszeile und Footer
        const paidCount = document.querySelectorAll('.player.paid').length;
        const totalCount = document.querySelectorAll('.player').length;
        
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
          footer.textContent = `♥️ by Folte38 & TobiWanNoobie · Dashboard · Stand diese Woche · ${totalCount} Spieler`;
        }
        
        // Jetzt die Datenbank-Operationen
        // Prüfen ob bereits ein Eintrag existiert
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
          showNotification(`${playerName} ist bereits als bezahlt markiert!`, "warning");
          // UI bei Fehler wiederherstellen
          loadPlayerPaymentStatus();
          loadArchive();
          return;
        }
        
        // Neuen Eintrag erstellen
        const { error: insertError } = await window.supabaseClient
          .from("payments")
          .insert([{
            user_id: (await window.supabaseClient.auth.getUser()).data.user.id,
            type: "beitrag",
            amount: 2000000,
            note: playerName,
            week: SELECTED_WEEK || CURRENT_WEEK
          }]);
          
        if (insertError) {
          showNotification("Fehler beim Erstellen des Eintrags: " + insertError.message, "error");
          // UI bei Fehler wiederherstellen
          loadPlayerPaymentStatus();
          loadArchive();
          return;
        }
        
        // Spielerstatus aktualisieren
        const { error: statusError } = await window.supabaseClient
          .rpc('mark_player_as_paid', { player_uuid: playerId });
          
        if (statusError) {
          // Fallback: Direktes Update
          const { error: fallbackError } = await window.supabaseClient
            .from("profiles")
            .update({ payment_status: 1 })
            .eq("id", playerId);
            
          if (fallbackError) {
            showNotification("Fehler beim Aktualisieren des Status: " + fallbackError.message, "error");
            // UI bei Fehler wiederherstellen
            loadPlayerPaymentStatus();
            return;
          }
        }
        
        showNotification(`${playerName} wurde erfolgreich als bezahlt markiert!`, "success");
        
        // UI im Hintergrund aktualisieren (für Konsistenz)
        Promise.all([
          loadPlayerPaymentStatus(),
          loadPaymentsFromDB(),
          loadArchive()
        ]).then(() => {
          console.log("Hintergrund-Aktualisierung abgeschlossen");
        });
        
      } catch (error) {
        showNotification("Fehler: " + error.message, "error");
      }
    }
  );
}

// ADMIN: SPIELER ALS NICHT BEZAHLT MARKIEREN
async function markPlayerAsUnpaid(playerId, playerName) {
  showConfirmModal(
    "Spieler als nicht bezahlt markieren",
    `Möchtest du ${playerName} für diese Woche wirklich als nicht bezahlt markieren?\n\nDer Status wird auf "Nicht bezahlt" gesetzt und der 2.000.000 $ Eintrag wird gelöscht.`,
    "Ja, als nicht bezahlt markieren",
    "Abbrechen",
    async () => {
      try {
        // Sofortige UI-Aktualisierung - VOR der Datenbank-Operation
        showNotification(`${playerName} wird als nicht bezahlt markiert...`, "info");
        
        // Sofortige UI-Aktualisierung - Spieler-Status ändern
        const allPlayers = document.querySelectorAll('.player');
        allPlayers.forEach(player => {
          if (player.dataset.playerName === playerName) {
            player.classList.add('unpaid');
            player.classList.remove('paid');
            const statusElement = player.querySelector('small');
            if (statusElement) {
              statusElement.textContent = 'Nicht bezahlt';
            }
          }
        });
        
        // Sofortige UI-Aktualisierung - entferne den Eintrag aus dem Archiv
        const archiveEntries = document.querySelectorAll('.archive-entry');
        archiveEntries.forEach(entry => {
          const description = entry.querySelector('.description');
          if (description && description.textContent.includes(`Wochenbeitrag · ${playerName}`)) {
            entry.style.opacity = '0.5';
            entry.style.transition = 'opacity 0.3s';
            setTimeout(() => {
              entry.remove();
              // Wenn das Archiv jetzt leer ist, zeige "Keine Einträge" Nachricht
              const archiveList = document.getElementById("archiveList");
              if (archiveList && archiveList.children.length === 0) {
                archiveList.innerHTML = '<div class="no-entries">Keine Einträge für diese Woche</div>';
              }
            }, 300);
          }
        });
        
        // Sofortige UI-Aktualisierung - Statuszeile und Footer
        const paidCount = document.querySelectorAll('.player.paid').length;
        const totalCount = document.querySelectorAll('.player').length;
        
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
          footer.textContent = `♥️ by Folte38 & TobiWanNoobie · Dashboard · Stand diese Woche · ${totalCount} Spieler`;
        }
        
        // Jetzt die Datenbank-Operationen
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
              showNotification("Fehler beim Löschen des Eintrags: " + fallbackError.message, "error");
              // UI bei Fehler wiederherstellen
              loadPlayerPaymentStatus();
              loadArchive();
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
            showNotification("Fehler beim Aktualisieren des Status: " + fallbackError.message, "error");
            // UI bei Fehler wiederherstellen
            loadPlayerPaymentStatus();
            return;
          }
        }
        
        showNotification(`${playerName} wurde erfolgreich als nicht bezahlt markiert!`, "success");
        
        // UI im Hintergrund aktualisieren (für Konsistenz)
        Promise.all([
          loadPlayerPaymentStatus(),
          loadPaymentsFromDB(),
          loadArchive()
        ]).then(() => {
          console.log("Hintergrund-Aktualisierung abgeschlossen");
        });
        
      } catch (error) {
        showNotification("Fehler: " + error.message, "error");
      }
    }
  );
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
  console.log("deleteArchiveEntry aufgerufen mit:", { paymentId, type, amount, note });
  
  const typeLabel = type === "beitrag" ? "Wochenbeitrag" : type === "spende" ? "Spende" : "Ausgabe";
  const noteText = note ? ` (${note})` : "";
  
  showConfirmModal(
    "Eintrag entfernen",
    `Möchtest du diesen Eintrag wirklich entfernen?\n\n${typeLabel}${noteText}: ${amount.toLocaleString()} $`,
    "Ja, entfernen",
    "Abbrechen",
    async () => {
      try {
        console.log("Lösche Eintrag:", { paymentId, type, amount, note });
        
        // Sofortige UI-Aktualisierung - VOR der Datenbank-Operation
        showNotification("Eintrag wird entfernt...", "info");
        
        // Sofortige UI-Aktualisierung - entferne den Eintrag direkt aus dem DOM
        const deletedEntry = document.querySelector(`[data-payment-id="${paymentId}"]`);
        console.log("Zu löschender Eintrag:", deletedEntry);
        
        if (deletedEntry) {
          deletedEntry.style.opacity = '0.5';
          deletedEntry.style.transition = 'opacity 0.3s';
          setTimeout(() => {
            deletedEntry.remove();
            // Wenn das Archiv jetzt leer ist, zeige "Keine Einträge" Nachricht
            const archiveList = document.getElementById("archiveList");
            if (archiveList && archiveList.children.length === 0) {
              archiveList.innerHTML = '<div class="no-entries">Keine Einträge für diese Woche</div>';
            }
          }, 300);
        } else {
          console.warn("Eintrag nicht gefunden für paymentId:", paymentId);
        }
        
        // Wenn es ein Wochenbeitrag war, Spielerstatus sofort aktualisieren
        if (type === "beitrag" && note) {
          console.log("Aktualisiere Spielerstatus für:", note);
          const allPlayers = document.querySelectorAll('.player');
          allPlayers.forEach(player => {
            if (player.dataset.playerName === note) {
              player.classList.add('unpaid');
              player.classList.remove('paid');
              const statusElement = player.querySelector('small');
              if (statusElement) {
                statusElement.textContent = 'Nicht bezahlt';
              }
            }
          });
          
          // Sofortige UI-Aktualisierung - Statuszeile und Footer
          const paidCount = document.querySelectorAll('.player.paid').length;
          const totalCount = document.querySelectorAll('.player').length;
          
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
            footer.textContent = `♥️ by Folte38 & TobiWanNoobie · Dashboard · Stand diese Woche · ${totalCount} Spieler`;
          }
        }
        
        // Jetzt die Datenbank-Operation
        const { error } = await window.supabaseClient
          .rpc('delete_payment_admin', { payment_id: paymentId });
        
        if (error) {
          console.warn("RPC-Löschen fehlgeschlagen, versuche Direkt-Delete:", error);
          // Fallback: Direktes Delete
          const { error: fallbackError } = await window.supabaseClient
            .from("payments")
            .delete()
            .eq("id", paymentId);
          
          if (fallbackError) {
            console.error("Direkt-Delete fehlgeschlagen:", fallbackError);
            showNotification("Fehler beim Löschen: " + fallbackError.message, "error");
            // UI bei Fehler wiederherstellen
            loadArchive();
            return;
          }
        }
        
        console.log("Eintrag erfolgreich gelöscht");
        showNotification("Eintrag wurde erfolgreich entfernt!", "success");
        
        // UI im Hintergrund aktualisieren (für Konsistenz)
        Promise.all([
          loadPaymentsFromDB(),
          loadArchive(),
          loadPlayerPaymentStatus()
        ]).then(() => {
          console.log("Hintergrund-Aktualisierung abgeschlossen");
        });
        
      } catch (error) {
        console.error("Unerwarteter Fehler beim Löschen:", error);
        showNotification("Fehler: " + error.message, "error");
      }
    }
  );
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

// =========================
// MODAL FUNKTIONEN FÜR BESTÄTIGUNGEN
// =========================
function showConfirmModal(title, message, confirmText, cancelText, onConfirm) {
  // Modal und Overlay erstellen, falls nicht vorhanden
  let modal = document.getElementById('confirmModal');
  let overlay = document.getElementById('confirmOverlay');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'confirm-modal';
    modal.innerHTML = `
      <div class="confirm-modal-content">
        <h3 class="confirm-modal-title"></h3>
        <div class="confirm-modal-message"></div>
        <div class="confirm-modal-actions">
          <button class="confirm-btn cancel-btn"></button>
          <button class="confirm-btn confirm-btn-primary"></button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirmOverlay';
    overlay.className = 'confirm-overlay';
    document.body.appendChild(overlay);
  }
  
  // Modal-Inhalt setzen
  modal.querySelector('.confirm-modal-title').textContent = title;
  modal.querySelector('.confirm-modal-message').textContent = message;
  modal.querySelector('.cancel-btn').textContent = cancelText || 'Abbrechen';
  modal.querySelector('.confirm-btn-primary').textContent = confirmText || 'Bestätigen';
  
  // Event-Handler für Bestätigung
  const confirmBtn = modal.querySelector('.confirm-btn-primary');
  const cancelBtn = modal.querySelector('.cancel-btn');
  
  const closeModal = () => {
    modal.style.display = 'none';
    overlay.style.display = 'none';
  };
  
  const confirmHandler = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };
  
  const cancelHandler = () => {
    closeModal();
  };
  
  // Alte Event-Listener entfernen
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  
  // Neue Event-Listener setzen
  modal.querySelector('.confirm-btn-primary').addEventListener('click', confirmHandler);
  modal.querySelector('.cancel-btn').addEventListener('click', cancelHandler);
  overlay.addEventListener('click', cancelHandler);
  
  // ESC-Taste zum Schließen
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      cancelHandler();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // Modal anzeigen
  modal.style.display = 'block';
  overlay.style.display = 'block';
}

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
