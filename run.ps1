<#
.SYNOPSIS
  One-command local runner for TenderIQ on Windows (architecture brief section 7.4).

.DESCRIPTION
  Stage A (static UI prototype, DD-50). In order:
    1. checks Node 24 (.nvmrc);
    2. runs `npm install` when node_modules is missing;
    3. runs the prototype (`npm run dev:prototype`): the SPA on http://localhost:5173, with the static-data mock
       API running in the page. Sign in by choosing a demo persona. Press Ctrl+C to stop it.
  The prototype needs no Docker, no database and no environment file. It is the only runnable mode in Stage A,
  so it is also the default.

.PARAMETER Prototype
  Run the prototype (the SPA with the in-browser mock API). This is the default in Stage A.

.EXAMPLE
  .\run.ps1
  Installs the dependencies if needed and runs the prototype.
#>
[CmdletBinding()]
param(
  [switch]$Prototype
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Npm([string[]]$Arguments) {
  & npm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($Arguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

# Runs a native command whose stderr must be discarded. Windows PowerShell 5.1 turns redirected stderr lines
# into error records, which would abort the script under $ErrorActionPreference = 'Stop'; the exit code
# ($LASTEXITCODE) is what decides success.
function Invoke-NativeQuiet([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $Command
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Assert-Prerequisites {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is not installed or not on PATH. Install Node 24 (see .nvmrc).'
  }
  $nodeVersion = Invoke-NativeQuiet { & node --version 2>$null }
  if ($nodeVersion -notmatch '^v24\.') {
    throw "Node $nodeVersion is active, but TenderIQ requires Node 24 (.nvmrc, DD-45)."
  }
}

# Stage A has a single runnable mode, the prototype: -Prototype selects it explicitly and it is also the default.
Assert-Prerequisites

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
  Write-Step 'Installing dependencies (npm install)'
  Invoke-Npm @('install')
}

Write-Step 'Running the prototype: http://localhost:5173 (Ctrl+C to stop)'
Invoke-Npm @('run', 'dev:prototype')
