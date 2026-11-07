# Functii comune pentru scripturile Ascend (fara diacritice: compatibil Windows PowerShell 5.1)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "    $text" -ForegroundColor Yellow }

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker nu este instalat. Instaleaza Docker Desktop: https://www.docker.com/products/docker-desktop/"
    }
    # in PowerShell 5.1 stderr-ul unei comenzi externe + 'Stop' ar opri scriptul
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    docker info > $null 2>&1
    $code = $LASTEXITCODE; $ErrorActionPreference = $prev
    if ($code -ne 0) {
        throw "Docker Desktop nu ruleaza. Porneste Docker Desktop, asteapta sa scrie 'Engine running', apoi ruleaza din nou."
    }
}

function Get-EnvValue($name, $default) {
    if (Test-Path "$Root\.env") {
        foreach ($line in Get-Content "$Root\.env") {
            if ($line -match "^\s*$name\s*=\s*(.*)\s*$") { return $Matches[1] }
        }
    }
    return $default
}

function Get-LanIPs {
    try {
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)' -and $_.PrefixOrigin -ne 'WellKnown' } |
            Select-Object -ExpandProperty IPAddress
    } catch { @() }
}

function Show-Urls {
    $port = Get-EnvValue 'APP_PORT' '8080'
    Write-Host ""
    Write-Host "  Ascend ruleaza:" -ForegroundColor Green
    Write-Host "    Pe acest laptop:  http://localhost:$port"
    foreach ($ip in Get-LanIPs) { Write-Host "    Telefon (acelasi Wi-Fi):  http://${ip}:$port" }
    Write-Host ""
}
