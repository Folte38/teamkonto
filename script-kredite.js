// =========================
// LOGIN CHECK & SEITEN-WECHSEL
// =========================
document.addEventListener("DOMContentLoaded", function() {
  window.supabaseClient.auth.getSession().then(({ data }) => {
    if (!data.session) {
      // Nicht eingeloggt -> Login-Seite anzeigen
      document.getElementById('loginPage').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
    } else {
      // Eingeloggt -> Hauptinhalt anzeigen
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      initializeApp();
    }
  });
});

// =========================
// APP INITIALISIERUNG (wird nur bei eingeloggten Nutzern aufgerufen)
// =========================
function initializeApp() {
  loadProfile();
  loadTotalMembers();
  loadCredits();
  setupEventListeners();
}

// =========================
// KOMPLETT NEUES KREDITSYSTEM (FIXED)
// =========================
let CURRENT_USER_ID = null;
let CURRENT_MC_NAME = null;
let SELECTED_CREDIT_ID = null;
let TOTAL_MEMBERS = 0;

// =========================
// MITGLIEDERANZAHL LADEN
// =========================
async function loadTotalMembers() {
  try {
    const { data: profiles } = await window.supabaseClient
      .from("profiles")
      .select("id");
    
    TOTAL_MEMBERS = profiles ? profiles.length : 0;
    console.log("Gesamtmitglieder: " + TOTAL_MEMBERS);
  } catch (error) {
    console.error("Fehler beim Laden der Mitgliederanzahl:", error);
    TOTAL_MEMBERS = 3; // Fallback
  }
}

// =========================
// PROFIL & NAVIGATION
// =========================
async function loadProfile() {
  try {
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
        "https://mc-heads.net/avatar/" + profile.mc_name + "/64";
      navUser.style.display = "flex";
    }

    // Formular vorausfüllen
    const creditUser = document.getElementById("creditUser");
    if (creditUser) {
      creditUser.value = profile.mc_name;
    }

    // Logout-Button anzeigen
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.style.display = "block";
    }
  } catch (error) {
    console.error("Fehler beim Laden des Profils:", error);
  }
}

// =========================
// LOGOUT FUNKTION
// =========================
async function logout() {
  try {
    await window.supabaseClient.auth.signOut();
    window.location.href = "index.html";
  } catch (error) {
    console.error("Fehler beim Logout:", error);
  }
}

