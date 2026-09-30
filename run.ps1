<#
.SYNOPSIS
  One-command local runner for TenderIQ on Windows (architecture brief section 7.4).

.DESCRIPTION
  Stage A (UI prototype). In order:
    1. checks Node 24 (.nvmrc) and that Docker is running;
    2. runs `npm install` when node_modules is missing;
    3. starts the local Supabase stack in Docker (`npm run supabase:start`); Stage A uses its Auth for real
       sign-in (DD-43) and its Mailpit for password-reset emails;
    4. writes or refreshes the Supabase values in the root .env.local from `supabase status`, keeping every
       other line of the file;
    5. creates or updates the demo accounts in local Supabase Auth (`npm run auth:personas`, password test1234);
    6. runs the prototype (`npm run dev:prototype`): mock API on http://127.0.0.1:3001 and the SPA on
       http://localhost:5173. Press Ctrl+C to stop it; the Supabase stack keeps running.
  The prototype is the only runnable mode in Stage A, so it is also the default.

.PARAMETER Prototype
  Run the prototype (static-data mock API + Vite). This is the default in Stage A.

.PARAMETER StopDb
  Stop the local Supabase stack (`npm run supabase:stop`) and exit.

.EXAMPLE
  .\run.ps1
  Starts everything and runs the prototype.

.EXAMPLE
  .\run.ps1 -StopDb
  Stops the local Supabase stack.
#>
[CmdletBinding()]
param(
  [switch]$Prototype,
  [switch]$StopDb
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
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker is not installed or not on PATH. Install and start Docker Desktop.'
  }
  Invoke-NativeQuiet { & docker info 2>$null | Out-Null }
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker is not running. Start Docker Desktop, wait until it is ready, then run this script again.'
  }
}

function Get-SupabaseStatusEnv {
  $lines = Invoke-NativeQuiet { & npx supabase status -o env 2>$null }
  if ($LASTEXITCODE -ne 0) {
    throw 'Could not read the output of "supabase status". Is the local stack running (npm run supabase:start)?'
  }
  $values = @{}
  foreach ($line in $lines) {
    if ($line -match '^([A-Z0-9_]+)="?(.*?)"?$') {
      $values[$Matches[1]] = $Matches[2]
    }
  }
  foreach ($required in @('API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY')) {
    if (-not $values.ContainsKey($required) -or [string]::IsNullOrWhiteSpace($values[$required])) {
      throw "The output of 'supabase status' did not include $required."
    }
  }
  return $values
}

function Sync-EnvLocal {
  $status = Get-SupabaseStatusEnv
  # Values that must always match the running stack (they change when the signing key is regenerated).
  $managed = [ordered]@{
    'SUPABASE_URL'              = $status['API_URL']
    'SUPABASE_ANON_KEY'         = $status['ANON_KEY']
    'SUPABASE_SERVICE_ROLE_KEY' = $status['SERVICE_ROLE_KEY']
    'VITE_SUPABASE_URL'         = $status['API_URL']
    'VITE_SUPABASE_ANON_KEY'    = $status['ANON_KEY']
  }
  # Values written only when absent, so a developer's own choice is kept.
  $defaults = [ordered]@{
    'APP_ENV'   = 'local'
    'LOG_LEVEL' = 'info'
  }

  $path = Join-Path $PSScriptRoot '.env.local'
  $output = New-Object System.Collections.Generic.List[string]
  $seen = @{}
  if (Test-Path -LiteralPath $path) {
    foreach ($line in [System.IO.File]::ReadAllLines($path)) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
        $key = $Matches[1]
        $seen[$key] = $true
        if ($managed.Contains($key)) {
          $output.Add("$key=$($managed[$key])")
          continue
        }
      }
      $output.Add($line)
    }
  } else {
    $output.Add('# Local environment for TenderIQ (git-ignored). Supabase values come from `npx supabase status -o env`.')
  }
  foreach ($key in $defaults.Keys) {
    if (-not $seen.ContainsKey($key)) { $output.Add("$key=$($defaults[$key])") }
  }
  foreach ($key in $managed.Keys) {
    if (-not $seen.ContainsKey($key)) { $output.Add("$key=$($managed[$key])") }
  }
  # UTF-8 without a byte-order mark and LF line endings: Node's --env-file and Vite read it.
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, (($output -join "`n") + "`n"), $utf8NoBom)
}

if ($StopDb) {
  Write-Step 'Stopping the local Supabase stack'
  Invoke-Npm @('run', 'supabase:stop')
  return
}

# Stage A has a single runnable mode, the prototype: -Prototype selects it explicitly and it is also the default.
Assert-Prerequisites

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
  Write-Step 'Installing dependencies (npm install)'
  Invoke-Npm @('install')
}

Write-Step 'Starting the local Supabase stack (Docker)'
Invoke-Npm @('run', 'supabase:start')

Write-Step 'Syncing .env.local with the running stack'
Sync-EnvLocal

Write-Step 'Creating or updating the demo accounts (password test1234)'
Invoke-Npm @('run', 'auth:personas')

Write-Step 'Running the prototype: SPA http://localhost:5173, mock API http://127.0.0.1:3001 (Ctrl+C to stop)'
Write-Host '    Password-reset emails: Mailpit at http://127.0.0.1:54324' -ForegroundColor DarkGray
Invoke-Npm @('run', 'dev:prototype')
