// =========================
// GLOBALE VARIABLEN
// =========================
let CURRENT_USER_ID = null;
let CURRENT_MC_NAME = null;
let SELECTED_CREDIT_ID = null;
let TOTAL_MEMBERS = 0; // Gesamtanzahl der Mitglieder
let IS_ADMIN = false; // Wird in loadProfile() gesetzt

// =========================
// MITGLIEDERANZAHL LADEN
// =========================
async function loadTotalMembers() {
  const { data: profiles } = await window.supabaseClient
    .from("profiles")
    .select("id");
  
  TOTAL_MEMBERS = profiles ? profiles.length : 0;
  console.log(`Gesamtmitglieder: ${TOTAL_MEMBERS}`);
}

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

  try {
    // Einfache Abfrage ohne komplexe JOINs
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
        created_at
      `)
      .order("created_at", { ascending: false });

    if (!requests) {
      console.log("Keine Kreditanträge gefunden");
      list.innerHTML = '<div class="no-requests">Keine Kreditanträge gefunden</div>';
      await calculateStats([]);
      return;
    }

    // Profile separat laden für Namen
    const { data: profiles } = await window.supabaseClient
      .from("profiles")
      .select("id, mc_name");

    // Votes separat laden
    const { data: votes } = await window.supabaseClient
      .from("credit_votes")
      .select("request_id, user_id, vote");

    // Daten zusammenfügen
    const requestsWithDetails = requests.map(request => {
      const profile = profiles.find(p => p.id === request.user_id);
      const requestVotes = votes.filter(v => v.request_id === request.id);
      
      return {
        ...request,
        mc_name: profile?.mc_name || "Unbekannt",
        credit_votes: requestVotes
      };
    });

    // Automatische Auswertung für alle offenen Anträge prüfen
    for (const request of requestsWithDetails) {
      if (request.status === "open") {
        const yes = request.credit_votes.filter(v => v.vote === "yes").length;
        const no = request.credit_votes.filter(v => v.vote === "no").length;
        const totalVotes = yes + no;
        
        // Wenn alle abgestimmt haben, automatisch nach Mehrheit entscheiden
        if (totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0) {
          const newStatus = yes > no ? "accepted" : yes < no ? "rejected" : "rejected";
          await window.supabaseClient
            .from("credit_requests")
            .update({ status: newStatus })
            .eq("id", request.id);
          
          // Status im lokalen Array aktualisieren
          request.status = newStatus;
        }
      }
    }

    // Statistiken berechnen
    await calculateStats(requestsWithDetails);

    list.innerHTML = "";

    // Offene Anträge zuerst anzeigen
    const openRequests = requestsWithDetails.filter(r => r.status === "open");
    const otherRequests = requestsWithDetails.filter(r => r.status !== "open");
    const allRequests = [...openRequests, ...otherRequests];

allRequests.forEach(r => {
  const yes = r.credit_votes.filter(v => v.vote === "yes").length;
  const no = r.credit_votes.filter(v => v.vote === "no").length;
  const totalVotes = yes + no;
  const remainingVotes = TOTAL_MEMBERS - totalVotes;
  
  // Status auf Deutsch übersetzen - einheitliche Schreibweise
  let statusText = "";
  let statusClass = "";
  switch(r.status) {
    case "open": statusText = "OFFEN"; statusClass = "open"; break;
    case "accepted": statusText = "ANGENOMMEN"; statusClass = "accepted"; break;
    case "rejected": statusText = "ABGELEHNT"; statusClass = "rejected"; break;
    default: statusText = r.status.toUpperCase(); statusClass = r.status;
  }

  // Klick-Event für Kredit-Box
  const onclick = r.status === "open" ? `selectCredit('${r.id}')` : "";

  // Voting-Status anzeigen (nur für offene Anträge)
  let votingStatus = "";
  if (r.status === "open") {
    if (totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0) {
      // Alle haben abgestimmt - zeige Ergebnis
      const majority = yes > no ? "👍 Mehrheit dafür" : yes < no ? "👎 Mehrheit dagegen" : "⚖️ Unentschieden";
      votingStatus = `<div class="voting-complete">✅ ${yes} 👍 | ${no} 👎 - ${majority}</div>`;
    } else {
      votingStatus = `<div class="voting-progress">🗳️ ${totalVotes}/${TOTAL_MEMBERS} abgestimmt (${yes} 👍 | ${no} 👎)</div>`;
    }
  }

  list.innerHTML += `
    <div class="credit-box ${r.status}" onclick="${onclick}" style="${r.status === 'open' ? 'cursor: pointer;' : ''}">
      <div class="credit-box-header">
        <h3>📄 ${r.purpose}</h3>
        <div class="credit-status-badge">${statusText}</div>
      </div>

      <div class="credit-meta">
        <div><strong>👤 Antragsteller:</strong> ${r.mc_name}</div>
        <div><strong>💰 Gesamtpreis:</strong> ${r.total_price.toLocaleString()} $</div>
// =========================
async function selectCredit(creditId) {
  SELECTED_CREDIT_ID = creditId;
  
  try {
    // Einfache Abfrage ohne komplexe JOINs
    const { data: credit } = await window.supabaseClient
      .from("credit_requests")
      .select(`
        id,
        purpose,
        credit_amount,
        total_price,
        repayment,
        reason,
        status,
        user_id,
        created_at
      `)
      .eq("id", creditId)
      .single();

    if (!credit) return;

    // Nur offene Anträge können ausgewählt werden
    if (credit.status !== "open") {
      return;
    }

    // Profile und Votes separat laden
    const { data: profiles } = await window.supabaseClient
      .from("profiles")
      .select("id, mc_name");

    const { data: votes } = await window.supabaseClient
      .from("credit_votes")
      .select("request_id, user_id, vote")
      .eq("request_id", creditId);

    // Daten zusammenfügen
    const profile = profiles.find(p => p.id === credit.user_id);
    const creditVotes = votes || [];

    // Aktuelle Stimmen zählen
    const yes = creditVotes.filter(v => v.vote === "yes").length;
    const no = creditVotes.filter(v => v.vote === "no").length;
    const totalVotes = yes + no;
    
    // Prozent basierend auf Gesamtmitglieder
    const yesPercent = TOTAL_MEMBERS > 0 ? Math.round((yes / TOTAL_MEMBERS) * 100) : 0;
    const noPercent = TOTAL_MEMBERS > 0 ? Math.round((no / TOTAL_MEMBERS) * 100) : 0;

    // Modal anzeigen
    const votingModal = document.getElementById("votingModal");
    votingModal.style.display = "flex";

    // Daten einfügen
    document.getElementById("selectedCreditPurpose").textContent = credit.purpose;
    document.getElementById("selectedCreditAmount").textContent = credit.credit_amount.toLocaleString();
    document.getElementById("selectedCreditTotal").textContent = credit.total_price.toLocaleString();
    document.getElementById("selectedCreditRepayment").textContent = credit.repayment;
    document.getElementById("selectedCreditUser").textContent = profile?.mc_name || "Unbekannt";
    
    // Begründung anzeigen falls vorhanden
    const reasonEl = document.getElementById("selectedCreditReason");
    if (credit.reason) {
      reasonEl.textContent = credit.reason;
      reasonEl.style.display = "block";
    } else {
      reasonEl.style.display = "none";
    }

    // Einfache Stimmenanzeige statt Progressbar
    const remainingVotes = TOTAL_MEMBERS - totalVotes;
    const voteStatusText = totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0 
      ? `${yes} 👍 | ${no} 👎 - Alle ${TOTAL_MEMBERS} haben abgestimmt`
      : `${yes} 👍 | ${no} 👎 (${totalVotes}/${TOTAL_MEMBERS} abgestimmt, ${remainingVotes} fehlen)`;
    
    document.getElementById("voteText").textContent = voteStatusText;

    // Automatische Auswertung wenn alle abgestimmt haben
    if (totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0) {
      // Automatisch nach Mehrheit entscheiden
      const newStatus = yes > no ? "accepted" : yes < no ? "rejected" : "rejected";
      await window.supabaseClient
        .from("credit_requests")
        .update({ status: newStatus })
        .eq("id", creditId);
      
      // Modal schließen und neu laden
      hideVotingModal();
      await loadCredits();
      return;
    }

    // Prüfen, ob Benutzer bereits abgestimmt hat
    const hasVoted = creditVotes.some(v => v.user_id === CURRENT_USER_ID);
    if (hasVoted) {
      document.getElementById("voteYesBtn").disabled = true;
      document.getElementById("voteNoBtn").disabled = true;
      document.getElementById("voteYesBtn").textContent = "👍 Bereits abgestimmt";
      document.getElementById("voteNoBtn").textContent = "👎 Bereits abgestimmt";
    } else {
      document.getElementById("voteYesBtn").disabled = false;
      document.getElementById("voteNoBtn").disabled = false;
      document.getElementById("voteYesBtn").textContent = "👍 Ja, dafür";
      document.getElementById("voteNoBtn").textContent = "👎 Nein, dagegen";
    }

    // Event Listener für Buttons setzen
    document.getElementById("voteYesBtn").onclick = () => vote(creditId, 'yes');
    document.getElementById("voteNoBtn").onclick = () => vote(creditId, 'no');
  } catch (error) {
    console.error("Fehler in selectCredit:", error);
    alert("Fehler beim Laden des Kreditantrags: " + error.message);
  }
}

// Modal-Funktionen
function hideVotingModal() {
  const votingModal = document.getElementById("votingModal");
  if (votingModal) {
    votingModal.style.display = "none";
  }
  SELECTED_CREDIT_ID = null;
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

  // Prüfen ob alle abgestimmt haben und automatisch auswerten
  const { data: updatedCredit } = await window.supabaseClient
    .from("credit_requests")
    .select(`
      id,
      status,
      credit_votes ( vote )
    `)
    .eq("id", creditId)
    .single();
  
  if (updatedCredit && updatedCredit.status === "open") {
    const yes = updatedCredit.credit_votes.filter(v => v.vote === "yes").length;
    const no = updatedCredit.credit_votes.filter(v => v.vote === "no").length;
    const totalVotes = yes + no;
    
    // Wenn alle abgestimmt haben, automatisch nach Mehrheit entscheiden
    if (totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0) {
      const newStatus = yes > no ? "accepted" : yes < no ? "rejected" : "rejected";
      await window.supabaseClient
        .from("credit_requests")
        .update({ status: newStatus })
        .eq("id", creditId);
    }
  }
  
  // UI aktualisieren
  await loadCredits();
  
  // Wenn Modal noch offen ist, aktualisiere es
  if (SELECTED_CREDIT_ID === creditId) {
    const votingModal = document.getElementById("votingModal");
    if (votingModal.style.display === "flex") {
      await selectCredit(creditId);
    }
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
        // Status auf Deutsch übersetzen - einheitliche Schreibweise
        let statusText = "";
        let statusIcon = "";
        let statusClass = "";
        
        switch(r.status) {
          case "open": 
            statusText = "OFFEN"; 
            statusIcon = "🕓";
            statusClass = "open";
            break;
          case "accepted": 
            statusText = "ANGENOMMEN"; 
            statusIcon = "✅";
            statusClass = "accepted";
            break;
          case "rejected": 
            statusText = "ABGELEHNT"; 
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
// MODAL FUNKTIONEN
// =========================
function hideVotingModal() {
  const votingModal = document.getElementById("votingModal");
  if (votingModal) {
    votingModal.style.display = "none";
  }
  SELECTED_CREDIT_ID = null;
}

// =========================
// INITIALISIERUNG
// =========================
document.addEventListener("DOMContentLoaded", () => {
  // Modal Event Listeners
  const closeVotingModal = document.getElementById("closeVotingModal");
  const votingModal = document.getElementById("votingModal");
  
  if (closeVotingModal) {
    closeVotingModal.addEventListener("click", hideVotingModal);
  }
  
  if (votingModal) {
    votingModal.addEventListener("click", (e) => {
      if (e.target === votingModal) {
        hideVotingModal();
      }
    });
  }
  
  // ESC-Taste zum Schließen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideVotingModal();
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  await loadTotalMembers(); // Mitgliederanzahl laden
  await loadCredits();
  
  // Real-time Voting-Updates sind nicht mehr nötig - Voting ist jetzt vollständig automatisiert
  
  // Real-time Item-Benachrichtigungen einrichten
  if (window.setupRealtimeNotifications) {
    setTimeout(() => {
      window.setupRealtimeNotifications();
    }, 500);
  }
  
  // Login-Benachrichtigungen werden automatisch über notifications.js verwaltet
});

// =========================
// ADMIN-FUNKTIONEN
// =========================
// IS_ADMIN wird bereits oben deklariert

// Admin-Funktionen wurden entfernt - Voting ist jetzt vollständig automatisiert