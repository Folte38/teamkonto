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
// TEAMZIELE (STATISCH)
// =========================
const TEAM_GOALS = [
  { name: "Bohrer V2", cost: 550000000, current: 200000000 },
  { name: "Phils Bauhacke", cost: 205000000, current: 205000000 }
];

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

  // Ausgabe nur für Admins
  setTimeout(() => {
    const typeSelect = document.getElementById("paymentType");
    if (!typeSelect) return;

    if (!IS_ADMIN) {
      [...typeSelect.options].forEach(opt => {
        if (opt.value === "ausgabe") opt.remove();
      });
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
    document.getElementById("statusLine").innerText =
      `${SELECTED_WEEK} · ${paidCount} / ${profiles.length} Spieler bezahlt`;
    
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
// TEAMZIELE
// =========================
function loadTeamGoals() {
  const goalsEl = document.getElementById("goalsList");
  if (!goalsEl) return;

  goalsEl.innerHTML = "";

  const openGoals = TEAM_GOALS.filter(g => g.current < g.cost);
  const doneGoals = TEAM_GOALS.filter(g => g.current >= g.cost);
  const sortedGoals = [...openGoals, ...doneGoals].slice(0, 10);

  sortedGoals.forEach(goal => {
    const done = goal.current >= goal.cost;
    const percent = Math.min((goal.current / goal.cost) * 100, 100);

    goalsEl.innerHTML += `
      <div class="goal ${done ? "done" : ""}">
        <div class="goal-header">
          <strong>${goal.name}</strong>
          ${done ? `<span class="goal-done">ERLEDIGT</span>` : ""}
        </div>

        <small>Ziel: ${goal.cost.toLocaleString()} $</small><br>
        <small>Aktuell: ${goal.current.toLocaleString()} $</small>

        <div class="progress">
          <div style="width:${percent}%"></div>
        </div>
      </div>
    `;
  });
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
// FORMULAR (NUR NOTE-FIX)
// =========================
const paymentForm = document.getElementById("paymentForm");
const paymentMsg = document.getElementById("paymentMsg");

if (paymentForm) {
  paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = document.getElementById("paymentType").value;
    const amount = parseInt(document.getElementById("paymentAmount").value);

    const note =
      type === "beitrag"
        ? null
        : document.getElementById("paymentNote").value;

    if (!amount || amount <= 0) {
      paymentMsg.innerText = "Bitte gültigen Betrag eingeben";
      return;
    }

    const { data: { user } } = await window.supabaseClient.auth.getUser();

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
      paymentMsg.innerText = error.message;
    } else {
      paymentMsg.innerText = "✅ Eintrag gespeichert";
      paymentForm.reset();
      loadPaymentsFromDB();
      loadPlayerPaymentStatus();
      loadArchive();
    }
  });
}

// =========================
// KOMMENTAR SICHTBARKEIT
// =========================
const paymentTypeSelect = document.getElementById("paymentType");
const paymentNoteInput = document.getElementById("paymentNote");

if (paymentTypeSelect && paymentNoteInput) {
  function updateNoteVisibility() {
    const type = paymentTypeSelect.value;

    if (type === "spende" || type === "ausgabe") {
      paymentNoteInput.style.display = "block";
    } else {
      paymentNoteInput.style.display = "none";
      paymentNoteInput.value = "";
    }
  }

  paymentTypeSelect.addEventListener("change", updateNoteVisibility);
  updateNoteVisibility();
}

// =========================
// INIT - ORIGINAL VERSION
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  await loadWeeks();
  loadPaymentsFromDB();
  loadPlayerPaymentStatus();
  loadTeamGoals();
  loadArchive();
});