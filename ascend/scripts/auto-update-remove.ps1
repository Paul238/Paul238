. "$PSScriptRoot\common.ps1"
Unregister-ScheduledTask -TaskName 'Ascend Auto-Update' -Confirm:$false -ErrorAction SilentlyContinue
Write-Ok 'Actualizarea automata este oprita.'
