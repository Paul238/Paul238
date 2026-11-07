# Verifica daca exista o versiune noua pe GitHub; daca da: backup, descarcare, reconstruire.
# Ruleaza automat din Task Scheduler (vezi auto-update-install.ps1). Scrie in backups\auto-update.log
param([switch]$Force)
. "$PSScriptRoot\common.ps1"
$log = Join-Path $Root 'backups\auto-update.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
function Log($m) { Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m" -Encoding UTF8 }

# git scrie mesaje normale pe stderr; in PowerShell 5.1 nu trebuie tratate ca erori
function Git { $p = $ErrorActionPreference; $ErrorActionPreference = 'Continue'; $out = & git @args 2>&1; $code = $LASTEXITCODE; $ErrorActionPreference = $p; return @{ out = ($out | Out-String).Trim(); code = $code } }

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git nu este instalat.' }
    $f = Git fetch --quiet
    if ($f.code -ne 0) { throw "git fetch a esuat: $($f.out)" }
    $local = (Git rev-parse HEAD).out
    $remote = (Git rev-parse '@{u}').out
    if ($local -eq $remote -and -not $Force) { exit 0 }

    Log "Versiune noua gasita: $($local.Substring(0,7)) -> $($remote.Substring(0,7))"
    Assert-Docker
    & "$PSScriptRoot\backup.ps1" | Out-Null
    Log 'Backup facut.'

    $p = Git pull --ff-only
    if ($p.code -ne 0) { throw "git pull a esuat (modificari locale?): $($p.out)" }

    $env:APP_VERSION = (Git rev-parse --short HEAD).out
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $build = docker compose up -d --build 2>&1 | Out-String
    $code = $LASTEXITCODE; $ErrorActionPreference = $prev
    if ($code -ne 0) { throw "docker compose a esuat: $build" }
    Log "Actualizat la versiunea $env:APP_VERSION."
} catch {
    Log "EROARE: $_"
    exit 1
}
