const DATA_PATH = "./data/problems/initial_problems.json";
const WRONG_STOCK_KEY = "cefr_wrong_problem_ids_v1";
const WRONG_LOG_KEY = "cefr_wrong_logs_v1";
const ANSWER_HISTORY_KEY = "cefr_answer_history_v1";
const RECOVERY_CORRECT_TARGET = 3;

const levelSelect = document.getElementById("levelSelect");
const modeSelect = document.getElementById("modeSelect");
const startBtn = document.getElementById("startBtn");
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
const reasonInputEl = document.getElementById("reasonInput");

let allProblems = [];
let sessionProblems = [];
let currentIndex = 0;
let correctCount = 0;
let answered = false;
let currentChoiceOrder = [];
let wrongStock = new Set();
let wrongLogs = {};
let answerHistory = [];

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
function loadAnswerHistory() {
  try {
    const raw = localStorage.getItem(ANSWER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error(err);
    return [];
  }
}
function saveAnswerHistory() {
  localStorage.setItem(ANSWER_HISTORY_KEY, JSON.stringify(answerHistory));
}
function appendAnswerHistory(entry) {
  answerHistory.push(entry);
  saveAnswerHistory();
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
    answerHistory = loadAnswerHistory();
    statusEl.textContent = `読込完了: ${allProblems.length}問`;
    updateWrongStockInfo();
  } catch (err) {
    statusEl.textContent = "読み込みに失敗しました。ローカルサーバーで開いてください。";
    startBtn.disabled = true;
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

const DIRECT_TRANSLATIONS = new Map([
  ["I am fine, thank you.", "元気です、ありがとうございます。"],
  ["My name is Ken.", "私の名前はケンです。"],
  ["Yes, I do.", "はい、そうです。"],
  ["I live in Osaka.", "私は大阪に住んでいます。"],
  ["Sure, I'll help after lunch.", "もちろん、昼食後に手伝います。"],
  ["For about three years.", "約3年間です。"],
  ["Because the bus was delayed.", "バスが遅れたからです。"],
  ["Yes, unless everyone can join on time.", "はい、全員が時間どおり参加できないなら延期すべきです。"],
  ["It went well after I adjusted the slides.", "スライドを調整した後、うまくいきました。"],
  ["It matched the skills I needed for work.", "仕事で必要なスキルに合っていました。"],
  ["I can, provided I get the final data today.", "今日中に最終データをもらえればできます。"],
  ["The one with fewer support requests.", "サポート依頼が少ない方です。"],
  ["A vendor delivered materials late.", "仕入れ先が資材を遅れて納品しました。"],
  ["Prioritizing chats before emails.", "メールより先にチャット対応を優先することです。"],
  ["To help new members understand decisions.", "新メンバーが決定内容を理解しやすくするためです。"],
  ["They needed to confirm inventory.", "在庫を確認する必要があったからです。"],
  ["The headline with the highest click-through rate.", "クリック率が最も高い見出しです。"],
  ["He grouped them by theme.", "彼はそれらをテーマ別に分類しました。"],
  ["To prevent repeated mistakes.", "同じミスを繰り返さないためです。"],
  ["Reports were monitored for three days.", "修正後、レポートを3日間監視しました。"],
  ["To make it easier for junior staff to ask questions.", "若手社員が質問しやすくするためです。"],
  ["The form was shortened and clarified.", "フォームを短くし、質問を明確にしました。"],
  ["Why a higher-priced supplier was more reliable.", "なぜ高価格の仕入れ先の方が信頼できるかです。"],
  ["To detect delays early.", "遅延を早期に発見するためです。"],
  ["So remote members could review the workflow.", "リモートメンバーが作業手順を確認できるようにするためです。"],
  ["Fewer handover errors and faster onboarding.", "引き継ぎミスが減り、立ち上がりが速くなったことです。"],
  ["Focusing on blockers first.", "障害要因を先に扱うことです。"],
  ["To prepare for server failure during peak hours.", "ピーク時間のサーバー障害に備えるためです。"],
  ["Sample answers to common questions.", "よくある質問への回答例です。"],
  ["Risks and mitigation steps were confirmed.", "リスクと対策手順が確認されたからです。"],
  ["The one launched first.", "最初に公開された方です。"],
  ["The one with lower price.", "価格が低い方です。"],
  ["The one with more screens.", "画面数が多い方です。"],
  ["The first headline written.", "最初に作成した見出しです。"],
  ["The least formal headline.", "最もくだけた見出しです。"],
  ["The longest headline.", "最も長い見出しです。"],
  ["No measurable change at all.", "測定できる変化はまったくありませんでした。"],
  ["No risks were discussed.", "リスクはまったく議論されませんでした。"],
  ["No, I don't.", "いいえ、違います。"],
  ["At five o'clock.", "5時に。"],
  ["At nine o'clock exactly.", "ちょうど9時に。"],
  ["At room 204.", "204号室で。"],
  ["At the library.", "図書館で。"],
  ["At the office door.", "オフィスの入口で。"],
  ["At the station.", "駅で。"],
  ["At the third floor.", "3階で。"],
  ["In my bag.", "私のかばんの中です。"],
  ["In the classroom.", "教室で。"],
  ["In the same folder.", "同じフォルダ内で。"],
  ["Because I was tired.", "疲れていたからです。"],
  ["Because it is big.", "それが大きいからです。"],
  ["Because the budget doubled.", "予算が倍になったからです。"],
  ["Because the client requested changes.", "顧客が修正を求めたからです。"],
  ["Because the meeting was canceled.", "会議が中止されたからです。"],
  ["Because the printer broke.", "プリンターが壊れたからです。"],
  ["Friday is my favorite.", "金曜日がいちばん好きです。"],
  ["I am happy.", "私はうれしいです。"],
  ["I am ten years old.", "私は10歳です。"],
  ["I can, provided I get the final data today.", "今日最終データを受け取れれば可能です。"],
  ["I have a pen.", "私はペンを持っています。"],
  ["I like music.", "私は音楽が好きです。"],
  ["I met him yesterday.", "私は昨日彼に会いました。"],
  ["I postponed it last year.", "私はそれを昨年延期しました。"],
  ["I present every Tuesday.", "私は毎週火曜日に発表します。"],
  ["I will be a teacher.", "私は先生になります。"],
  ["It is Monday.", "今日は月曜日です。"],
  ["It is sunny.", "晴れています。"],
  ["It is the biggest one.", "それがいちばん大きいものです。"],
  ["The meeting is a table.", "会議はテーブルです。"],
  ["The projector is expensive.", "そのプロジェクターは高価です。"],
  ["This report is blue.", "このレポートは青いです。"],
  ["Three books.", "3冊の本。"],
  ["Two apples.", "2個のりんご。"],
  ["Yes, I studied.", "はい、勉強しました。"],
  ["Yes, I can meet at three.", "はい、3時に会えます。"],
  ["A list of canceled products.", "中止された製品の一覧。"],
  ["A new pricing contract.", "新しい価格契約。"],
  ["The app was redesigned.", "アプリは再設計されました。"],
  ["The audience was narrowed to managers only.", "対象は管理職のみに絞られました。"],
  ["The budget was increased.", "予算が増額されました。"],
  ["The course chose me.", "そのコースが私を選びました。"],
  ["The deadline was removed entirely.", "締切は完全に撤廃されました。"],
  ["The deadline was removed.", "締切が撤廃されました。"],
  ["The document was the shortest.", "その文書が最も短かったです。"],
  ["The office was closed for holidays.", "オフィスは休暇で閉鎖されていました。"],
  ["The project took more time than we had expected.", "そのプロジェクトは予想より時間がかかりました。"],
  ["The survey was translated into five languages.", "アンケートは5言語に翻訳されました。"],
  ["The team finished too early.", "チームは早く終わりすぎました。"],
  ["They changed office locations.", "彼らはオフィスの場所を変更しました。"],
  ["They hired fewer staff.", "彼らは採用人数を減らしました。"],
  ["They lost internet access.", "彼らはインターネット接続を失いました。"],
  ["User accounts were reset.", "ユーザーアカウントがリセットされました。"],
  ["Closing the help center.", "ヘルプセンターを閉鎖すること。"],
  ["Inviting external speakers.", "外部スピーカーを招くこと。"],
  ["Sending fewer replies.", "返信数を減らすこと。"],
  ["Shortening the budget report.", "予算レポートを短くすること。"],
  ["So customers could edit the script.", "顧客がスクリプトを編集できるようにするため。"],
  ["So meetings could be canceled forever.", "会議を永続的に廃止できるようにするため。"],
  ["So the product could launch immediately.", "製品をすぐに公開できるようにするため。"],
  ["To avoid customer interviews.", "顧客インタビューを避けるため。"],
  ["To avoid data backups.", "データバックアップを避けるため。"],
  ["To cancel one-on-one meetings.", "1対1の会議を中止するため。"],
  ["To evaluate only senior staff.", "上級スタッフだけを評価するため。"],
  ["To increase meeting length.", "会議時間を長くするため。"],
  ["To increase overtime hours.", "残業時間を増やすため。"],
  ["To lower internet speed intentionally.", "意図的に通信速度を下げるため。"],
  ["To reduce product features.", "製品機能を減らすため。"],
  ["To reduce team communication.", "チーム内コミュニケーションを減らすため。"],
  ["To reduce testing scope.", "テスト範囲を縮小するため。"],
  ["To reduce training materials.", "研修資料を減らすため。"],
  ["To replace all meetings.", "すべての会議を置き換えるため。"],
  ["To shorten lunch breaks.", "昼休みを短くするため。"],
  ["To skip weekly planning.", "週次計画を省略するため。"],
  ["To stop monitoring system health.", "システム監視を停止するため。"],
  ["visit her grandmother", "祖母を訪ねること"],
  ["take a piano lesson", "ピアノのレッスンを受けること"],
  ["play tennis", "テニスをすること"],
  ["study at the cafe", "カフェで勉強すること"],
  ["help at home", "家の手伝いをすること"],
  ["goes camping", "キャンプに行く"],
  ["takes a flight", "飛行機で移動する"],
  ["watches a movie at noon", "正午に映画を見る"],
  ["park", "公園"],
  ["library", "図書館"],
  ["school", "学校"],
  ["store", "店"],
  ["station", "駅"],
  ["hospital", "病院"],
  ["bank", "銀行"],
  ["museum", "博物館"],
  ["am", "am（be動詞）"],
  ["is", "is（be動詞）"],
  ["are", "are（be動詞）"],
  ["be", "be（動詞原形）"],
  ["have", "have"],
  ["has", "has"],
  ["had", "had"],
  ["having", "having"],
  ["go", "行く"],
  ["goes", "行く（三単現）"],
  ["went", "行った（過去形）"],
  ["going", "行っている/行くこと"],
  ["stay", "とどまる"],
  ["stayed", "とどまった"],
  ["staying", "とどまっている"],
  ["watch", "見る"],
  ["watches", "見る（三単現）"],
  ["watched", "見た"],
  ["watching", "見ている"],
  ["read", "読む"],
  ["reads", "読む（三単現）"],
  ["reading", "読んでいる/読むこと"],
  ["readed", "readed（誤り形）"],
  ["play", "する/遊ぶ"],
  ["plays", "する（三単現）"],
  ["played", "した"],
  ["playing", "している/すること"],
  ["study", "勉強する"],
  ["studys", "studys（誤り形）"],
  ["studying", "勉強している"],
  ["studyed", "studyed（誤り形）"],
  ["cook", "料理する"],
  ["cooks", "料理する（三単現）"],
  ["cooked", "料理した"],
  ["cooking", "料理している"],
  ["completed", "完了した"],
  ["was", "was（be動詞過去）"],
  ["was completed", "完了された"],
  ["is complete", "完了している"],
  ["has completing", "has completing（不自然）"],
  ["interesting", "おもしろい"],
  ["more interesting", "よりおもしろい"],
  ["most interesting", "最もおもしろい"],
  ["interest", "興味"]
]);

const WORD_TRANSLATIONS = new Map([
  ["the", "その"], ["a", "1つの"], ["an", "1つの"],
  ["i", "私は"], ["you", "あなたは"], ["he", "彼は"], ["she", "彼女は"], ["we", "私たちは"], ["they", "彼らは"], ["it", "それは"],
  ["my", "私の"], ["your", "あなたの"], ["his", "彼の"], ["her", "彼女の"], ["their", "彼らの"], ["our", "私たちの"],
  ["because", "なぜなら"], ["after", "〜の後で"], ["before", "〜の前に"], ["during", "〜の間に"], ["unless", "〜でない限り"],
  ["if", "もし"], ["provided", "〜という条件で"], ["for", "〜のために"], ["at", "〜で"], ["in", "〜で"], ["on", "〜に"], ["to", "〜へ/〜するため"],
  ["and", "そして"], ["or", "または"], ["but", "しかし"], ["so", "だから"],
  ["team", "チーム"], ["meeting", "会議"], ["report", "レポート"], ["proposal", "提案書"], ["client", "顧客"], ["project", "プロジェクト"],
  ["goal", "目標"], ["results", "結果"], ["data", "データ"], ["work", "仕事"], ["office", "オフィス"], ["survey", "調査"],
  ["questions", "質問"], ["question", "質問"], ["answer", "答え"], ["answers", "答え"], ["risk", "リスク"], ["risks", "リスク"],
  ["wrong", "誤り"], ["count", "回数"], ["level", "レベル"], ["type", "タイプ"],
  ["more", "より"], ["most", "最も"], ["fewer", "より少ない"], ["higher", "より高い"], ["lower", "より低い"],
  ["time", "時間"], ["today", "今日"], ["yesterday", "昨日"], ["every", "毎"], ["day", "日"], ["week", "週"], ["years", "年"],
  ["english", "英語"], ["soccer", "サッカー"], ["library", "図書館"], ["station", "駅"], ["school", "学校"], ["store", "店"],
  ["park", "公園"], ["bank", "銀行"], ["museum", "博物館"], ["hospital", "病院"],
  ["happy", "うれしい"], ["fine", "元気な"], ["name", "名前"], ["sunny", "晴れた"], ["blue", "青い"],
  ["yes", "はい"], ["no", "いいえ"], ["well", "うまく"], ["exactly", "ちょうど"], ["only", "だけ"], ["all", "すべて"],
  ["can", "できる"], ["will", "〜するつもり"], ["would", "〜するだろう"], ["could", "〜できるだろう"], ["should", "〜すべき"],
  ["finished", "終えた"], ["reading", "読むこと"], ["lived", "住んでいる"], ["matched", "一致した"], ["needed", "必要だった"],
  ["adjusted", "調整した"], ["delayed", "遅れた"], ["canceled", "中止された"], ["shortened", "短くした"], ["clarified", "明確にした"],
  ["confirmed", "確認した"], ["monitored", "監視した"], ["launched", "公開した"], ["chose", "選んだ"], ["reviewed", "見直した"]
]);

function translateEnglishChoiceToJa(text) {
  const raw = String(text).trim();
  if (DIRECT_TRANSLATIONS.has(raw)) return DIRECT_TRANSLATIONS.get(raw);

  let t = raw;
  const phraseRules = [
    [/^Read:\s*/i, "本文: "],
    [/What is their next goal\?/i, "彼らの次の目標は何ですか。"],
    [/Why did they postpone it\?/i, "なぜそれを延期したのですか。"],
    [/How did your presentation go\?/i, "あなたの発表はどうでしたか。"],
    [/Why did you choose that course\?/i, "なぜそのコースを選んだのですか。"],
    [/Can you finish the draft by Friday\?/i, "金曜日までに下書きを終えられますか。"],
    [/How are you\?/i, "お元気ですか。"],
    [/What is your name\?/i, "名前は何ですか。"],
    [/Do you like cats\?/i, "猫は好きですか。"],
    [/Where do you live\?/i, "どこに住んでいますか。"],
    [/A:\s*/g, "A: "],
    [/B:\s*/g, "B: "]
  ];
  phraseRules.forEach(([re, rep]) => {
    t = t.replace(re, rep);
  });

  const parts = t.match(/[A-Za-z']+|[^A-Za-z']+/g) || [t];
  let translatedWordCount = 0;
  const out = parts.map((part) => {
    if (!/[A-Za-z]/.test(part)) return part;
    const lower = part.toLowerCase();
    if (WORD_TRANSLATIONS.has(lower)) {
      translatedWordCount += 1;
      return WORD_TRANSLATIONS.get(lower);
    }
    return part;
  }).join("");

  if (translatedWordCount === 0) {
    return `（訳未整備）${raw}`;
  }
  return `（参考訳）${out}`;
}

function renderChoiceTranslations(problem) {
  const hasStoredTranslations =
    Array.isArray(problem.choices_ja) &&
    problem.choices_ja.length === problem.choices.length &&
    problem.choices_ja.every((t) => typeof t === "string" && t.trim() !== "");

  if (hasStoredTranslations) {
    const rows = currentChoiceOrder.map((originalIndex, renderedIndex) => {
      const letter = String.fromCharCode(65 + renderedIndex);
      const ja = String(problem.choices_ja[originalIndex]);
      return `<li><strong>${letter}.</strong> ${ja}</li>`;
    });
    choiceTranslationsEl.innerHTML = `<p>選択肢の日本語訳</p><ul>${rows.join("")}</ul>`;
    choiceTranslationsEl.classList.remove("hidden");
    return;
  }

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
  if (reasonInputEl) {
    reasonInputEl.value = "";
  }

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
  const selectedDisplayIndex = currentChoiceOrder.indexOf(selected);
  const selectedLetter = String.fromCharCode(65 + (selectedDisplayIndex >= 0 ? selectedDisplayIndex : selected));
  const reasonText = reasonInputEl ? reasonInputEl.value.trim().slice(0, 120) : "";
  const answeredAt = new Date().toISOString();
  appendAnswerHistory({
    problem_id: p.problem_id,
    answered_at: answeredAt,
    cefr_level: p.cefr_level,
    question_type: p.question_type,
    mode: modeSelect.value,
    selected_choice_index: selected,
    selected_choice_label: selectedLetter,
    is_correct: isCorrect,
    reason_text: reasonText
  });
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
  if (reasonInputEl) {
    reasonInputEl.value = "";
  }
  wrongLogInfoEl.classList.add("hidden");
  submitBtn.disabled = true;
  nextBtn.classList.add("hidden");
  statusEl.textContent = "別のレベルで再開できます。";
}

function exportWrongHistory() {
  const payload = {
    exported_at: new Date().toISOString(),
    app_version: "v2-reason-and-answer-history",
    wrong_problem_ids: [...wrongStock],
    wrong_logs: wrongLogs,
    answer_history: answerHistory
  };

  const hasAnyData =
    payload.wrong_problem_ids.length > 0 ||
    Object.keys(payload.wrong_logs).length > 0 ||
    payload.answer_history.length > 0;
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
exportWrongBtn.addEventListener("click", exportWrongHistory);
levelSelect.addEventListener("change", updateWrongStockInfo);

loadProblems();

