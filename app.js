const DATA_PATH = "./data/problems/initial_problems.json";
const WRONG_STOCK_KEY = "cefr_wrong_problem_ids_v1";
const WRONG_LOG_KEY = "cefr_wrong_logs_v1";
const RECOVERY_CORRECT_TARGET = 3;

const levelSelect = document.getElementById("levelSelect");
const modeSelect = document.getElementById("modeSelect");
const startBtn = document.getElementById("startBtn");
const clearWrongBtn = document.getElementById("clearWrongBtn");
const exportWrongBtn = document.getElementById("exportWrongBtn");
const wrongStockInfoEl = document.getElementById("wrongStockInfo");
const statusEl = document.getElementById("status");
const quizPanel = document.getElementById("quizPanel");
const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const questionTextEl = document.getElementById("questionText");
const choicesForm = document.getElementById("choicesForm");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const resultEl = document.getElementById("result");
const explanationEl = document.getElementById("explanation");
const choiceTranslationsEl = document.getElementById("choiceTranslations");
const wrongLogInfoEl = document.getElementById("wrongLogInfo");

let allProblems = [];
let sessionProblems = [];
let currentIndex = 0;
let correctCount = 0;
let answered = false;
let currentChoiceOrder = [];
let wrongStock = new Set();
let wrongLogs = {};

function loadWrongStock() {
  try {
    const raw = localStorage.getItem(WRONG_STOCK_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v) => typeof v === "string"));
  } catch (err) {
    console.error(err);
    return new Set();
  }
}

function saveWrongStock() {
  localStorage.setItem(WRONG_STOCK_KEY, JSON.stringify([...wrongStock]));
}

function loadWrongLogs() {
  try {
    const raw = localStorage.getItem(WRONG_LOG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch (err) {
    console.error(err);
    return {};
  }
}

function saveWrongLogs() {
  localStorage.setItem(WRONG_LOG_KEY, JSON.stringify(wrongLogs));
}

function formatDateTime(isoString) {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "日時不明";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return "日時不明";
  }
}

function getProblemWrongLog(problemId) {
  const log = wrongLogs[problemId];
  if (!log || typeof log !== "object") {
    return {
      wrong_count: 0,
      wrong_history: [],
      last_wrong_at: null,
      recovery_correct_streak: 0
    };
  }

  return {
    wrong_count: Number.isInteger(log.wrong_count) ? log.wrong_count : 0,
    wrong_history: Array.isArray(log.wrong_history) ? log.wrong_history : [],
    last_wrong_at: typeof log.last_wrong_at === "string" ? log.last_wrong_at : null,
    recovery_correct_streak: Number.isInteger(log.recovery_correct_streak)
      ? log.recovery_correct_streak
      : 0
  };
}

function recordWrongLog(problemId) {
  const now = new Date().toISOString();
  const current = getProblemWrongLog(problemId);
  const next = {
    wrong_count: current.wrong_count + 1,
    last_wrong_at: now,
    wrong_history: [...current.wrong_history, now],
    recovery_correct_streak: 0
  };
  wrongLogs[problemId] = next;
  saveWrongLogs();
  return next;
}

function recordCorrectForRecovery(problemId) {
  const current = getProblemWrongLog(problemId);
  const nextStreak = current.recovery_correct_streak + 1;
  const next = {
    ...current,
    recovery_correct_streak: nextStreak
  };
  wrongLogs[problemId] = next;
  saveWrongLogs();

  const removed = nextStreak >= RECOVERY_CORRECT_TARGET;
  if (removed) {
    wrongStock.delete(problemId);
    saveWrongStock();

    wrongLogs[problemId] = {
      ...next,
      recovery_correct_streak: 0
    };
    saveWrongLogs();
  }

  return {
    removed,
    streak: nextStreak,
    remain: Math.max(RECOVERY_CORRECT_TARGET - nextStreak, 0)
  };
}

function updateWrongStockInfo() {
  const level = levelSelect.value;
  const countByLevel = allProblems.filter(
    (p) => p.cefr_level === level && wrongStock.has(p.problem_id)
  ).length;
  wrongStockInfoEl.textContent = `誤答ストック: 全${wrongStock.size}問（${level}: ${countByLevel}問）`;
}

async function loadProblems() {
  try {
    const res = await fetch(DATA_PATH);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error("JSON format error");
    }

    allProblems = data.filter((p) => p.status === "draft" || p.status === "published");
    wrongStock = loadWrongStock();
    wrongLogs = loadWrongLogs();
    statusEl.textContent = `読込完了: ${allProblems.length}問`;
    updateWrongStockInfo();
  } catch (err) {
    statusEl.textContent = "読み込みに失敗しました。ローカルサーバーで開いてください。";
    startBtn.disabled = true;
    clearWrongBtn.disabled = true;
    console.error(err);
  }
}

