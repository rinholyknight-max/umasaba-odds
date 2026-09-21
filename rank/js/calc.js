const STATS = ["speed", "stamina", "power", "guts", "wisdom"];
const STAT_LABELS = { speed: "スピード", stamina: "スタミナ", power: "パワー", guts: "根性", wisdom: "賢さ" };

let statFormula = null;
let uniqueSkillTable = null;
let skillData = null;
let rankThresholds = null;
const selectedSkillIds = new Set();

const SKILL_TYPE_LABELS = { speed: "速度", accel: "加速", recovery: "回復", green: "緑", evolution: "進化" };
let selectedSkillType = null;

const RUNNING_STYLE_LABELS = { nige: "逃げ", senkou: "先行", sashi: "差し", oikomi: "追込" };
const DISTANCE_LABELS = { tankyori: "短距離", mile: "マイル", chukyori: "中距離", chokyori: "長距離" };
let selectedRunningStyle = null;
let selectedDistance = null;

const STORAGE_KEY = "umasaba-odds-rank-state-v1";

function saveCachedState() {
  try {
    const stats = {};
    STATS.forEach((key) => {
      stats[key] = document.getElementById(`stat-${key}`).value;
    });
    const aptitudes = {};
    selectedSkillIds.forEach((id) => {
      const sel = document.querySelector(`.skill-aptitude[data-id="${id}"]`);
      if (sel) aptitudes[id] = sel.value;
    });
    const state = {
      stats,
      uniqueTier: document.getElementById("unique-tier").value,
      uniqueLevel: document.getElementById("unique-level").value,
      rankLimit: document.getElementById("rank-limit").value,
      selectedSkillIds: Array.from(selectedSkillIds),
      aptitudes,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorageが使えない環境（プライベートモード等）では諦める
  }
}

function loadCachedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

const SUPPORT_CARD_STORAGE_KEY = "umasaba-odds-support-cards-v1";
let supportCards = [];
const activeCardIds = new Set();
let pendingCardSkillIds = [];

function saveSupportCards() {
  try {
    localStorage.setItem(
      SUPPORT_CARD_STORAGE_KEY,
      JSON.stringify({ cards: supportCards, active: Array.from(activeCardIds) })
    );
  } catch (e) {
    // localStorageが使えない環境では諦める
  }
}

function loadSupportCards() {
  try {
    const raw = localStorage.getItem(SUPPORT_CARD_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    supportCards = Array.isArray(parsed.cards) ? parsed.cards : [];
    (parsed.active || []).forEach((id) => activeCardIds.add(id));
  } catch (e) {
    supportCards = [];
  }
}

function prioritySkillIdSet() {
  const ids = new Set();
  supportCards.forEach((card) => {
    if (activeCardIds.has(card.id)) {
      card.skillIds.forEach((id) => ids.add(id));
    }
  });
  return ids;
}

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

function renderFilterGroup(containerId, labels, getSelected, setSelected, rerender) {
  const container = document.getElementById(containerId);
  const values = [null, ...Object.keys(labels)];
  container.innerHTML = values
    .map((value) => {
      const label = value === null ? "すべて" : labels[value];
      const active = getSelected() === value ? " active" : "";
      return `<button type="button" class="type-filter-btn${active}" data-value="${value ?? ""}">${label}</button>`;
    })
    .join("");

  container.querySelectorAll(".type-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelected(btn.dataset.value || null);
      rerender();
      filterSkillList(document.getElementById("skill-search").value);
    });
  });
}

function renderSkillTypeFilter() {
  renderFilterGroup(
    "skill-type-filter",
    SKILL_TYPE_LABELS,
    () => selectedSkillType,
    (v) => (selectedSkillType = v),
    renderSkillTypeFilter
  );
}

function renderRunningStyleFilter() {
  renderFilterGroup(
    "skill-running-style-filter",
    RUNNING_STYLE_LABELS,
    () => selectedRunningStyle,
    (v) => (selectedRunningStyle = v),
    renderRunningStyleFilter
  );
}

function renderDistanceFilter() {
  renderFilterGroup(
    "skill-distance-filter",
    DISTANCE_LABELS,
    () => selectedDistance,
    (v) => (selectedDistance = v),
    renderDistanceFilter
  );
}

