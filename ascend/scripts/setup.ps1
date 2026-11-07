# Prima instalare: creeaza .env cu parole aleatorii, construieste si porneste aplicatia.
. "$PSScriptRoot\common.ps1"

Write-Step "Verific Docker"
Assert-Docker
Write-Ok "Docker ruleaza."

Write-Step "Configurare (.env)"
if (Test-Path "$Root\.env") {
    Write-Ok ".env exista deja - il pastrez."
} else {
    function New-Secret([int]$len = 28) {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
        $bytes = New-Object byte[] $len
        [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
    }
    $content = (Get-Content "$Root\.env.example") `
        -replace '^DB_PASSWORD=.*', "DB_PASSWORD=$(New-Secret)" `
        -replace '^DB_ROOT_PASSWORD=.*', "DB_ROOT_PASSWORD=$(New-Secret)"
    Set-Content -Path "$Root\.env" -Value $content -Encoding ascii
    Write-Ok "Am creat .env cu parole generate aleatoriu (pastreaza fisierul, contine parolele bazei de date)."
}

Write-Step "Construiesc si pornesc containerele (prima data dureaza cateva minute)"
if (Get-Command git -ErrorAction SilentlyContinue) { $env:APP_VERSION = (git rev-parse --short HEAD 2>$null) }
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "docker compose a esuat. Vezi mesajele de mai sus." }

Write-Step "Astept sa porneasca serverul"
$port = Get-EnvValue 'APP_PORT' '8080'
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$port/api/health"
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { Start-Sleep -Seconds 2 }
}
if (-not $ok) { throw "Serverul nu raspunde. Ruleaza: docker compose logs app" }
Write-Ok "Serverul raspunde."

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    Write-Step "Permit accesul de pe telefon in reteaua locala (firewall, profil Private)"
    if (-not (Get-NetFirewallRule -DisplayName "Ascend $port" -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName "Ascend $port" -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
    }
    Write-Ok "Regula de firewall exista."
} else {
    Write-Warn2 "Pentru acces de pe telefon, ruleaza o data acest script ca Administrator (adauga regula de firewall)."
}

Show-Urls
Start-Process "http://localhost:$port"