function shuffle(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function shuffleChoiceOrder(length) {
  const base = Array.from({ length }, (_, idx) => idx);
  let shuffled = shuffle(base);
  let retry = 0;
  // 体感上の偏りを避けるため、同一順序が出た場合は数回だけ再シャッフルする
  while (retry < 3 && shuffled.every((v, i) => v === i)) {
    shuffled = shuffle(base);
    retry += 1;
  }
  return shuffled;
}

function containsJapanese(text) {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text);
}

function isEnglishChoiceText(text) {
  if (!text || containsJapanese(text)) return false;
  return /[A-Za-z]/.test(text);
}

function translateEnglishChoiceToJa(text) {
  const directMap = new Map([
    ["I am fine, thank you.", "元気です、ありがとうございます。"],
    ["My name is Ken.", "私の名前はケンです。"],
    ["Yes, I do.", "はい、好きです。"],
    ["I live in Osaka.", "大阪に住んでいます。"],
    ["Sure, I'll help after lunch.", "もちろん、昼食後に手伝います。"],
    ["For about three years.", "約3年間です。"],
    ["Because the bus was delayed.", "バスが遅れたからです。"],
    ["Yes, unless everyone can join on time.", "はい、全員が時間どおり参加できる場合を除いてです。"],
    ["It went well after I adjusted the slides.", "スライドを調整した後、うまくいきました。"],
    ["The one with fewer support requests.", "サポート依頼が少ない方です。"]
  ]);
  if (directMap.has(text)) return directMap.get(text);

  let t = text;
  const phraseRules = [
    [/^Read:\s*/i, "本文: "],
    [/What is their next goal\?/i, "彼らの次の目標は何ですか。"],
    [/Why did they postpone it\?/i, "なぜそれを延期したのですか。"],
    [/How are you\?/i, "お元気ですか。"],
    [/What is your name\?/i, "名前は何ですか。"],
    [/Do you like cats\?/i, "猫は好きですか。"],
    [/Where do you live\?/i, "どこに住んでいますか。"],
    [/because/gi, "なぜなら"],
    [/every day/gi, "毎日"],
    [/at home/gi, "家で"],
    [/yesterday/gi, "昨日"],
    [/before/gi, "〜の前に"],
    [/after/gi, "〜の後に"],
    [/team/gi, "チーム"],
    [/meeting/gi, "会議"],
    [/report/gi, "レポート"],
    [/proposal/gi, "提案書"],
    [/client/gi, "顧客"],
    [/library/gi, "図書館"],
    [/soccer/gi, "サッカー"],
    [/English/gi, "英語"]
  ];
  phraseRules.forEach(([re, rep]) => {
    t = t.replace(re, rep);
  });

  return `（参考訳）${t}`;
}

