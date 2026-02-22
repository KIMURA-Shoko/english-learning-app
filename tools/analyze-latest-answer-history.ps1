param(
  [string]$UploadDir = "E:\project\english-learning-app\reports\answer-history",
  [string]$ProblemPath = "E:\project\english-learning-app\data\problems\initial_problems.json",
  [string]$OutputDir = "E:\project\english-learning-app\reports"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $UploadDir)) {
  Write-Error "Upload directory not found: $UploadDir"
  exit 1
}

$latest = Get-ChildItem -Path $UploadDir -Filter "*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) {
  Write-Error "No JSON files found in: $UploadDir"
  exit 1
}

$base = [System.IO.Path]::GetFileNameWithoutExtension($latest.Name)
$outputPath = Join-Path $OutputDir ("answer-analysis-report-" + $base + ".md")

$scriptPath = "E:\project\english-learning-app\tools\analyze-answer-history.ps1"
& powershell -ExecutionPolicy Bypass -File $scriptPath -AnswerHistoryPath $latest.FullName -ProblemPath $ProblemPath -OutputPath $outputPath

Write-Host "Analyzed file:" $latest.FullName
Write-Host "Output report:" $outputPath
