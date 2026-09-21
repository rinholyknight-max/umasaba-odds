const STATS = ["speed", "stamina", "power", "guts", "wisdom"];
const STAT_LABELS = { speed: "スピード", stamina: "スタミナ", power: "パワー", guts: "根性", wisdom: "賢さ" };

let realStatTable = null;
let lowStatTable = null;
let highStatTable = null;
let uniqueSkillTable = null;
let skillData = null;
const selectedSkillIds = new Set();

const SKILL_TYPE_LABELS = { speed: "速度", accel: "加速", recovery: "回復", green: "緑" };
let selectedSkillType = null;

function filterNumericKeys(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([key]) => /^\d+$/.test(key)));
}

async function loadData() {
  const [statRes, uniqueRes, skillsRes] = await Promise.all([
    fetch("data/stat-table.json"),
    fetch("data/unique-skill.json"),
    fetch("data/skills.json"),
  ]);
  const statJson = await statRes.json();
  realStatTable = filterNumericKeys(statJson.points);
  const rangeRaw = filterNumericKeys(statJson.estimatedRangeAbove1200 || {});
  lowStatTable = { ...realStatTable, ...Object.fromEntries(Object.entries(rangeRaw).map(([k, v]) => [k, v.low])) };
  highStatTable = { ...realStatTable, ...Object.fromEntries(Object.entries(rangeRaw).map(([k, v]) => [k, v.high])) };
  uniqueSkillTable = (await uniqueRes.json()).tiers;
  skillData = await skillsRes.json();
}

// テーブル範囲内は線形補間、最大キーを超えたら最後の2点の傾きで線形外挿する（精度は保証しない）。
function interpolateTable(table, value) {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (value <= keys[0]) return 0;

  const lastKey = keys[keys.length - 1];
  if (value > lastKey) {
    const prevKey = keys[keys.length - 2];
    const slope = (table[lastKey] - table[prevKey]) / (lastKey - prevKey);
    return Math.round(table[lastKey] + slope * (value - lastKey));
  }

  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i];
    const hi = keys[i + 1];
    if (value >= lo && value <= hi) {
      const loPt = table[lo];
      const hiPt = table[hi];
      const ratio = (value - lo) / (hi - lo);
      return Math.round(loPt + (hiPt - loPt) * ratio);
    }
  }
  return 0;
}

// 実測範囲（〜1200）は単一値、それ超は保守的/積極的フィットによる low/high レンジを返す。
function statScoreRange(value) {
  const maxRealKey = Math.max(...Object.keys(realStatTable).map(Number));
  if (value <= maxRealKey) {
    const exact = interpolateTable(realStatTable, value);
    return { low: exact, high: exact };
  }
  return {
    low: interpolateTable(lowStatTable, value),
    high: interpolateTable(highStatTable, value),
  };
}

function formatRange(low, high) {
  return low === high ? `${low}` : `${low}〜${high}`;
}

function uniqueSkillScore(tier, level) {
  const table = uniqueSkillTable[tier];
  if (!table || level < 0 || level >= table.length) return 0;
  return table[level];
}

function skillScore(skill, aptitudeGrade) {
  if (skill.needsData) return 0;
  if (skill.directPoint != null) return skill.directPoint;
  if (skill.tierIndex == null) return 0;
  const base = skillData.baseTier[skill.category][skill.tierIndex];
  const multiplier = skill.aptitudeType !== "none"
    ? skillData.aptitudeMultiplier[aptitudeGrade] ?? 1
    : 1;
  return Math.round(base * multiplier);
}

function efficiency(score, requiredPt) {
  if (!requiredPt) return 0;
  return score / requiredPt;
}

function renderStatInputs() {
  const container = document.getElementById("stat-inputs");
  container.innerHTML = STATS.map(
    (key) => `
      <label class="field">
        ${STAT_LABELS[key]}
        <input type="number" id="stat-${key}" min="0" max="3000" value="0" />
      </label>
    `
  ).join("");
  STATS.forEach((key) => {
    document.getElementById(`stat-${key}`).addEventListener("input", updateTotal);
  });
}

function renderUniqueSkillInputs() {
  const tierSelect = document.getElementById("unique-tier");
  const levelSelect = document.getElementById("unique-level");
  tierSelect.innerHTML = `
    <option value="star1-2">星1〜2</option>
    <option value="star3-5">星3〜5</option>
  `;
  const fillLevels = () => {
    const max = uniqueSkillTable[tierSelect.value].length - 1;
    levelSelect.innerHTML = Array.from({ length: max + 1 }, (_, lv) => `<option value="${lv}">Lv${lv}</option>`).join("");
  };
  fillLevels();
  tierSelect.addEventListener("change", () => {
    fillLevels();
    updateTotal();
  });
  levelSelect.addEventListener("change", updateTotal);
}

function renderSkillTypeFilter() {
  const container = document.getElementById("skill-type-filter");
  const types = [null, ...Object.keys(SKILL_TYPE_LABELS)];
  container.innerHTML = types
    .map((type) => {
      const label = type === null ? "すべて" : SKILL_TYPE_LABELS[type];
      const active = selectedSkillType === type ? " active" : "";
      return `<button type="button" class="type-filter-btn${active}" data-type="${type ?? ""}">${label}</button>`;
    })
    .join("");

  container.querySelectorAll(".type-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSkillType = btn.dataset.type || null;
      renderSkillTypeFilter();
      filterSkillList(document.getElementById("skill-search").value);
    });
  });
}