// =========================
// KREDITANTRÄGE LADEN
// =========================
async function loadCredits() {
  const list = document.getElementById("creditList");
  if (!list) return;

  try {
    // Einfache Abfrage - NEUE TABELLEN
    const { data: requests } = await window.supabaseClient
      .from("credit_requests_new")
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

    if (!requests || requests.length === 0) {
      list.innerHTML = '<div class="no-requests">Keine Kreditanträge gefunden</div>';
      await calculateStats([]);
      return;
    }

    // Profile separat laden für Namen
    const { data: profiles } = await window.supabaseClient
      .from("profiles")
      .select("id, mc_name");

    // Votes separat laden - NEUE TABELLE
    const { data: votes } = await window.supabaseClient
      .from("credit_votes_new")
      .select("request_id, user_id, vote");

    // Daten zusammenfügen
    const requestsWithDetails = requests.map(request => {
      const profile = profiles.find(p => p.id === request.user_id);
      const requestVotes = votes.filter(v => v.request_id === request.id);
      
      return {
        ...request,
        mc_name: profile ? profile.mc_name : "Unbekannt",
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
            .from("credit_requests_new")
            .update({ status: newStatus })
            .eq("id", request.id);
          
          // Status im lokalen Array aktualisieren
          request.status = newStatus;
        }
      }
    }

    // Statistiken berechnen
    await calculateStats(requestsWithDetails);

    // Anträge anzeigen
    list.innerHTML = "";

    // Offene Anträge zuerst anzeigen
    const openRequests = requestsWithDetails.filter(r => r.status === "open");
    const otherRequests = requestsWithDetails.filter(r => r.status !== "open");
    const allRequests = [...openRequests, ...otherRequests];

    allRequests.forEach(r => {
      const yes = r.credit_votes.filter(v => v.vote === "yes").length;
      const no = r.credit_votes.filter(v => v.vote === "no").length;
      const totalVotes = yes + no;
      
      // Status auf Deutsch übersetzen
      let statusText = "";
      let statusClass = "";
      switch(r.status) {
        case "open": statusText = "OFFEN"; statusClass = "open"; break;
        case "accepted": statusText = "ANGENOMMEN"; statusClass = "accepted"; break;
        case "rejected": statusText = "ABGELEHNT"; statusClass = "rejected"; break;
        default: statusText = r.status.toUpperCase(); statusClass = r.status;
      }

      // Klick-Event für Kredit-Box
      const onclick = r.status === "open" ? "selectCredit('" + r.id + "')" : "";

      // Voting-Status anzeigen (nur für offene Anträge)
      let votingStatus = "";
      if (r.status === "open") {
        if (totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0) {
          // Alle haben abgestimmt - zeige Ergebnis
          const majority = yes > no ? "👍 Mehrheit dafür" : yes < no ? "👎 Mehrheit dagegen" : "⚖️ Unentschieden";
          votingStatus = '<div class="voting-complete">✅ ' + yes + ' 👍 | ' + no + ' 👎 - ' + majority + '</div>';
        } else {
          votingStatus = '<div class="voting-progress">🗳️ ' + totalVotes + '/' + TOTAL_MEMBERS + ' abgestimmt (' + yes + ' 👍 | ' + no + ' 👎)</div>';
        }
      }

      list.innerHTML += 
        '<div class="credit-box ' + r.status + '" onclick="' + onclick + '" style="' + (r.status === 'open' ? 'cursor: pointer;' : '') + '">' +
          '<div class="credit-box-header">' +
            '<h3>📄 ' + r.purpose + '</h3>' +
            '<div class="credit-status-badge">' + statusText + '</div>' +
          '</div>' +
          '<div class="credit-meta">' +
            '<div><strong>👤 Antragsteller:</strong> ' + r.mc_name + '</div>' +
            '<div><strong>💰 Gesamtpreis:</strong> ' + r.total_price.toLocaleString() + ' $</div>' +
            '<div><strong>💳 Kreditbetrag:</strong> ' + r.credit_amount.toLocaleString() + ' $</div>' +
            '<div><strong>📆 Rückzahlung:</strong> ' + r.repayment + '</div>' +
          '</div>' +
          votingStatus +
          (r.reason ? '<p class="credit-reason"><strong>📝 Begründung:</strong> ' + r.reason + '</p>' : '') +
        '</div>';
    });
  } catch (error) {
    console.error("Fehler beim Laden der Kreditanträge:", error);
    list.innerHTML = '<div class="error">Fehler beim Laden der Kreditanträge</div>';
  }
}