function renderSupportCardList() {
  const container = document.getElementById("support-card-list");
  if (supportCards.length === 0) {
    container.innerHTML = `<p class="note">登録済みのカードはまだありません。</p>`;
    return;
  }
  container.innerHTML = supportCards
    .map(
      (card) => `
        <div class="card-item" data-id="${card.id}">
          <label>
            <input type="checkbox" class="card-active-checkbox" data-id="${card.id}" ${activeCardIds.has(card.id) ? "checked" : ""} />
            ${card.name}
            <span class="card-skill-count">（${card.skillIds.length}スキル）</span>
          </label>
          <button type="button" class="card-delete" data-id="${card.id}">削除</button>
        </div>
      `
    )
    .join("");

  container.querySelectorAll(".card-active-checkbox").forEach((el) => {
    el.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) activeCardIds.add(id);
      else activeCardIds.delete(id);
      saveSupportCards();
      renderSkillList();
      filterSkillList(document.getElementById("skill-search").value);
    });
  });
  container.querySelectorAll(".card-delete").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = e.target.dataset.id;
      supportCards = supportCards.filter((c) => c.id !== id);
      activeCardIds.delete(id);
      saveSupportCards();
      renderSupportCardList();
      renderSkillList();
      filterSkillList(document.getElementById("skill-search").value);
    });
  });
}

function renderCardSkillChips() {
  const container = document.getElementById("card-skill-chips");
  container.innerHTML = pendingCardSkillIds
    .map((id) => {
      const skill = skillData.skills.find((s) => s.id === id);
      if (!skill) return "";
      return `<span class="chip" data-id="${id}">${skill.name}<button type="button" data-id="${id}">×</button></span>`;
    })
    .join("");
  container.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      pendingCardSkillIds = pendingCardSkillIds.filter((id) => id !== btn.dataset.id);
      renderCardSkillChips();
    });
  });
}

function renderCardSkillCandidates(query) {
  const list = document.getElementById("card-skill-candidates");
  if (!query) {
    list.innerHTML = "";
    return;
  }
  const q = query.toLowerCase();
  const matches = skillData.skills
    .filter((s) => s.name.toLowerCase().includes(q) && !pendingCardSkillIds.includes(s.id))
    .slice(0, 30);
  list.innerHTML = matches.map((s) => `<li data-id="${s.id}">${s.name}</li>`).join("");
  list.querySelectorAll("li[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      if (!pendingCardSkillIds.includes(el.dataset.id)) {
        pendingCardSkillIds.push(el.dataset.id);
      }
      renderCardSkillChips();
      renderCardSkillCandidates(document.getElementById("card-skill-search").value);
    });
  });
}

