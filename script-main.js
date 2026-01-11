// =========================
// HILFSFUNKTION: ZAHLENFORMAT
// =========================

function formatMoney(value, screenshot = false) {
  if (screenshot) {
    if (value >= 1e9) return (value / 1e9).toFixed(2).replace(".", ",") + " Mrd";
    if (value >= 1e6) return (value / 1e6).toFixed(1).replace(".", ",") + " Mio";
    if (value >= 1e3) return Math.round(value / 1e3) + "k";
    return value.toString();
  }
  return value.toLocaleString() + " $";
}

// =========================
// BASISDATEN
// =========================

const START_BALANCE = 7000000;
const WEEKLY_CONTRIBUTION = 2000000;
const WEEK_LABEL = "Woche 2";

// =========================
// TEAMZIELE
// =========================

const goals = [
  { name: "Bohrer V2", cost: 550000000, current: 200000000 },
  { name: "Bohrer V2 (Erledigt)", cost: 550000000, current: 550000000 },
  { name: "Phils Bauhacke (Erledigt)", cost: 205000000, current: 205000000 }
];

// =========================
// WOCHENDATEN
// =========================

const data = {

  // Extra Einnahmen (wie bisher)
  extraIncome: [
    { type: "Spende", amount: 1000000, from: "Folte38", reason: "Spende" }
  ],

  // ✅ NEU: AUSGABEN ALS LISTE
//  expenses: [
//    {
//      type: "Projekt",
//      amount: 10000000,
//      reason: "Redstoneplot"
//    }
//  ],

  players: [
    { name: "Folte38", paid: false },
    { name: "Slexx47", paid: false },
    { name: "TobiWanNoobie", paid: false },
    { name: "LeRqvenrr", paid: false },
    { name: "Gerry237", paid: false },
    { name: "Jerry237", paid: false },
    { name: "ObsiCK", paid: false },
    { name: "ImNotGoodSorry", paid: false }
  ]
};

// =========================
// BERECHNUNGEN
// =========================

const paidPlayers = data.players.filter(p => p.paid);
const unpaidPlayers = data.players.filter(p => !p.paid);

const contributionIncome = paidPlayers.length * WEEKLY_CONTRIBUTION;
const extraIncomeTotal = data.extraIncome.reduce((s, e) => s + e.amount, 0);
const totalIncome = contributionIncome + extraIncomeTotal;

// ✅ Ausgaben automatisch berechnen
const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);

const balance = START_BALANCE + totalIncome - totalExpenses;

// =========================
// STATUS
// =========================

document.getElementById("statusLine").textContent =
  `${WEEK_LABEL} · ${paidPlayers.length} / ${data.players.length} Spieler bezahlt`;

// =========================
// STATS
// =========================

function renderStats(isShot) {
  document.getElementById("balance").textContent = formatMoney(balance, isShot);
  document.getElementById("income").textContent = formatMoney(totalIncome, isShot);
  document.getElementById("expenses").textContent = formatMoney(totalExpenses, isShot);
  document.getElementById("incContrib").textContent = formatMoney(contributionIncome, isShot);
  document.getElementById("incExtra").textContent = formatMoney(extraIncomeTotal, isShot);
}

renderStats(false);

// =========================
// EXTRA EINNAHMEN
// =========================

const extraList = document.getElementById("extraIncomeList");
extraList.innerHTML = "";

data.extraIncome.forEach(e => {
  extraList.innerHTML += `
    <div class="extra">
      <strong>${e.amount.toLocaleString()} $</strong>
      – ${e.type}<br>
      <span>${e.reason} · von ${e.from}</span>
    </div>
  `;
});

// =========================
// AUSGABEN (DETAILS + GRUND)
// =========================

const expenseList = document.getElementById("expenseList");
expenseList.innerHTML = "";

data.expenses.forEach(e => {
  expenseList.innerHTML += `
    <div class="extra">
      <strong>- ${e.amount.toLocaleString()} $</strong>
      – ${e.type}<br>
      <span>${e.reason}</span>
    </div>
  `;
});

// =========================
// SPIELER
// =========================

const playersEl = document.getElementById("players");
playersEl.innerHTML = "";

[...paidPlayers, ...unpaidPlayers].forEach(p => {
  playersEl.innerHTML += `
    <div class="player ${p.paid ? "paid" : "unpaid"}">
      <img src="https://mc-heads.net/avatar/${p.name}/64">
      <div class="name">${p.name}</div>
      <small>${p.paid ? "Bezahlt" : "Nicht bezahlt"}</small>
    </div>
  `;
});

// =========================
// TEAMZIELE
// =========================

const goalsEl = document.getElementById("goalsList");
goalsEl.innerHTML = "";

goals.forEach(g => {
  const percent = Math.min((g.current / g.cost) * 100, 100);
  goalsEl.innerHTML += `
    <div class="goal">
      <strong>${g.name}</strong><br>
      <small>Ziel: ${g.cost.toLocaleString()} $</small><br>
      <small>Vorhanden: ${g.current.toLocaleString()} $</small>
      <div class="progress"><div style="width:${percent}%"></div></div>
    </div>
  `;
});

// =========================
// SCREENSHOT BUTTON
// =========================

document.getElementById("shotBtn").onclick = () => {
  document.body.classList.toggle("shot");
  renderStats(document.body.classList.contains("shot"));
};