function renderChoiceTranslations(problem) {
  const allEnglish = problem.choices.every((c) => isEnglishChoiceText(String(c)));
  if (!allEnglish) {
    choiceTranslationsEl.classList.add("hidden");
    choiceTranslationsEl.innerHTML = "";
    return;
  }

  const rows = currentChoiceOrder.map((originalIndex, renderedIndex) => {
    const letter = String.fromCharCode(65 + renderedIndex);
    const en = String(problem.choices[originalIndex]);
    const ja = translateEnglishChoiceToJa(en);
    return `<li><strong>${letter}.</strong> ${ja}</li>`;
  });

  choiceTranslationsEl.innerHTML = `<p>選択肢の日本語訳</p><ul>${rows.join("")}</ul>`;
  choiceTranslationsEl.classList.remove("hidden");
}

function startSession() {
  const level = levelSelect.value;
  const mode = modeSelect.value;
  const levelProblems = allProblems.filter((p) => p.cefr_level === level);

  if (mode === "wrong_only") {
    sessionProblems = shuffle(allProblems.filter((p) => wrongStock.has(p.problem_id)));
  } else {
    sessionProblems = shuffle(levelProblems);
  }

  currentIndex = 0;
  correctCount = 0;
  answered = false;

  if (sessionProblems.length === 0) {
    statusEl.textContent =
      mode === "wrong_only"
        ? "誤答ストック問題がありません。"
        : `${level}の問題がありません。`;
    quizPanel.classList.add("hidden");
    return;
  }

  statusEl.textContent =
    mode === "wrong_only"
      ? `全レベルの誤答のみ出題を開始（${sessionProblems.length}問）`
      : `${level}を開始しました（${sessionProblems.length}問）`;
  quizPanel.classList.remove("hidden");
  renderCurrentProblem();
}

function renderCurrentProblem() {
  const p = sessionProblems[currentIndex];
  answered = false;

  progressEl.textContent = `${currentIndex + 1} / ${sessionProblems.length}`;
  scoreEl.textContent = `正答: ${correctCount}`;
  questionTextEl.textContent = p.question_text;

  choicesForm.innerHTML = "";
  currentChoiceOrder = shuffleChoiceOrder(p.choices.length);
  currentChoiceOrder.forEach((originalIndex, renderedIndex) => {
    const choice = p.choices[originalIndex];
    const item = document.createElement("div");
    item.className = "choice-item";

    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "choice";
    // value は「元の選択肢インデックス」を保持し、採点の整合を保つ
    input.value = String(originalIndex);

    const text = document.createElement("span");
    text.textContent = `${String.fromCharCode(65 + renderedIndex)}. ${choice}`;

    label.appendChild(input);
    label.appendChild(text);
    item.appendChild(label);
    choicesForm.appendChild(item);
  });

  resultEl.className = "result hidden";
  resultEl.textContent = "";
  explanationEl.classList.add("hidden");
  explanationEl.textContent = "";
  choiceTranslationsEl.classList.add("hidden");
  choiceTranslationsEl.innerHTML = "";

  const log = getProblemWrongLog(p.problem_id);
  if (log.wrong_count > 0) {
    const remain = Math.max(RECOVERY_CORRECT_TARGET - log.recovery_correct_streak, 0);
    wrongLogInfoEl.classList.remove("hidden");
    wrongLogInfoEl.textContent =
      `この問題の誤答履歴: ${log.wrong_count}回 / 最終誤答: ${formatDateTime(log.last_wrong_at)} / 解除まであと${remain}回正解`;
  } else {
    wrongLogInfoEl.classList.add("hidden");
    wrongLogInfoEl.textContent = "";
  }

  nextBtn.classList.add("hidden");
  submitBtn.disabled = false;
}

