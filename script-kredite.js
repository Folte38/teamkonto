// =========================
// GLOBALE VARIABLEN
// =========================
let CURRENT_USER_ID = null;
let CURRENT_MC_NAME = null;
let SELECTED_CREDIT_ID = null;

// =========================
// PROFIL & NAV
// =========================
async function loadProfile() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return;

  CURRENT_USER_ID = user.id;

  const { data: profile } = await window.supabaseClient
    .from("profiles")
    .select("mc_name")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  CURRENT_MC_NAME = profile.mc_name;

  // Navigation anzeigen
  const navUser = document.getElementById("navUser");
  if (navUser) {
    document.getElementById("navUsername").innerText = profile.mc_name;
    document.getElementById("navAvatar").src =
      `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
  }

  // Formular vorausfüllen
  document.getElementById("creditUser").value = profile.mc_name;
}

// =========================
// KREDITANTRÄGE LADEN
// =========================
async function loadCredits() {
  const list = document.getElementById("creditList");
  if (!list) return;

  const { data: requests } = await window.supabaseClient
    .from("credit_requests")
    .select(`
      id,
      purpose,
      total_price,
      credit_amount,
      repayment,
      reason,
      status,
      user_id,
      profiles ( mc_name ),
      credit_votes ( vote )
    `)
    .order("created_at", { ascending: false });

  if (!requests) return;

  // Statistiken berechnen
  await calculateStats(requests);

  list.innerHTML = "";

  // Offene Anträge zuerst anzeigen
  const openRequests = requests.filter(r => r.status === "open");
  const otherRequests = requests.filter(r => r.status !== "open");
  const allRequests = [...openRequests, ...otherRequests];

allRequests.forEach(r => {
  const yes = r.credit_votes.filter(v => v.vote === "yes").length;
  const no = r.credit_votes.filter(v => v.vote === "no").length;
  const total = yes + no || 1;
  const yesPercent = Math.round((yes / total) * 100);

  // Status auf Deutsch übersetzen
  let statusText = "";
  let statusClass = "";
  switch(r.status) {
    case "open": statusText = "Offen"; statusClass = "open"; break;
    case "accepted": statusText = "Angenommen"; statusClass = "accepted"; break;
    case "rejected": statusText = "Abgelehnt"; statusClass = "rejected"; break;
    default: statusText = r.status; statusClass = r.status;
  }

  // Klick-Event für Kredit-Box
  const onclick = r.status === "open" ? `selectCredit('${r.id}')` : "";

  // HTML für Admin-Buttons (nur wenn Admin und Status = "open")
  let adminButtons = "";
  if (IS_ADMIN && r.status === "open") {
    adminButtons = `
      <div class="admin-actions">
        <button class="admin-btn accept-btn" onclick="acceptCredit('${r.id}')" title="Antrag annehmen">
          ✅ Annehmen
        </button>
        <button class="admin-btn reject-btn" onclick="rejectCredit('${r.id}')" title="Antrag ablehnen">
          ❌ Ablehnen
        </button>
      </div>
    `;
  } else if (IS_ADMIN && r.status !== "open") {
    // Option: Button zum Zurücksetzen auf "open" für Admins
    adminButtons = `
      <div class="admin-actions">
        <button class="admin-btn reopen-btn" onclick="reopenCredit('${r.id}')" title="Zur Abstimmung freigeben">
          🔄 Zurück zu Abstimmung
        </button>
      </div>
    `;
  }

  list.innerHTML += `
    <div class="credit-box ${r.status}" onclick="${onclick}" style="${r.status === 'open' ? 'cursor: pointer;' : ''}">
      <h3>📄 ${r.purpose}</h3>
      <div class="credit-status-badge">${statusText}</div>

      ${adminButtons}

      <div class="credit-meta">
        <div><strong>👤 Antragsteller:</strong> ${r.profiles.mc_name}</div>
        <div><strong>💰 Gesamtpreis:</strong> ${r.total_price.toLocaleString()} $</div>
        <div><strong>💳 Kreditbetrag:</strong> ${r.credit_amount.toLocaleString()} $</div>
        <div><strong>📆 Rückzahlung:</strong> ${r.repayment}</div>
        <div><strong>🗳️ Abstimmung:</strong> ${yes} 👍 | ${no} 👎 (${yesPercent}%)</div>
      </div>

      ${r.reason ? `<p class="credit-reason"><strong>📝 Begründung:</strong> ${r.reason}</p>` : ""}
    </div>
  `;
});
}

// =========================
// KREDIT AUSWÄHLEN FÜR ABSTIMMUNG
// =========================
async function selectCredit(creditId) {
  SELECTED_CREDIT_ID = creditId;
  
  const { data: credit } = await window.supabaseClient
    .from("credit_requests")
    .select(`
      id,
      purpose,
      credit_amount,
      profiles ( mc_name ),
      credit_votes ( vote )
    `)
    .eq("id", creditId)
    .single();

  if (!credit) return;

  // Aktuelle Stimmen zählen
  const yes = credit.credit_votes.filter(v => v.vote === "yes").length;
  const no = credit.credit_votes.filter(v => v.vote === "no").length;
  const total = yes + no || 1;
  const yesPercent = Math.round((yes / total) * 100);
  const noPercent = 100 - yesPercent;

  // Abstimmungs-Container anzeigen
  const votingContainer = document.getElementById("votingContainer");
  votingContainer.style.display = "block";

  // Daten einfügen
  document.getElementById("selectedCreditPurpose").textContent = credit.purpose;
  document.getElementById("selectedCreditAmount").textContent = credit.credit_amount.toLocaleString();
  document.getElementById("selectedCreditUser").textContent = credit.profiles.mc_name;

  // Progressbar aktualisieren
  document.querySelector(".vote-yes-bar").style.width = `${yesPercent}%`;
  document.querySelector(".vote-no-bar").style.width = `${noPercent}%`;
  document.querySelector(".vote-text").textContent = `${yes} 👍 | ${no} 👎 (${yesPercent}%)`;

  // Buttons aktivieren
  document.getElementById("voteYesBtn").disabled = false;
  document.getElementById("voteNoBtn").disabled = false;

  // In selectCredit() nach dem Einfügen der Voting-Buttons:
if (IS_ADMIN && credit.status === "open") {
  const votingContainer = document.querySelector('.selected-credit-info');
  const adminButtons = document.createElement('div');
  adminButtons.className = 'admin-actions';
  adminButtons.innerHTML = `
    <button class="admin-btn accept-btn" onclick="acceptCredit('${creditId}')">
      ✅ Als Admin annehmen
    </button>
    <button class="admin-btn reject-btn" onclick="rejectCredit('${creditId}')">
      ❌ Als Admin ablehnen
    </button>
  `;
  votingContainer.appendChild(adminButtons);
}

  // Prüfen, ob Benutzer bereits abgestimmt hat
  const hasVoted = credit.credit_votes.some(v => v.user_id === CURRENT_USER_ID);
  if (hasVoted) {
    document.getElementById("voteYesBtn").disabled = true;
    document.getElementById("voteNoBtn").disabled = true;
  }

  // Event Listener für Buttons setzen
  document.getElementById("voteYesBtn").onclick = () => vote(creditId, 'yes');
  document.getElementById("voteNoBtn").onclick = () => vote(creditId, 'no');
}

// =========================
// ABSTIMMEN
// =========================
async function vote(creditId, voteType) {
  // Prüfen, ob Benutzer bereits abgestimmt hat
  const { data: existingVote } = await window.supabaseClient
    .from("credit_votes")
    .select("id")
    .eq("request_id", creditId)
    .eq("user_id", CURRENT_USER_ID)
    .single();

  if (existingVote) {
    alert("Du hast bereits abgestimmt!");
    return;
  }

  // Stimme speichern
  await window.supabaseClient
    .from("credit_votes")
    .insert([{
      request_id: creditId,
      user_id: CURRENT_USER_ID,
      vote: voteType
    }]);

  // ❌ KEINE automatische Auswertung mehr!
  // await evaluateVote(creditId); <-- ENTFERNEN/AUSKOMMENTIEREN
  
  // UI aktualisieren
  loadCredits();
  if (SELECTED_CREDIT_ID === creditId) {
    selectCredit(creditId);
  }
}

// =========================
// STATISTIKEN BERECHNEN
// =========================
async function calculateStats(requests) {
  const openCount = requests.filter(r => r.status === "open").length;
  const acceptedCount = requests.filter(r => r.status === "accepted").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;
  
  const totalRequested = requests.reduce((sum, r) => sum + r.credit_amount, 0);
  const avgCredit = requests.length > 0 ? Math.round(totalRequested / requests.length) : 0;

  // Update Statistiken
  document.getElementById("openCount").textContent = openCount;
  document.getElementById("acceptedCount").textContent = acceptedCount;
  document.getElementById("rejectedCount").textContent = rejectedCount;
  document.getElementById("totalRequested").textContent = totalRequested.toLocaleString() + " $";

  // Meine Anträge anzeigen
  const myRequests = requests.filter(r => r.user_id === CURRENT_USER_ID);
  const myList = document.getElementById("myCreditsList");
  
  if (myList) {
    myList.innerHTML = "";
    
    if (myRequests.length === 0) {
      myList.innerHTML = `<div class="no-requests">Noch keine eigenen Anträge</div>`;
    } else {
      myRequests.slice(0, 5).forEach(r => {
        // Status auf Deutsch übersetzen
        let statusText = "";
        let statusIcon = "";
        let statusClass = "";
        
        switch(r.status) {
          case "open": 
            statusText = "Offen"; 
            statusIcon = "🕓";
            statusClass = "open";
            break;
          case "accepted": 
            statusText = "Angenommen"; 
            statusIcon = "✅";
            statusClass = "accepted";
            break;
          case "rejected": 
            statusText = "Abgelehnt"; 
            statusIcon = "❌";
            statusClass = "rejected";
            break;
        }
        
        myList.innerHTML += `
          <div class="my-request ${statusClass}">
            <div class="my-request-title">${r.purpose}</div>
            <div class="my-request-amount">${r.credit_amount.toLocaleString()} $</div>
            <div class="my-request-status">${statusIcon} ${statusText}</div>
          </div>
        `;
      });
    }
  }
}

// =========================
// FORMULAR FÜR NEUEN ANTRAG
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const creditForm = document.getElementById("creditForm");
  if (creditForm) {
    creditForm.addEventListener("submit", async e => {
      e.preventDefault();

      const purpose = document.getElementById("creditPurpose").value;
      const total = parseInt(document.getElementById("creditTotal").value);
      const amount = parseInt(document.getElementById("creditAmount").value);
      const repayment = document.getElementById("creditRepayment").value;
      const reason = document.getElementById("creditReason").value;

      if (!purpose || !total || !amount || !repayment) {
        alert("Bitte fülle alle Pflichtfelder aus!");
        return;
      }

      if (amount > total) {
        alert("Kreditbetrag darf nicht höher als Gesamtpreis sein!");
        return;
      }

      await window.supabaseClient.from("credit_requests").insert([{
        user_id: CURRENT_USER_ID,
        purpose: purpose,
        total_price: total,
        credit_amount: amount,
        repayment: repayment,
        reason: reason,
        status: "open"
      }]);

      creditForm.reset();
      document.getElementById("creditUser").value = CURRENT_MC_NAME;
      
      // Nach 1 Sekunde neu laden
      setTimeout(() => {
        loadCredits();
      }, 1000);
    });
  }
});

// =========================
// INITIALISIERUNG
// =========================
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  await loadCredits();
});

// =========================
// ADMIN-FUNKTIONEN
// =========================

let IS_ADMIN = false; // Globale Variable für Admin-Status

// In loadProfile() Admin-Status prüfen
async function loadProfile() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) return;

  CURRENT_USER_ID = user.id;

  const { data: profile } = await window.supabaseClient
    .from("profiles")
    .select("mc_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  CURRENT_MC_NAME = profile.mc_name;
  IS_ADMIN = profile.role === "admin"; // Admin-Status setzen

  // Navigation anzeigen
  const navUser = document.getElementById("navUser");
  if (navUser) {
    document.getElementById("navUsername").innerText = profile.mc_name;
    document.getElementById("navAvatar").src =
      `https://mc-heads.net/avatar/${profile.mc_name}/64`;
    navUser.style.display = "flex";
  }

  // Formular vorausfüllen
  document.getElementById("creditUser").value = profile.mc_name;
}

