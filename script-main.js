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
// WOCHENSTART
// =========================

const START_BALANCE = 0;
const WEEKLY_CONTRIBUTION = 2000000;
const WEEK_LABEL = "Woche 1";

// =========================
// TEAMZIELE
// =========================

const goals = [
  { name: "Bohrer V3", cost: 1000000000, current: 800000000 },
  { name: "Phils Bauhacke", cost: 180000000, current: 50000000 }
];

// =========================
// WOCHENDATEN
// =========================

const data = {
  extraIncome: [
    { type: "Spende", amount: 1000000, from: "Folte38", reason: "Spende" }
  ],
  expenses: { projects: 0, shop: 0, losses: 0 },
  players: [
    { name: "Folte38", paid: true },
    { name: "Slexx47", paid: true },
    { name: "TobiWanNoobie", paid: true },
    { name: "LeRqvenrr", paid: true },
    { name: "Gerry237", paid: true },
    { name: "Jerry237", paid: true },
    { name: "ObsiCK", paid: false },
    { name: "Nico", paid: false }
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

const totalExpenses =
  data.expenses.projects +
  data.expenses.shop +
  data.expenses.losses;

const balance = START_BALANCE + totalIncome - totalExpenses;

// =========================
// STATUSZEILE
// =========================

document.getElementById("statusLine").textContent =
  `${WEEK_LABEL} · ${paidPlayers.length} / ${data.players.length} Spieler bezahlt`;

// =========================
// STATS (INITIAL)
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
// SPIELER (MIT KÖPFEN)
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
      <div class="progress">
        <div style="width:${percent}%"></div>
      </div>
    </div>
  `;
});

// =========================
// SCREENSHOT BUTTON (16:9)
// =========================

document.getElementById("shotBtn").onclick = () => {
  document.body.classList.toggle("shot");
  const isShot = document.body.classList.contains("shot");
  renderStats(isShot);
};
