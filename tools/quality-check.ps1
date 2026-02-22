param(
  [string]$InputPath,
  [double]$NearDuplicateThreshold = 0.9
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $InputPath) {
  $InputPath = Join-Path (Join-Path $PSScriptRoot "..") "data\problems\initial_problems.json"
}

if (-not (Test-Path $InputPath)) {
  Write-Error "Input file not found: $InputPath"
  exit 1
}

function Normalize-Text {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
  $t = $Text.ToLowerInvariant()
  $t = [regex]::Replace($t, "[^a-z0-9\s]", " ")
  $t = [regex]::Replace($t, "\s+", " ").Trim()
  return $t
}

function Get-TokenSet {
  param([string]$Text)
  $n = Normalize-Text $Text
  if (-not $n) { return @{} }
  $set = @{}
  foreach ($tok in $n.Split(" ")) {
    if ($tok.Length -gt 1) { $set[$tok] = $true }
  }
  return $set
}

function Get-JaccardSimilarity {
  param($A, $B)
  if ($A.Count -eq 0 -and $B.Count -eq 0) { return 1.0 }
  $intersection = 0
  foreach ($k in $A.Keys) {
    if ($B.ContainsKey($k)) { $intersection++ }
  }
  $union = $A.Count + $B.Count - $intersection
  if ($union -eq 0) { return 0.0 }
  return [double]$intersection / [double]$union
}

$jsonRaw = Get-Content -Raw -Encoding UTF8 $InputPath
$problems = $jsonRaw | ConvertFrom-Json

if (-not ($problems -is [System.Array])) {
  Write-Error "Top-level JSON must be an array."
  exit 1
}

$errors = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[object]

$required = @("problem_id","cefr_level","skill_type","question_text","choices","answer","explanation_ja","key_phrase","status","created_at")
$validLevel = @("A1","A2","B1")
$validSkill = @("grammar","reading","vocabulary")
$validStatus = @("draft","published")

$idMap = @{}
$qNormMap = @{}

for ($i = 0; $i -lt $problems.Count; $i++) {
  $p = $problems[$i]
  $problemId = if ($p.problem_id) { [string]$p.problem_id } else { "(index:$i)" }

  foreach ($field in $required) {
    if (-not ($p.PSObject.Properties.Name -contains $field)) {
      $errors.Add([pscustomobject]@{problem_id=$problemId; type="missing_field"; message="Required field missing: $field"})
    }
  }

  if ($idMap.ContainsKey($problemId)) {
    $errors.Add([pscustomobject]@{problem_id=$problemId; type="duplicate_id"; message="Duplicate problem_id"})
  } else {
    $idMap[$problemId] = $true
  }

  if ($p.cefr_level -and ($validLevel -notcontains [string]$p.cefr_level)) {
    $errors.Add([pscustomobject]@{problem_id=$problemId; type="invalid_level"; message="Invalid cefr_level: $($p.cefr_level)"})
  }

  if ($p.skill_type -and ($validSkill -notcontains [string]$p.skill_type)) {
    $errors.Add([pscustomobject]@{problem_id=$problemId; type="invalid_skill"; message="Invalid skill_type: $($p.skill_type)"})
  }

  if ($p.status -and ($validStatus -notcontains [string]$p.status)) {
    $errors.Add([pscustomobject]@{problem_id=$problemId; type="invalid_status"; message="Invalid status: $($p.status)"})
  }

  if ($p.problem_id -and $p.problem_id -notmatch '^(A1|A2|B1)_[GRV]_[0-9]{4}$') {
    $errors.Add([pscustomobject]@{problem_id=$problemId; type="invalid_id_pattern"; message="problem_id pattern mismatch"})
  }

  if ($p.problem_id -and $p.cefr_level) {
    $prefix = ($p.problem_id -split "_")[0]
    if ($prefix -ne [string]$p.cefr_level) {
      $errors.Add([pscustomobject]@{problem_id=$problemId; type="level_id_mismatch"; message="cefr_level and problem_id prefix mismatch"})
    }
  }

  if (-not ($p.choices -is [System.Array])) {
    $errors.Add([pscustomobject]@{problem_id=$problemId; type="invalid_choices"; message="choices must be array"})
  } else {
    if ($p.choices.Count -ne 4) {
      $errors.Add([pscustomobject]@{problem_id=$problemId; type="choices_count"; message="choices must contain exactly 4 items"})
    }

    $choiceSet = @{}
    foreach ($c in $p.choices) {
      $cText = [string]$c
      if ([string]::IsNullOrWhiteSpace($cText)) {
        $errors.Add([pscustomobject]@{problem_id=$problemId; type="empty_choice"; message="choice text is empty"})
      }
      if ($choiceSet.ContainsKey($cText.ToLowerInvariant())) {
        $errors.Add([pscustomobject]@{problem_id=$problemId; type="duplicate_choice"; message="choices contain duplicates"})
      } else {
        $choiceSet[$cText.ToLowerInvariant()] = $true
      }
    }

    if ($null -eq $p.answer -or ($p.answer -isnot [int] -and $p.answer -isnot [long])) {
      $errors.Add([pscustomobject]@{problem_id=$problemId; type="invalid_answer_type"; message="answer must be integer index"})
    } else {
      $ans = [int]$p.answer
      if ($ans -lt 0 -or $ans -ge $p.choices.Count) {
        $errors.Add([pscustomobject]@{problem_id=$problemId; type="answer_out_of_range"; message="answer index out of range"})
      } else {
        $correctChoice = [string]$p.choices[$ans]
        $exp = [string]$p.explanation_ja
        if ([string]::IsNullOrWhiteSpace($exp)) {
          $errors.Add([pscustomobject]@{problem_id=$problemId; type="empty_explanation"; message="explanation_ja is empty"})
        } else {
          $mentionsCorrect = $exp.ToLowerInvariant().Contains($correctChoice.ToLowerInvariant())
          if (-not $mentionsCorrect -and $exp -match "正解") {
            $warnings.Add([pscustomobject]@{problem_id=$problemId; type="answer_consistency_warn"; message="Explanation has '正解' but does not include correct choice text"})
          }
        }
      }
    }
  }

  if ($p.created_at) {
    try {
      [void][datetimeoffset]::Parse([string]$p.created_at)
    } catch {
      $errors.Add([pscustomobject]@{problem_id=$problemId; type="invalid_datetime"; message="created_at is not valid date-time"})
    }
  }

  $qNorm = Normalize-Text ([string]$p.question_text)
  if ($qNorm) {
    if (-not $qNormMap.ContainsKey($qNorm)) {
      $qNormMap[$qNorm] = New-Object System.Collections.Generic.List[string]
    }
    $qNormMap[$qNorm].Add($problemId)
  }
}

