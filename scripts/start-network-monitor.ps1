# Launcher Network Monitor (Next.js production) untuk Task Scheduler / auto-start.
$ErrorActionPreference = 'Continue'

# Cari node.exe: path umum, lalu fallback ke PATH.
$nodeCandidates = @(
  "$env:ProgramFiles\nodejs\node.exe",
  "${env:ProgramFiles(x86)}\nodejs\node.exe",
  'D:\Download\node.exe'
)
$node = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $node) { $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source }
if (-not $node) { throw "node.exe tidak ditemukan" }

# Project berada di parent folder script ini (scripts/ -> root).
$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

$logDir = Join-Path $projectDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

& $node 'node_modules\next\dist\bin\next' start `
  1>> (Join-Path $logDir 'network-monitor.out.log') `
  2>> (Join-Path $logDir 'network-monitor.err.log')