// =========================
// KREDIT AUSWÄHLEN FÜR ABSTIMMUNG
// =========================
async function selectCredit(creditId) {
  SELECTED_CREDIT_ID = creditId;
  
  try {
    // Einfache Abfrage - NEUE TABELLEN
    const { data: credit } = await window.supabaseClient
      .from("credit_requests_new")
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

    // Profile und Votes separat laden - NEUE TABELLE
    const { data: profiles } = await window.supabaseClient
      .from("profiles")
      .select("id, mc_name");

    const { data: votes } = await window.supabaseClient
      .from("credit_votes_new")
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
    if (votingModal) {
      votingModal.style.display = "flex";

      // Daten einfügen
      const selectedCreditPurpose = document.getElementById("selectedCreditPurpose");
      const selectedCreditAmount = document.getElementById("selectedCreditAmount");
      const selectedCreditTotal = document.getElementById("selectedCreditTotal");
      const selectedCreditRepayment = document.getElementById("selectedCreditRepayment");
      const selectedCreditUser = document.getElementById("selectedCreditUser");
      const selectedCreditReason = document.getElementById("selectedCreditReason");
      const voteText = document.getElementById("voteText");
      
      if (selectedCreditPurpose) selectedCreditPurpose.textContent = credit.purpose;
      if (selectedCreditAmount) selectedCreditAmount.textContent = credit.credit_amount.toLocaleString();
      if (selectedCreditTotal) selectedCreditTotal.textContent = credit.total_price.toLocaleString();
      if (selectedCreditRepayment) selectedCreditRepayment.textContent = credit.repayment;
      if (selectedCreditUser) selectedCreditUser.textContent = profile ? profile.mc_name : "Unbekannt";
      
      // Begründung anzeigen falls vorhanden
      if (selectedCreditReason) {
        if (credit.reason) {
          selectedCreditReason.textContent = credit.reason;
          selectedCreditReason.style.display = "block";
        } else {
          selectedCreditReason.style.display = "none";
        }
      }

      // Einfache Stimmenanzeige statt Progressbar
      const remainingVotes = TOTAL_MEMBERS - totalVotes;
      const voteStatusText = totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0 
        ? yes + " 👍 | " + no + " 👎 - Alle " + TOTAL_MEMBERS + " haben abgestimmt"
        : yes + " 👍 | " + no + " 👎 (" + totalVotes + "/" + TOTAL_MEMBERS + " abgestimmt, " + remainingVotes + " fehlen)";
      
      if (voteText) voteText.textContent = voteStatusText;

      // Automatische Auswertung wenn alle abgestimmt haben
      if (totalVotes === TOTAL_MEMBERS && TOTAL_MEMBERS > 0) {
        // Automatisch nach Mehrheit entscheiden
        const newStatus = yes > no ? "accepted" : yes < no ? "rejected" : "rejected";
        await window.supabaseClient
          .from("credit_requests_new")
          .update({ status: newStatus })
          .eq("id", creditId);
        
        // Modal schließen und neu laden
        hideVotingModal();
        await loadCredits();
        return;
      }

      // Prüfen, ob Benutzer bereits abgestimmt hat
      const hasVoted = creditVotes.some(v => v.user_id === CURRENT_USER_ID);
      const voteYesBtn = document.getElementById("voteYesBtn");
      const voteNoBtn = document.getElementById("voteNoBtn");
      
      if (voteYesBtn && voteNoBtn) {
        if (hasVoted) {
          voteYesBtn.disabled = true;
          voteNoBtn.disabled = true;
          voteYesBtn.textContent = "👍 Bereits abgestimmt";
          voteNoBtn.textContent = "👎 Bereits abgestimmt";
        } else {
          voteYesBtn.disabled = false;
          voteNoBtn.disabled = false;
          voteYesBtn.textContent = "👍 Ja, dafür";
          voteNoBtn.textContent = "👎 Nein, dagegen";
        }

        // Event Listener für Buttons setzen
        voteYesBtn.onclick = function() { vote(creditId, 'yes'); };
        voteNoBtn.onclick = function() { vote(creditId, 'no'); };
      }
    }
  } catch (error) {
    console.error("Fehler in selectCredit:", error);
    alert("Fehler beim Laden des Kreditantrags: " + error.message);
  }
}

// =========================
// ABSTIMMEN
// =========================
async function vote(creditId, voteType) {
  try {
    // Prüfen, ob Benutzer bereits abgestimmt hat - NEUE TABELLE
    const { data: existingVote } = await window.supabaseClient
      .from("credit_votes_new")
      .select("id")
      .eq("request_id", creditId)
      .eq("user_id", CURRENT_USER_ID)
      .single();

    if (existingVote) {
      alert("Du hast bereits abgestimmt!");
      return;
    }

    // Stimme speichern - NEUE TABELLE
    await window.supabaseClient
      .from("credit_votes_new")
      .insert([{
        request_id: creditId,
        user_id: CURRENT_USER_ID,
        vote: voteType
      }]);

    // Prüfen ob alle abgestimmt haben und automatisch auswerten - NEUE TABELLEN
    const { data: updatedCredit } = await window.supabaseClient
      .from("credit_requests_new")
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
          .from("credit_requests_new")
          .update({ status: newStatus })
          .eq("id", creditId);
      }
    }
    
    // UI aktualisieren
    await loadCredits();
    
    // Wenn Modal noch offen ist, aktualisiere es
    if (SELECTED_CREDIT_ID === creditId) {
      const votingModal = document.getElementById("votingModal");
      if (votingModal && votingModal.style.display === "flex") {
        await selectCredit(creditId);
      }
    }
  } catch (error) {
    console.error("Fehler beim Abstimmen:", error);
    alert("Fehler beim Abstimmen: " + error.message);
  }
}

