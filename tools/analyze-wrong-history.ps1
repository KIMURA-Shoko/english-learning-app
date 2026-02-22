param(
  [string]$WrongHistoryPath,
  [string]$ProblemPath = "E:\project\english-learning-app\data\problems\initial_problems.json",
  [string]$OutputPath = "E:\project\english-learning-app\reports\weakness-report.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $WrongHistoryPath) {
  Write-Error "Please provide -WrongHistoryPath (exported wrong-history JSON file)."
  exit 1
}

if (-not (Test-Path $WrongHistoryPath)) {
  Write-Error "Wrong history file not found: $WrongHistoryPath"
  exit 1
}

if (-not (Test-Path $ProblemPath)) {
  Write-Error "Problem file not found: $ProblemPath"
  exit 1
}

$wrongRaw = Get-Content -Raw -Encoding UTF8 $WrongHistoryPath
$wrongObj = $wrongRaw | ConvertFrom-Json

$problemsRaw = Get-Content -Raw -Encoding UTF8 $ProblemPath
$problems = $problemsRaw | ConvertFrom-Json

$problemMap = @{}
foreach ($p in $problems) {
  $problemMap[[string]$p.problem_id] = $p
}

$wrongLogs = @{}
if ($wrongObj -and $wrongObj.PSObject.Properties.Name -contains "wrong_logs") {
  $wrongLogs = $wrongObj.wrong_logs
}

$entries = New-Object System.Collections.Generic.List[object]
foreach ($prop in $wrongLogs.PSObject.Properties) {
  $pid = [string]$prop.Name
  $log = $prop.Value
  $count = if ($null -ne $log.wrong_count) { [int]$log.wrong_count } else { 0 }
  if ($count -le 0) { continue }

  $problem = $null
  if ($problemMap.ContainsKey($pid)) { $problem = $problemMap[$pid] }

  $level = if ($problem) { [string]$problem.cefr_level } else { "UNKNOWN" }
  $qtype = if ($problem -and $problem.PSObject.Properties.Name -contains "question_type") { [string]$problem.question_type } else { "UNKNOWN" }
  $skill = if ($problem) { [string]$problem.skill_type } else { "UNKNOWN" }
  $lastWrong = if ($log.PSObject.Properties.Name -contains "last_wrong_at") { [string]$log.last_wrong_at } else { "" }

  $entries.Add([pscustomobject]@{
    problem_id = $pid
    wrong_count = $count
    last_wrong_at = $lastWrong
    cefr_level = $level
    question_type = $qtype
    skill_type = $skill
    question_text = if ($problem) { [string]$problem.question_text } else { "(problem not found in current dataset)" }
  }) | Out-Null
}

$totalWrongCount = ($entries | Measure-Object -Property wrong_count -Sum).Sum
if ($null -eq $totalWrongCount) { $totalWrongCount = 0 }

$byLevel = $entries | Group-Object cefr_level | Sort-Object Name
$byType = $entries | Group-Object question_type | Sort-Object Name
$bySkill = $entries | Group-Object skill_type | Sort-Object Name
$topProblems = $entries | Sort-Object wrong_count -Descending | Select-Object -First 15
$recentWrong = $entries | Where-Object { $_.last_wrong_at } | Sort-Object last_wrong_at -Descending | Select-Object -First 10

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Weakness Report") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Generated at: $(Get-Date -Format \"yyyy-MM-dd HH:mm:ss\")") | Out-Null
$lines.Add("- Source wrong history: $WrongHistoryPath") | Out-Null
$lines.Add("- Total wrong problems: $($entries.Count)") | Out-Null
$lines.Add("- Total wrong count (sum): $totalWrongCount") | Out-Null
$lines.Add("") | Out-Null

$lines.Add("## By CEFR Level") | Out-Null
foreach ($g in $byLevel) {
  $sum = ($g.Group | Measure-Object -Property wrong_count -Sum).Sum
  $lines.Add("- $($g.Name): 問題数=$($g.Count), 誤答回数合計=$sum") | Out-Null
}
$lines.Add("") | Out-Null

$lines.Add("## By Question Type") | Out-Null
foreach ($g in $byType) {
  $sum = ($g.Group | Measure-Object -Property wrong_count -Sum).Sum
  $lines.Add("- $($g.Name): 問題数=$($g.Count), 誤答回数合計=$sum") | Out-Null
}
$lines.Add("") | Out-Null

$lines.Add("## By Skill Type") | Out-Null
foreach ($g in $bySkill) {
  $sum = ($g.Group | Measure-Object -Property wrong_count -Sum).Sum
  $lines.Add("- $($g.Name): 問題数=$($g.Count), 誤答回数合計=$sum") | Out-Null
}
$lines.Add("") | Out-Null

$lines.Add("## Top Mistakes") | Out-Null
if ($topProblems.Count -eq 0) {
  $lines.Add("- No wrong logs found.") | Out-Null
} else {
  foreach ($e in $topProblems) {
    $lines.Add("- $($e.problem_id) | count=$($e.wrong_count) | level=$($e.cefr_level) | type=$($e.question_type)") | Out-Null
    $lines.Add("  - $($e.question_text)") | Out-Null
  }
}
$lines.Add("") | Out-Null

$lines.Add("## Recent Wrong (Last 10)") | Out-Null
if ($recentWrong.Count -eq 0) {
  $lines.Add("- No recent wrong data.") | Out-Null
} else {
  foreach ($e in $recentWrong) {
    $lines.Add("- $($e.last_wrong_at) | $($e.problem_id) | count=$($e.wrong_count)") | Out-Null
  }
}

$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$lines -join "`r`n" | Set-Content -Encoding UTF8 $OutputPath
Write-Host "Report written:" $OutputPath
