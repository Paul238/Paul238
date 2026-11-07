# Functii comune pentru scripturile Ascend (fara diacritice: compatibil Windows PowerShell 5.1)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "    $text" -ForegroundColor Yellow }

function Assert-Docker {
    # Docker poate fi instalat, dar fereastra curenta sa nu-l aiba inca in PATH
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        $bin = Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin'
        if (Test-Path (Join-Path $bin 'docker.exe')) {
            $env:Path = "$bin;$env:Path"
        } else {
            throw "Docker Desktop nu este instalat. Ruleaza ca Administrator: winget install -e --id Docker.DockerDesktop  (apoi reporneste laptopul)"
        }
    }

    # in PowerShell 5.1 stderr-ul unei comenzi externe + 'Stop' ar opri scriptul
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    docker info > $null 2>&1
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
        if (Test-Path $desktop) {
            Write-Host "    Pornesc Docker Desktop si astept motorul (pana la 3 minute)..." -ForegroundColor Yellow
            Start-Process $desktop
            for ($i = 0; $i -lt 90 -and $code -ne 0; $i++) {
                Start-Sleep -Seconds 2
                docker info > $null 2>&1
                $code = $LASTEXITCODE
            }
        }
    }
    $ErrorActionPreference = $prev
    if ($code -ne 0) {
        throw "Docker Desktop nu porneste. Deschide-l manual, asteapta 'Engine running' si citeste eventualul mesaj de eroare."
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
