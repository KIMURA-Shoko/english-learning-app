param(
  [string]$AnswerHistoryPath,
  [string]$ProblemPath = "E:\project\english-learning-app\data\problems\initial_problems.json",
  [string]$OutputPath = "E:\project\english-learning-app\reports\answer-analysis-report.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $AnswerHistoryPath) {
  Write-Error "Please provide -AnswerHistoryPath (exported answer-history JSON file)."
  exit 1
}

if (-not (Test-Path $AnswerHistoryPath)) {
  Write-Error "Answer history file not found: $AnswerHistoryPath"
  exit 1
}

if (-not (Test-Path $ProblemPath)) {
  Write-Error "Problem file not found: $ProblemPath"
  exit 1
}

function Read-JsonRobust {
  param([string]$Path)

  $raw = Get-Content -Raw -Encoding UTF8 $Path
  try {
    return ($raw | ConvertFrom-Json -ErrorAction Stop)
  } catch {
    $sanitized = [regex]::Replace($raw, "[\x00-\x08\x0B\x0C\x0E-\x1F]", " ")
    try {
      return ($sanitized | ConvertFrom-Json -ErrorAction Stop)
    } catch {
      throw "JSON parse failed for $Path. Please re-export from app and upload again."
    }
  }
}

$historyObj = Read-JsonRobust -Path $AnswerHistoryPath
$problems = Read-JsonRobust -Path $ProblemPath

$problemMap = @{}
foreach ($p in $problems) {
  $problemMap[[string]$p.problem_id] = $p
}

$answers = New-Object System.Collections.Generic.List[object]

if ($historyObj -and $historyObj.PSObject.Properties.Name -contains "answer_history" -and ($historyObj.answer_history -is [System.Array])) {
  foreach ($a in $historyObj.answer_history) {
    if (-not $a) { continue }
    $answers.Add($a) | Out-Null
  }
}

# Backward compatibility: if no answer_history, synthesize entries from wrong_logs.
if ($answers.Count -eq 0 -and $historyObj -and $historyObj.PSObject.Properties.Name -contains "wrong_logs") {
  foreach ($prop in $historyObj.wrong_logs.PSObject.Properties) {
    $problemId = [string]$prop.Name
    $log = $prop.Value
    $count = if ($null -ne $log.wrong_count) { [int]$log.wrong_count } else { 0 }
    for ($i = 0; $i -lt $count; $i++) {
      $answers.Add([pscustomobject]@{
        problem_id = $problemId
        answered_at = if ($log.last_wrong_at) { [string]$log.last_wrong_at } else { "" }
        mode = "unknown"
        is_correct = $false
      }) | Out-Null
    }
  }
}

$rows = New-Object System.Collections.Generic.List[object]
foreach ($a in $answers) {
  $problemId = if ($a.PSObject.Properties.Name -contains "problem_id") { [string]$a.problem_id } else { "UNKNOWN" }
  $problem = $null
  if ($problemMap.ContainsKey($problemId)) { $problem = $problemMap[$problemId] }

  $level = if ($problem) { [string]$problem.cefr_level } else { "UNKNOWN" }
  $qtype = if ($problem -and $problem.PSObject.Properties.Name -contains "question_type") { [string]$problem.question_type } else { "UNKNOWN" }
  $skill = if ($problem) { [string]$problem.skill_type } else { "UNKNOWN" }
  $isCorrect = $false
  if ($a.PSObject.Properties.Name -contains "is_correct") {
    $isCorrect = [bool]$a.is_correct
  }

  $rows.Add([pscustomobject]@{
    problem_id = $problemId
    answered_at = if ($a.PSObject.Properties.Name -contains "answered_at") { [string]$a.answered_at } else { "" }
    mode = if ($a.PSObject.Properties.Name -contains "mode") { [string]$a.mode } else { "unknown" }
    is_correct = $isCorrect
    cefr_level = $level
    question_type = $qtype
    skill_type = $skill
    question_text = if ($problem) { [string]$problem.question_text } else { "(problem not found in current dataset)" }
  }) | Out-Null
}

$totalAnswers = $rows.Count
$correctAnswers = @($rows | Where-Object { $_.is_correct }).Count
$wrongAnswers = $totalAnswers - $correctAnswers
$accuracy = if ($totalAnswers -gt 0) { [math]::Round((100.0 * $correctAnswers / $totalAnswers), 1) } else { 0.0 }

