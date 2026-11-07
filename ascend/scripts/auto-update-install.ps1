# Porneste actualizarea automata: o sarcina in Task Scheduler verifica la fiecare 5 minute
# (si la logare) daca exista o versiune noua si o instaleaza singura.
. "$PSScriptRoot\common.ps1"
$name = 'Ascend Auto-Update'
$script = Join-Path $PSScriptRoot 'auto-update.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" -WorkingDirectory $Root
$every5 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $name -Action $action -Trigger @($every5, $atLogon) -Settings $settings -Description 'Actualizeaza aplicatia Ascend cand apare o versiune noua pe GitHub.' -Force | Out-Null

Write-Step 'Actualizarea automata este pornita'
Write-Ok 'La fiecare 5 minute verific daca exista o versiune noua. Daca da: backup, descarcare, reconstruire.'
Write-Ok "Jurnal: $Root\backups\auto-update.log"
Write-Ok 'Oprire: actualizare-automata-oprire.cmd'
Write-Step 'Prima verificare, chiar acum'
& $script -Force
if ($LASTEXITCODE -eq 0) { Write-Ok 'Aplicatia este la zi.' } else { Write-Warn2 'Prima verificare a dat eroare; vezi jurnalul.' }