function renderSkillList() {
  const list = document.getElementById("skill-list");
  const priorityIds = prioritySkillIdSet();
  const orderedSkills = [...skillData.skills].sort((a, b) => {
    const pa = priorityIds.has(a.id) ? 0 : 1;
    const pb = priorityIds.has(b.id) ? 0 : 1;
    return pa - pb;
  });
  list.innerHTML = orderedSkills
    .map((skill) => {
      const requiresAptitude = skill.aptitudeType !== "none";
      const ptLabel = skill.needsData ? "データ未設定" : skill.requiredPt != null ? `必要pt: ${skill.requiredPt}` : "必要ptデータなし";
      const characterLabel = skill.character ? `［${skill.character}］` : "";
      const isSelected = selectedSkillIds.has(skill.id);
      const isPriority = priorityIds.has(skill.id);
      const stylesAttr = (skill.styles || []).join(" ");
      return `
        <li class="skill-row${skill.needsData ? " skill-row--needs-data" : ""}${isSelected ? " selected" : ""}${isPriority ? " skill-row--priority" : ""}" data-id="${skill.id}" data-type="${skill.skillType ?? ""}" data-styles="${stylesAttr}">
          <label>
            <input type="checkbox" class="skill-checkbox" data-id="${skill.id}" ${isSelected ? "checked" : ""} />
            ${isPriority ? `<span class="priority-badge">優先</span>` : ""}${skill.name}（${ptLabel}）${characterLabel}
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

  list.querySelectorAll(".skill-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".skill-aptitude") || e.target.closest("label")) return;
      const checkbox = row.querySelector(".skill-checkbox");
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });
  });
  list.querySelectorAll(".skill-checkbox").forEach((el) => {
    el.addEventListener("change", (e) => {
      const id = e.target.dataset.id;
      const row = e.target.closest(".skill-row");
      if (e.target.checked) {
        selectedSkillIds.add(id);
        row.classList.add("selected");
      } else {
        selectedSkillIds.delete(id);
        row.classList.remove("selected");
      }
      updateTotal();
    });
  });
  list.querySelectorAll(".skill-aptitude").forEach((el) => {
    el.addEventListener("change", updateTotal);
  });
}

function renderSelectedSkillList() {
  const list = document.getElementById("selected-skill-list");
  document.getElementById("selected-count").textContent = selectedSkillIds.size;

  if (selectedSkillIds.size === 0) {
    list.innerHTML = `<li class="empty">まだ選択されていません</li>`;
    return;
  }

  const items = Array.from(selectedSkillIds)
    .map((id) => skillData.skills.find((s) => s.id === id))
    .filter(Boolean);

  list.innerHTML = items
    .map((skill) => {
      const aptitudeSelect = document.querySelector(`.skill-aptitude[data-id="${skill.id}"]`);
      const aptitude = aptitudeSelect ? aptitudeSelect.value : "none";
      const score = skillScore(skill, aptitude);
      return `<li data-id="${skill.id}"><span>${skill.name}</span><span>${score}点</span></li>`;
    })
    .join("");

  list.querySelectorAll("li[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      selectedSkillIds.delete(id);
      const checkbox = document.querySelector(`.skill-checkbox[data-id="${id}"]`);
      if (checkbox) {
        checkbox.checked = false;
        checkbox.closest(".skill-row")?.classList.remove("selected");
      }
      updateTotal();
    });
  });
}

function filterSkillList(query) {
  const rows = document.querySelectorAll(".skill-row");
  rows.forEach((row) => {
    const styles = row.dataset.styles ? row.dataset.styles.split(" ") : [];
    const hasStyleTag = styles.some((s) => s in RUNNING_STYLE_LABELS);
    const hasDistanceTag = styles.some((s) => s in DISTANCE_LABELS);

    const matchesQuery = !query || row.textContent.toLowerCase().includes(query.toLowerCase());
    const matchesType = !selectedSkillType || row.dataset.type === selectedSkillType;
    const matchesRunningStyle = !selectedRunningStyle || !hasStyleTag || styles.includes(selectedRunningStyle);
    const matchesDistance = !selectedDistance || !hasDistanceTag || styles.includes(selectedDistance);
    row.hidden = !matchesQuery || !matchesType || !matchesRunningStyle || !matchesDistance;
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
      diffEl.style.color = diffHigh >= 0 ? "#15803D" : "#B91C1C";
    } else {
      const lowText = diffLow >= 0 ? `残り${diffLow}点` : `超過${Math.abs(diffLow)}点`;
      const highText = diffHigh >= 0 ? `残り${diffHigh}点` : `超過${Math.abs(diffHigh)}点`;
      diffEl.textContent = `下限想定: ${lowText} / 上限想定: ${highText}`;
      diffEl.style.color = diffHigh >= 0 ? "#15803D" : "#B91C1C";
    }
  } else {
    diffEl.textContent = "";
  }

  renderSelectedSkillList();
  saveCachedState();
}

async function init() {
  await loadData();
  const cached = loadCachedState();
  if (cached && Array.isArray(cached.selectedSkillIds)) {
    cached.selectedSkillIds.forEach((id) => selectedSkillIds.add(id));
  }
  loadSupportCards();

  renderStatInputs();
  renderUniqueSkillInputs();
  renderSkillTypeFilter();
  renderRunningStyleFilter();
  renderDistanceFilter();
  renderSupportCardList();
  renderSkillList();

  if (cached) {
    STATS.forEach((key) => {
      if (cached.stats && cached.stats[key] != null) {
        document.getElementById(`stat-${key}`).value = cached.stats[key];
      }
    });
    if (cached.uniqueTier) {
      document.getElementById("unique-tier").value = cached.uniqueTier;
      document.getElementById("unique-tier").dispatchEvent(new Event("change"));
    }
    if (cached.uniqueLevel != null) document.getElementById("unique-level").value = cached.uniqueLevel;
    if (cached.rankLimit != null) document.getElementById("rank-limit").value = cached.rankLimit;
    if (cached.aptitudes) {
      Object.entries(cached.aptitudes).forEach(([id, value]) => {
        const sel = document.querySelector(`.skill-aptitude[data-id="${id}"]`);
        if (sel) sel.value = value;
      });
    }
  }

  document.getElementById("rank-limit").addEventListener("input", updateTotal);
  document.getElementById("skill-search").addEventListener("input", (e) => filterSkillList(e.target.value));
  document.getElementById("card-skill-search").addEventListener("input", (e) => renderCardSkillCandidates(e.target.value));
  document.getElementById("card-save-button").addEventListener("click", () => {
    const nameInput = document.getElementById("card-name-input");
    const name = nameInput.value.trim();
    if (!name || pendingCardSkillIds.length === 0) {
      alert("カード名と、少なくとも1つのスキルを指定してください。");
      return;
    }
    supportCards.push({
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      skillIds: [...pendingCardSkillIds],
    });
    saveSupportCards();
    pendingCardSkillIds = [];
    nameInput.value = "";
    document.getElementById("card-skill-search").value = "";
    renderCardSkillChips();
    renderCardSkillCandidates("");
    renderSupportCardList();
    document.getElementById("support-card-form").open = false;
  });
  document.getElementById("save-button").addEventListener("click", () => {
    saveCachedState();
    const status = document.getElementById("save-status");
    status.textContent = "保存しました";
    setTimeout(() => {
      if (status.textContent === "保存しました") status.textContent = "";
    }, 2000);
  });
  updateTotal();
}

init();
