# record-token.ps1
# Record token usage + duration to .trae/token-usage.json
# Usage:
#   pwsh -File record-token.ps1 -Summary "task" -InputTokens 7000 -OutputTokens 1800 -DurationSeconds 95
param(
  [Parameter(Mandatory=$true)][string]$Summary,
  [int]$InputTokens = 0,
  [int]$OutputTokens = 0,
  [int]$DurationSeconds = 0
)

$parentDir = Split-Path -Parent $PSScriptRoot
$jsonPath = Join-Path $parentDir '.trae\token-usage.json'
# 同步复制到 chongzhen-game/public/，让 Vite dev server 能直接 serve 给可视化页面
$publicCopyPath = Join-Path $PSScriptRoot 'public\token-usage.json'

if (-not (Test-Path $jsonPath)) {
  Write-Error "Cannot find $jsonPath"
  exit 1
}

$bytes = [System.IO.File]::ReadAllBytes($jsonPath)
$json = [System.Text.Encoding]::UTF8.GetString($bytes)

if ([string]::IsNullOrWhiteSpace($json)) {
  Write-Error "File is empty"
  exit 1
}

$data = $json | ConvertFrom-Json

# Estimate if not provided (1 token ~= 1.8 chars Chinese mixed)
$summaryLen = [System.Text.Encoding]::UTF8.GetByteCount($Summary)
$est = [int][math]::Max(1, $summaryLen / 1.8)
if ($InputTokens -le 0) { $InputTokens = $est * 4 }
if ($OutputTokens -le 0) { $OutputTokens = $est }

$totalTokens = $InputTokens + $OutputTokens
$turnId = (Get-Date).ToString('yyyyMMddHHmmss') + '-' + ($data.records.Count + 1)
$ts = (Get-Date).ToString('o')

$newRec = New-Object psobject -Property @{
  timestamp = $ts
  turn_id = $turnId
  summary = $Summary
  input_tokens = $InputTokens
  output_tokens = $OutputTokens
  total_tokens = $totalTokens
  duration_seconds = $DurationSeconds
}

# Append using array list
$arr = @($data.records) + @($newRec)
$data.records = $arr

# Cumulative
$data.total_input_tokens = [int]$data.total_input_tokens + $InputTokens
$data.total_output_tokens = [int]$data.total_output_tokens + $OutputTokens
$data.total_tokens = [int]$data.total_tokens + $totalTokens

$data | ConvertTo-Json -Depth 8 | Set-Content $jsonPath -Encoding UTF8
# 同步一份到 public/ 供 Vite dev server 静态 serve
$data | ConvertTo-Json -Depth 8 | Set-Content $publicCopyPath -Encoding UTF8

Write-Host "[OK] $Summary"
Write-Host ("  in {0} + out {1} = total {2} tokens, duration {3}s" -f $InputTokens, $OutputTokens, $totalTokens, $DurationSeconds)
Write-Host ("  cumulative: {0} tokens, {1} records" -f $data.total_tokens, $data.records.Count)