function Group-AnswerStats {
  param([object[]]$Items, [string]$Key)

  $groups = @($Items | Group-Object $Key | Sort-Object Name)
  $result = New-Object System.Collections.Generic.List[object]
  foreach ($g in $groups) {
    $attempts = $g.Count
    $correct = @($g.Group | Where-Object { $_.is_correct }).Count
    $wrong = $attempts - $correct
    $acc = if ($attempts -gt 0) { [math]::Round((100.0 * $correct / $attempts), 1) } else { 0.0 }
    $result.Add([pscustomobject]@{
      name = [string]$g.Name
      attempts = $attempts
      correct = $correct
      wrong = $wrong
      accuracy = $acc
    }) | Out-Null
  }
  return $result
}

$byLevel = Group-AnswerStats -Items $rows -Key "cefr_level"
$byType = Group-AnswerStats -Items $rows -Key "question_type"
$bySkill = Group-AnswerStats -Items $rows -Key "skill_type"
$byMode = Group-AnswerStats -Items $rows -Key "mode"

$problemStats = @($rows | Group-Object problem_id | ForEach-Object {
  $attempts = $_.Count
  $correct = @($_.Group | Where-Object { $_.is_correct }).Count
  $wrong = $attempts - $correct
  $acc = if ($attempts -gt 0) { [math]::Round((100.0 * $correct / $attempts), 1) } else { 0.0 }
  [pscustomobject]@{
    problem_id = [string]$_.Name
    attempts = $attempts
    correct = $correct
    wrong = $wrong
    accuracy = $acc
    question_text = [string]$_.Group[0].question_text
    cefr_level = [string]$_.Group[0].cefr_level
    question_type = [string]$_.Group[0].question_type
  }
})

$focusProblems = @($problemStats | Sort-Object @{Expression='accuracy';Descending=$false}, @{Expression='attempts';Descending=$true} | Select-Object -First 15)
$recentAnswers = @($rows | Where-Object { $_.answered_at } | Sort-Object answered_at -Descending | Select-Object -First 20)

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Answer Analysis Report") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") | Out-Null
$lines.Add("- Source answer history: $AnswerHistoryPath") | Out-Null
$lines.Add("- Total answers: $totalAnswers") | Out-Null
$lines.Add("- Correct: $correctAnswers") | Out-Null
$lines.Add("- Wrong: $wrongAnswers") | Out-Null
$lines.Add("- Accuracy: $accuracy%") | Out-Null
$lines.Add("") | Out-Null

$lines.Add("## By CEFR Level") | Out-Null
foreach ($r in $byLevel) { $lines.Add("- $($r.name): attempts=$($r.attempts), correct=$($r.correct), wrong=$($r.wrong), accuracy=$($r.accuracy)%") | Out-Null }
$lines.Add("") | Out-Null

$lines.Add("## By Question Type") | Out-Null
foreach ($r in $byType) { $lines.Add("- $($r.name): attempts=$($r.attempts), correct=$($r.correct), wrong=$($r.wrong), accuracy=$($r.accuracy)%") | Out-Null }
$lines.Add("") | Out-Null

$lines.Add("## By Skill Type") | Out-Null
foreach ($r in $bySkill) { $lines.Add("- $($r.name): attempts=$($r.attempts), correct=$($r.correct), wrong=$($r.wrong), accuracy=$($r.accuracy)%") | Out-Null }
$lines.Add("") | Out-Null

$lines.Add("## By Mode") | Out-Null
foreach ($r in $byMode) { $lines.Add("- $($r.name): attempts=$($r.attempts), correct=$($r.correct), wrong=$($r.wrong), accuracy=$($r.accuracy)%") | Out-Null }
$lines.Add("") | Out-Null

$lines.Add("## Focus Problems (Low Accuracy First)") | Out-Null
if ($focusProblems.Count -eq 0) {
  $lines.Add("- No answer data found.") | Out-Null
} else {
  foreach ($p in $focusProblems) {
    $lines.Add("- $($p.problem_id) | level=$($p.cefr_level) | type=$($p.question_type) | attempts=$($p.attempts) | accuracy=$($p.accuracy)%") | Out-Null
    $lines.Add("  - $($p.question_text)") | Out-Null
  }
}
$lines.Add("") | Out-Null

$lines.Add("## Recent Answers (Last 20)") | Out-Null
if ($recentAnswers.Count -eq 0) {
  $lines.Add("- No recent answer data.") | Out-Null
} else {
  foreach ($r in $recentAnswers) {
    $mark = if ($r.is_correct) { "OK" } else { "NG" }
    $lines.Add("- $($r.answered_at) | $mark | $($r.problem_id) | mode=$($r.mode)") | Out-Null
  }
}

$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$lines -join "`r`n" | Set-Content -Encoding UTF8 $OutputPath
Write-Host "Report written:" $OutputPath
