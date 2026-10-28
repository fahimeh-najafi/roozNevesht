param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StartupDirectory = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDirectory 'Daybook.lnk'
$Shell = New-Object -ComObject WScript.Shell
$TaskName = 'Daybook-roozNevesht'
$LauncherPath = Join-Path $ProjectRoot 'server\supervisor.js'
$HiddenLauncher = Join-Path $PSScriptRoot 'background.vbs'
$ScriptHost = Join-Path $env:SystemRoot 'System32\wscript.exe'

if ($Remove) {
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($Task -and ($Task.Actions.Arguments -contains ('"' + $LauncherPath + '"') -or
        $Task.Actions.Arguments -like ('"' + $HiddenLauncher + '" * "' + $LauncherPath + '"'))) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    $Shortcut = $Shell.CreateShortcut($ShortcutPath)
    if ((Test-Path $ShortcutPath) -and $Shortcut.Arguments -like "*$ProjectRoot*") {
        Remove-Item $ShortcutPath
    }
    $PidFile = Join-Path $ProjectRoot 'data\background.pid'
    if (Test-Path $PidFile) {
        $BackgroundId = [int](Get-Content $PidFile)
        $Process = Get-CimInstance Win32_Process -Filter "ProcessId = $BackgroundId"
        if ($Process -and $Process.CommandLine -like "*$(Join-Path $ProjectRoot 'server\supervisor.js')*") {
            Get-CimInstance Win32_Process -Filter "ParentProcessId = $BackgroundId" |
                Where-Object { $_.CommandLine -like "*$(Join-Path $ProjectRoot 'server\index.js')*" } |
                ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
            Stop-Process -Id $BackgroundId -Force -ErrorAction SilentlyContinue
            Remove-Item $PidFile -ErrorAction SilentlyContinue
        }
    }
    Write-Output 'Daybook automatic startup removed.'
    exit
}

if (-not (Test-Path (Join-Path $ProjectRoot 'dist\index.html'))) {
    throw 'Build Daybook first with npm.cmd run build.'
}
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$LauncherArguments = '"' + $HiddenLauncher + '" "' + $Node + '" "' + $LauncherPath + '"'
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $ScriptHost
$Shortcut.Arguments = $LauncherArguments
$Shortcut.WorkingDirectory = $ProjectRoot
$Shortcut.WindowStyle = 7
$Shortcut.Description = 'Private Daybook calendar and SQLite server'
$Shortcut.Save()
Write-Output "Automatic startup installed: $ShortcutPath"
try {
    $ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($ExistingTask -and $ExistingTask.Actions.Arguments -notcontains ('"' + $LauncherPath + '"') -and
        $ExistingTask.Actions.Arguments -notcontains $LauncherArguments) {
        throw "Task $TaskName belongs to another installation."
    }
    $User = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $Action = New-ScheduledTaskAction -Execute $ScriptHost -Argument $LauncherArguments -WorkingDirectory $ProjectRoot
    $Logon = New-ScheduledTaskTrigger -AtLogOn -User $User
    $Watchdog = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
    $Principal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($Logon, $Watchdog) -Principal $Principal -Settings $Settings -Description 'Keep the local Daybook server running while signed in.' -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Write-Output 'Watchdog installed: Windows checks every minute and relaunches Daybook if needed, including on battery power.'
} catch {
    Write-Warning "Windows watchdog could not be installed: $($_.Exception.Message)"
    Write-Warning 'The sign-in shortcut is installed, but automatic recovery of a stopped launcher is unavailable.'
}
Write-Output 'Daybook will start when you sign in to Windows. No administrator access is required.'