// Admin: Kredit annehmen
async function acceptCredit(creditId) {
  if (!IS_ADMIN) {
    alert("Nur Admins können Anträge annehmen!");
    return;
  }
  
  if (!confirm("Möchtest du diesen Kreditantrag wirklich annehmen?")) {
    return;
  }
  
  await window.supabaseClient
    .from("credit_requests")
    .update({ status: "accepted" })
    .eq("id", creditId);
  
  // Erfolgsmeldung
  alert("✅ Kreditantrag wurde angenommen!");
  
  // UI aktualisieren
  loadCredits();
  if (SELECTED_CREDIT_ID === creditId) {
    selectCredit(creditId);
  }
}

// Admin: Kredit ablehnen
async function rejectCredit(creditId) {
  if (!IS_ADMIN) {
    alert("Nur Admins können Anträge ablehnen!");
    return;
  }
  
  if (!confirm("Möchtest du diesen Kreditantrag wirklich ablehnen?")) {
    return;
  }
  
  await window.supabaseClient
    .from("credit_requests")
    .update({ status: "rejected" })
    .eq("id", creditId);
  
  // Erfolgsmeldung
  alert("❌ Kreditantrag wurde abgelehnt!");
  
  // UI aktualisieren
  loadCredits();
  if (SELECTED_CREDIT_ID === creditId) {
    selectCredit(creditId);
  }
}

// Admin: Kredit für Abstimmung öffnen (Status reset)
async function reopenCredit(creditId) {
  if (!IS_ADMIN) {
    alert("Nur Admins können Anträge zur Abstimmung freigeben!");
    return;
  }
  
  if (!confirm("Möchtest du diesen Antrag zur Abstimmung freigeben?\nBisherige Stimmen bleiben erhalten.")) {
    return;
  }
  
  await window.supabaseClient
    .from("credit_requests")
    .update({ status: "open" })
    .eq("id", creditId);
  
  // UI aktualisieren
  loadCredits();
}