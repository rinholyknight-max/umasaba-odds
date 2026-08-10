const DATA_KEY = "race_data";

function getRaceData() {
  const data = localStorage.getItem(DATA_KEY);
  return data ? JSON.parse(data) : [];
}

function saveRaceData(data) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

// オッズ計算ロジック
function calculateOdds(horses) {
  const totalBet = horses.reduce((sum, h) => sum + (h.bets || 0), 0);
  return horses.map((h) => {
    const odds = h.bets > 0 ? ((totalBet * 0.8) / h.bets).toFixed(2) : "0.00";
    return { ...h, odds }; // 還元率80%で計算
  });
}
