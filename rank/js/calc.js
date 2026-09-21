const STATS = ["speed", "stamina", "power", "guts", "wisdom"];
const STAT_LABELS = { speed: "スピード", stamina: "スタミナ", power: "パワー", guts: "根性", wisdom: "賢さ" };

let statFormula = null;
let uniqueSkillTable = null;
let skillData = null;
let rankThresholds = null;
const selectedSkillIds = new Set();

const SKILL_TYPE_LABELS = { speed: "速度", accel: "加速", recovery: "回復", green: "緑", evolution: "進化" };
let selectedSkillType = null;

async function loadData() {
  const [statRes, uniqueRes, skillsRes, rankRes] = await Promise.all([
    fetch("data/stat-table.json"),
    fetch("data/unique-skill.json"),
    fetch("data/skills.json"),
    fetch("data/rank-table.json"),
  ]);
  statFormula = await statRes.json();
  uniqueSkillTable = (await uniqueRes.json()).tiers;
  skillData = await skillsRes.json();
  rankThresholds = (await rankRes.json()).thresholds;
}

// ステータス値→評価点の生値（10倍スケール）を、data/stat-table.jsonの階段関数パラメータに従って積算する。
// 出典: https://umakonga-t.github.io/hyokatenCalc/ のロジックを移植（0〜verifiedMaxで実測値と一致することを確認済み）。
function segmentRawScore(segment, toValue) {
  let bucketIndex = 0;
  let raw = segment.startRaw;
  const [firstBreak, secondBreak] = segment.firstBucketBreaks;
  for (let v = segment.fromValue; v <= toValue; v++) {
    if (v <= firstBreak) bucketIndex = 0;
    else if (v <= secondBreak) bucketIndex = 1;
    else if (v % segment.bucketSize === 0) bucketIndex++;
    raw += segment.rates[bucketIndex];
  }
  return raw;
}

function tailRawScore(tail, toValue) {
  let bucketCount = 0;
  let raw = tail.startRaw;
  let rate = tail.startRate;
  for (let v = tail.fromValue; v <= toValue; v++) {
    if (bucketCount >= tail.bucketSize) {
      rate++;
      bucketCount = 0;
    }
    raw += rate;
    bucketCount++;
  }
  return raw;
}

// 任意のステータス値（verifiedMaxを超えた外挿域も含む）に対する厳密な評価点を返す。
function statPointsExact(value) {
  if (value <= 0) return 0;
  const [seg1, seg2] = statFormula.segments;
  let raw;
  if (value <= seg1.toValue) raw = segmentRawScore(seg1, value);
  else if (value <= seg2.toValue) raw = segmentRawScore(seg2, value);
  else raw = tailRawScore(statFormula.tailSegment, value);
  return Math.round(raw / 10);
}

// verifiedMaxまでは同じ式による確定値。それを超える域は式をそのまま外挿した値をhigh、
// 直近2点（verifiedMax-100〜verifiedMax）の傾きをそのまま延ばした保守的な値をlowとして幅を持たせる。
function statScoreRange(value) {
  const verifiedMax = statFormula.verifiedMax;
  if (value <= verifiedMax) {
    const exact = statPointsExact(value);
    return { low: exact, high: exact };
  }
  const high = statPointsExact(value);
  const atMax = statPointsExact(verifiedMax);
  const slope = atMax - statPointsExact(verifiedMax - 100);
  const low = Math.round(atMax + (slope / 100) * (value - verifiedMax));
  return { low, high };
}

function rankLabel(points) {
  if (!rankThresholds || !rankThresholds.length) return "";
  for (const [threshold, label] of rankThresholds) {
    if (points <= threshold) return label;
  }
  const [, topLabel] = rankThresholds[rankThresholds.length - 1];
  return `${topLabel}超`;
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
      const ptLabel = skill.needsData ? "データ未設定" : skill.requiredPt != null ? `必要pt: ${skill.requiredPt}` : "必要ptデータなし";
      const characterLabel = skill.character ? `［${skill.character}］` : "";
      return `
        <li class="skill-row${skill.needsData ? " skill-row--needs-data" : ""}" data-id="${skill.id}" data-type="${skill.skillType ?? ""}">
          <label>
            <input type="checkbox" class="skill-checkbox" data-id="${skill.id}" />
            ${skill.name}（${ptLabel}）${characterLabel}
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
    ptTotal += skill.requiredPt || 0;
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
  document.getElementById("grand-rank").textContent =
    grandLow === grandHigh ? rankLabel(grandLow) : `${rankLabel(grandLow)}〜${rankLabel(grandHigh)}`;

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