function renderSkillList() {
  const list = document.getElementById("skill-list");
  list.innerHTML = skillData.skills
    .map((skill) => {
      const requiresAptitude = skill.aptitudeType !== "none";
      const ptLabel = skill.needsData ? "データ未設定" : `必要pt: ${skill.requiredPt}`;
      return `
        <li class="skill-row${skill.needsData ? " skill-row--needs-data" : ""}" data-id="${skill.id}" data-type="${skill.skillType ?? ""}">
          <label>
            <input type="checkbox" class="skill-checkbox" data-id="${skill.id}" />
            ${skill.name}（${ptLabel}）
          </label>
          ${requiresAptitude ? `
            <select class="skill-aptitude" data-id="${skill.id}">
              <option value="S">S</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
              <option value="F">F</option>
              <option value="G">G</option>
            </select>
          ` : ""}
          <span class="skill-score" data-id="${skill.id}"></span>
        </li>
      `;
    })
    .join("");

  list.querySelectorAll(".skill-checkbox").forEach((el) => {
    el.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedSkillIds.add(id);
      else selectedSkillIds.delete(id);
      updateTotal();
    });
  });
  list.querySelectorAll(".skill-aptitude").forEach((el) => {
    el.addEventListener("change", updateTotal);
  });
}

function filterSkillList(query) {
  const rows = document.querySelectorAll(".skill-row");
  rows.forEach((row) => {
    const matchesQuery = !query || row.textContent.toLowerCase().includes(query.toLowerCase());
    const matchesType = !selectedSkillType || row.dataset.type === selectedSkillType;
    row.hidden = !matchesQuery || !matchesType;
  });
}

function updateTotal() {
  let statLow = 0;
  let statHigh = 0;
  STATS.forEach((key) => {
    const value = Number(document.getElementById(`stat-${key}`).value) || 0;
    const { low, high } = statScoreRange(value);
    statLow += low;
    statHigh += high;
  });

  const tier = document.getElementById("unique-tier").value;
  const level = Number(document.getElementById("unique-level").value) || 0;
  const uniqueTotal = uniqueSkillScore(tier, level);

  let skillTotal = 0;
  let ptTotal = 0;
  selectedSkillIds.forEach((id) => {
    const skill = skillData.skills.find((s) => s.id === id);
    if (!skill) return;
    const aptitudeSelect = document.querySelector(`.skill-aptitude[data-id="${id}"]`);
    const aptitude = aptitudeSelect ? aptitudeSelect.value : "none";
    const score = skillScore(skill, aptitude);
    const scoreEl = document.querySelector(`.skill-score[data-id="${id}"]`);
    if (scoreEl) scoreEl.textContent = `= ${score}点（効率 ${efficiency(score, skill.requiredPt).toFixed(2)}）`;
    skillTotal += score;
    ptTotal += skill.requiredPt;
  });

  // 固有スキル・獲得スキルは確定値なので low/high 双方に同じ値を加算する。
  const grandLow = statLow + uniqueTotal + skillTotal;
  const grandHigh = statHigh + uniqueTotal + skillTotal;
  const limit = Number(document.getElementById("rank-limit").value) || 0;

  document.getElementById("stat-total").textContent = formatRange(statLow, statHigh);
  document.getElementById("unique-total").textContent = uniqueTotal;
  document.getElementById("skill-total").textContent = skillTotal;
  document.getElementById("pt-total").textContent = ptTotal;
  document.getElementById("grand-total").textContent = formatRange(grandLow, grandHigh);

  const diffEl = document.getElementById("limit-diff");
  if (limit > 0) {
    const diffLow = limit - grandLow;
    const diffHigh = limit - grandHigh;
    if (grandLow === grandHigh) {
      diffEl.textContent = diffHigh >= 0 ? `残り ${diffHigh}点` : `超過 ${Math.abs(diffHigh)}点`;
      diffEl.style.color = diffHigh >= 0 ? "#2e7d32" : "#c62828";
    } else {
      const lowText = diffLow >= 0 ? `残り${diffLow}点` : `超過${Math.abs(diffLow)}点`;
      const highText = diffHigh >= 0 ? `残り${diffHigh}点` : `超過${Math.abs(diffHigh)}点`;
      diffEl.textContent = `下限想定: ${lowText} / 上限想定: ${highText}`;
      diffEl.style.color = diffHigh >= 0 ? "#2e7d32" : "#c62828";
    }
  } else {
    diffEl.textContent = "";
  }
}

async function init() {
  await loadData();
  renderStatInputs();
  renderUniqueSkillInputs();
  renderSkillTypeFilter();
  renderSkillList();
  document.getElementById("rank-limit").addEventListener("input", updateTotal);
  document.getElementById("skill-search").addEventListener("input", (e) => filterSkillList(e.target.value));
  updateTotal();
}

init();