// =========================
// STATISTIKEN BERECHNEN
// =========================
async function calculateStats(requests) {
  try {
    const openCount = requests.filter(r => r.status === "open").length;
    const acceptedCount = requests.filter(r => r.status === "accepted").length;
    const rejectedCount = requests.filter(r => r.status === "rejected").length;
    
    const totalRequested = requests.reduce(function(sum, r) { return sum + r.credit_amount; }, 0);
    const avgCredit = requests.length > 0 ? Math.round(totalRequested / requests.length) : 0;

    // Update Statistiken
    const openCountEl = document.getElementById("openCount");
    const acceptedCountEl = document.getElementById("acceptedCount");
    const rejectedCountEl = document.getElementById("rejectedCount");
    const totalRequestedEl = document.getElementById("totalRequested");
    
    if (openCountEl) openCountEl.textContent = openCount;
    if (acceptedCountEl) acceptedCountEl.textContent = acceptedCount;
    if (rejectedCountEl) rejectedCountEl.textContent = rejectedCount;
    if (totalRequestedEl) totalRequestedEl.textContent = totalRequested.toLocaleString() + " $";

    // Meine Anträge anzeigen
    const myRequests = requests.filter(function(r) { return r.user_id === CURRENT_USER_ID; });
    const myList = document.getElementById("myCreditsList");
    
    if (myList) {
      myList.innerHTML = "";
      
      if (myRequests.length === 0) {
        myList.innerHTML = '<div class="no-requests">Noch keine eigenen Anträge</div>';
      } else {
        myRequests.slice(0, 5).forEach(function(r) {
          // Status auf Deutsch übersetzen
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
          
          myList.innerHTML += 
            '<div class="my-request ' + statusClass + '">' +
              '<div class="my-request-title">' + r.purpose + '</div>' +
              '<div class="my-request-amount">' + r.credit_amount.toLocaleString() + ' $</div>' +
              '<div class="my-request-status">' + statusIcon + ' ' + statusText + '</div>' +
            '</div>';
        });
      }
    }
  } catch (error) {
    console.error("Fehler beim Berechnen der Statistiken:", error);
  }
}

// =========================
// FORMULAR FÜR NEUEN ANTRAG
// =========================
document.addEventListener("DOMContentLoaded", function() {
  const creditForm = document.getElementById("creditForm");
  if (creditForm) {
    creditForm.addEventListener("submit", async function(e) {
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

      try {
        // NEUE TABELLE verwenden
        await window.supabaseClient.from("credit_requests_new").insert([{
          user_id: CURRENT_USER_ID,
          purpose: purpose,
          total_price: total,
          credit_amount: amount,
          repayment: repayment,
          reason: reason,
          status: "open"
        }]);

        creditForm.reset();
        const creditUser = document.getElementById("creditUser");
        if (creditUser) {
          creditUser.value = CURRENT_MC_NAME;
        }
        
        // Nach 1 Sekunde neu laden
        setTimeout(function() {
          loadCredits();
        }, 1000);
      } catch (error) {
        console.error("Fehler beim Erstellen des Kreditantrags:", error);
        alert("Fehler beim Erstellen des Kreditantrags: " + error.message);
      }
    });
  }
});

// =========================
// INIT - ANGEPASSTE VERSION
// =========================
// MODAL FUNKTIONEN
// =========================
function hideVotingModal() {
  const votingModal = document.getElementById("votingModal");
  if (votingModal) {
    votingModal.style.display = "none";
  }
}

function setupModalListeners() {
  // Close-Button für Voting-Modal
  const closeVotingBtn = document.getElementById("closeVotingModal");
  console.log("Close-Button gefunden:", closeVotingBtn); // Debug
  
  if (closeVotingBtn) {
    closeVotingBtn.addEventListener("click", (e) => {
      console.log("Close-Button geklickt!"); // Debug
      e.preventDefault();
      e.stopPropagation();
      hideVotingModal();
    });
    
    // Zusätzlich: Click-Event für alle Fälle
    closeVotingBtn.addEventListener("mousedown", (e) => {
      console.log("Close-Button mousedown!"); // Debug
      e.preventDefault();
      e.stopPropagation();
      hideVotingModal();
    });
  }
  
  // Modal schließen wenn außerhalb geklickt wird
  const votingModal = document.getElementById("votingModal");
  if (votingModal) {
    votingModal.addEventListener("click", (e) => {
      if (e.target === votingModal) {
        hideVotingModal();
      }
    });
  }
  
  // ESC Taste zum Schließen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideVotingModal();
    }
  });
}

// =========================
document.addEventListener("DOMContentLoaded", function() {
  // Warten auf Login-Check, dann initialisieren
  setTimeout(() => {
    const mainContent = document.getElementById('mainContent');
    if (mainContent && mainContent.style.display !== 'none') {
      // Nur initialisieren wenn eingeloggt und Hauptinhalt sichtbar
      setupModalListeners();
      loadProfile();
      loadTotalMembers();
      loadCredits();
    }
  }, 100);
  
  // Logout-Button Event Listener
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
});