foreach ($k in $qNormMap.Keys) {
  if ($qNormMap[$k].Count -gt 1) {
    $ids = ($qNormMap[$k] -join ", ")
    $errors.Add([pscustomobject]@{problem_id="multiple"; type="exact_duplicate_question"; message="Exact duplicate question_text: $ids"})
  }
}

if ($problems.Count -le 800) {
  $tokenSets = @{}
  foreach ($p in $problems) {
    $tokenSets[$p.problem_id] = Get-TokenSet ([string]$p.question_text)
  }
  for ($i = 0; $i -lt $problems.Count; $i++) {
    for ($j = $i + 1; $j -lt $problems.Count; $j++) {
      $a = $problems[$i]
      $b = $problems[$j]
      if ($a.cefr_level -ne $b.cefr_level) { continue }
      $sim = Get-JaccardSimilarity $tokenSets[$a.problem_id] $tokenSets[$b.problem_id]
      if ($sim -ge $NearDuplicateThreshold) {
        $warnings.Add([pscustomobject]@{
          problem_id = "$($a.problem_id),$($b.problem_id)"
          type = "near_duplicate_question"
          message = "Similarity=$([math]::Round($sim, 3))"
        })
      }
    }
  }
}

Write-Host "=== Quality Check Summary ==="
Write-Host "Input: $InputPath"
Write-Host "Total problems: $($problems.Count)"
Write-Host "Errors: $($errors.Count)"
Write-Host "Warnings: $($warnings.Count)"

if ($errors.Count -gt 0) {
  Write-Host "`n[Errors]"
  $errors | Select-Object -First 30 | Format-Table -AutoSize | Out-String | Write-Host
  if ($errors.Count -gt 30) {
    Write-Host "... and $($errors.Count - 30) more errors"
  }
}

if ($warnings.Count -gt 0) {
  Write-Host "`n[Warnings]"
  $warnings | Select-Object -First 30 | Format-Table -AutoSize | Out-String | Write-Host
  if ($warnings.Count -gt 30) {
    Write-Host "... and $($warnings.Count - 30) more warnings"
  }
}

if ($errors.Count -gt 0) {
  exit 1
}

exit 0