function submitAnswer() {
  if (answered) return;

  const p = sessionProblems[currentIndex];
  const checked = choicesForm.querySelector("input[name='choice']:checked");

  if (!checked) {
    statusEl.textContent = "選択肢を1つ選んでください。";
    return;
  }

  const selected = Number(checked.value);
  const isCorrect = selected === p.answer;
  answered = true;

  if (isCorrect) {
    correctCount += 1;

    if (wrongStock.has(p.problem_id)) {
      const recovery = recordCorrectForRecovery(p.problem_id);
      updateWrongStockInfo();
      wrongLogInfoEl.classList.remove("hidden");
      if (recovery.removed) {
        wrongLogInfoEl.textContent = "この問題は3回連続正解したため、誤答ストックから削除されました。";
      } else {
        wrongLogInfoEl.textContent = `誤答ストック解除まであと${recovery.remain}回正解です。`;
      }
    }
  } else {
    const log = recordWrongLog(p.problem_id);
    wrongStock.add(p.problem_id);
    saveWrongStock();
    updateWrongStockInfo();
    wrongLogInfoEl.classList.remove("hidden");
    wrongLogInfoEl.textContent =
      `この問題の誤答履歴: ${log.wrong_count}回 / 最終誤答: ${formatDateTime(log.last_wrong_at)} / 解除まであと${RECOVERY_CORRECT_TARGET}回正解`;
  }

  scoreEl.textContent = `正答: ${correctCount}`;
  resultEl.classList.remove("hidden");
  resultEl.classList.add(isCorrect ? "ok" : "ng");
  const correctDisplayIndex = currentChoiceOrder.indexOf(p.answer);
  const correctLetter = String.fromCharCode(65 + (correctDisplayIndex >= 0 ? correctDisplayIndex : p.answer));
  resultEl.textContent = isCorrect
    ? "正解です。"
    : `不正解です。正解は ${correctLetter} です。誤答ストックに追加しました。`;

  explanationEl.classList.remove("hidden");
  explanationEl.textContent = `解説: ${p.explanation_ja}`;
  renderChoiceTranslations(p);

  submitBtn.disabled = true;
  nextBtn.classList.remove("hidden");
}

function nextProblem() {
  if (currentIndex < sessionProblems.length - 1) {
    currentIndex += 1;
    renderCurrentProblem();
    return;
  }

  questionTextEl.textContent = "終了です。お疲れさまでした。";
  choicesForm.innerHTML = "";
  resultEl.className = "result";
  resultEl.textContent = `最終スコア: ${correctCount} / ${sessionProblems.length}`;
  explanationEl.classList.add("hidden");
  choiceTranslationsEl.classList.add("hidden");
  choiceTranslationsEl.innerHTML = "";
  wrongLogInfoEl.classList.add("hidden");
  submitBtn.disabled = true;
  nextBtn.classList.add("hidden");
  statusEl.textContent = "別のレベルで再開できます。";
}

function clearWrongStock() {
  wrongStock.clear();
  saveWrongStock();
  wrongLogs = {};
  saveWrongLogs();
  updateWrongStockInfo();
  wrongLogInfoEl.classList.add("hidden");
  wrongLogInfoEl.textContent = "";
  statusEl.textContent = "誤答ストックと誤答ログを削除しました。";
}

function exportWrongHistory() {
  const payload = {
    exported_at: new Date().toISOString(),
    app_version: "v1-localstorage-export",
    wrong_problem_ids: [...wrongStock],
    wrong_logs: wrongLogs
  };

  const hasAnyData = payload.wrong_problem_ids.length > 0 || Object.keys(payload.wrong_logs).length > 0;
  if (!hasAnyData) {
    statusEl.textContent = "エクスポート対象の誤答履歴がありません。";
    return;
  }

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:]/g, "-");
  a.href = url;
  a.download = `wrong-history-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  statusEl.textContent = "誤答履歴をJSONでエクスポートしました。";
}

startBtn.addEventListener("click", startSession);
submitBtn.addEventListener("click", submitAnswer);
nextBtn.addEventListener("click", nextProblem);
clearWrongBtn.addEventListener("click", clearWrongStock);
exportWrongBtn.addEventListener("click", exportWrongHistory);
levelSelect.addEventListener("change", updateWrongStockInfo);

loadProblems();
