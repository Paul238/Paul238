<#
  Optimizare PC Windows 10/11 - sigura si reversibila
  Rulare: click dreapta pe PowerShell -> "Run as Administrator", apoi:
      Set-ExecutionPolicy -Scope Process Bypass -Force
      .\optimizare-pc.ps1            # optimizare standard
      .\optimizare-pc.ps1 -Complet   # + verificare fisiere sistem (SFC/DISM, dureaza 15-40 min)
#>
param([switch]$Complet)

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Ruleaza scriptul ca Administrator!" -ForegroundColor Red
    exit 1
}

function Pas($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function SpatiuLiber { [math]::Round((Get-PSDrive C).Free / 1GB, 2) }

$inainte = SpatiuLiber
Write-Host "Spatiu liber pe C: inainte: $inainte GB" -ForegroundColor Yellow

# 1. Punct de restaurare (ca sa poti reveni daca ceva nu iti place)
Pas "Creez punct de restaurare a sistemului"
try {
    Enable-ComputerRestore -Drive "C:\" -ErrorAction SilentlyContinue
    Checkpoint-Computer -Description "Inainte de optimizare" -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
    Write-Host "Punct de restaurare creat."
} catch { Write-Host "Nu s-a putut crea (Windows permite unul la 24h): $($_.Exception.Message)" -ForegroundColor DarkYellow }

# 2. Curatare fisiere temporare
Pas "Sterg fisierele temporare"
$foldere = @("$env:TEMP\*", "$env:WINDIR\Temp\*", "$env:WINDIR\SoftwareDistribution\Download\*",
             "$env:LOCALAPPDATA\Microsoft\Windows\INetCache\*", "$env:LOCALAPPDATA\CrashDumps\*")
foreach ($f in $foldere) { Remove-Item $f -Recurse -Force -ErrorAction SilentlyContinue }
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
Write-Host "Temporare si Cos de gunoi golite."

# 3. Curatare componente vechi Windows Update
Pas "Curat componentele vechi Windows Update (DISM)"
Dism.exe /Online /Cleanup-Image /StartComponentCleanup /Quiet /NoRestart | Out-Null

# 4. Plan de alimentare performant
Pas "Setez planul de alimentare pe High Performance"
$hp = powercfg /list | Select-String "High performance|Performan" | Select-Object -First 1
if ($hp -and $hp -match '([0-9a-f\-]{36})') { powercfg /setactive $Matches[1] }
else {
    $nou = powercfg /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
    if ($nou -match '([0-9a-f\-]{36})') { powercfg /setactive $Matches[1] }
}
powercfg /getactivescheme

# 5. Optimizare discuri (TRIM pentru SSD, defragmentare pentru HDD)
Pas "Optimizez discurile"
Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' } | ForEach-Object {
    Write-Host "Disc $($_.DriveLetter):"
    Optimize-Volume -DriveLetter $_.DriveLetter -ErrorAction SilentlyContinue
}

# 6. Retea
Pas "Golesc cache-ul DNS"
ipconfig /flushdns | Out-Null

# 7. Dezactivez aplicatiile din fundal si sugestiile/reclamele Windows (doar pentru utilizatorul curent)
Pas "Reduc reclamele si sugestiile Windows"
$cdm = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
foreach ($v in "SubscribedContent-338388Enabled","SubscribedContent-338389Enabled","SubscribedContent-353694Enabled","SystemPaneSuggestionsEnabled","SilentInstalledAppsEnabled") {
    Set-ItemProperty -Path $cdm -Name $v -Value 0 -Type DWord -ErrorAction SilentlyContinue
}

# 8. Verificare fisiere sistem (optional)
if ($Complet) {
    Pas "Repar imaginea Windows (DISM RestoreHealth)"
    Dism.exe /Online /Cleanup-Image /RestoreHealth
    Pas "Verific fisierele de sistem (SFC)"
    sfc /scannow
}

# 9. Raport: programe care pornesc odata cu Windows (doar afisare, nu modific nimic)
Pas "Programe la pornire (dezactiveaza-le pe cele inutile din Task Manager > Startup)"
Get-CimInstance Win32_StartupCommand | Select-Object Name, Location | Format-Table -AutoSize

# 10. Raport hardware rapid
Pas "Stare sistem"
$os = Get-CimInstance Win32_OperatingSystem
"{0} | RAM total: {1} GB | RAM liber: {2} GB" -f $os.Caption, [math]::Round($os.TotalVisibleMemorySize/1MB,1), [math]::Round($os.FreePhysicalMemory/1MB,1)
Get-PhysicalDisk | Select-Object FriendlyName, MediaType, HealthStatus, @{n='GB';e={[math]::Round($_.Size/1GB)}} | Format-Table -AutoSize

$dupa = SpatiuLiber
Write-Host "`nGata! Spatiu liber pe C: $inainte GB -> $dupa GB (eliberat: $([math]::Round($dupa-$inainte,2)) GB)" -ForegroundColor Green
Write-Host "Recomand un restart al PC-ului." -ForegroundColor Green
