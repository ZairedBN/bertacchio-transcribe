# Piccolo client DevTools per Edge headless (test di Bertacchio Transcribe).
# Commands: file JSON con un array di {method, params} | {eval: "file.js"} | {sleep: ms} | {screenshot: "nome.png", full: true}
# I file .js sono cercati accanto al JSON; gli screenshot finiscono in out/.
param([int]$Port, [string]$Url, [string]$Commands, [string]$UserDir = "$env:TEMP\edge-cdp", [int]$StepTimeout = 120)

$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$null = Start-Process $edge -PassThru -ArgumentList @(
  '--headless=new', '--disable-gpu', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  "--user-data-dir=$UserDir", "--remote-debugging-port=$Port", '--window-size=1200,900', $Url)

$t = $null
for ($i = 0; $i -lt 40 -and -not $t; $i++) {
  Start-Sleep -Milliseconds 300
  try {
    $list = (Invoke-WebRequest "http://localhost:$Port/json/list" -UseBasicParsing).Content | ConvertFrom-Json
    $t = @($list | ForEach-Object { $_ }) | Where-Object { $_.type -eq 'page' -and $_.url -like "$Url*" } | Select-Object -First 1
  } catch { }
}
if (-not $t) { 'NO TARGET'; exit 1 }

$ws = New-Object Net.WebSockets.ClientWebSocket
[void]$ws.ConnectAsync([Uri]([string]$t.webSocketDebuggerUrl), [Threading.CancellationToken]::None).Wait(10000)
$global:msgId = 0
$global:buf = New-Object byte[] 4194304

function Invoke-Cdp([string]$method, [hashtable]$params) {
  $global:msgId++
  $myId = $global:msgId
  $msg = ConvertTo-Json -InputObject @{ id = $myId; method = $method; params = $params } -Depth 20 -Compress
  $b = [Text.Encoding]::UTF8.GetBytes($msg)
  [void]$ws.SendAsync([ArraySegment[byte]]$b, 'Text', $true, [Threading.CancellationToken]::None).Wait(10000)
  $deadline = (Get-Date).AddSeconds($StepTimeout)
  while ((Get-Date) -lt $deadline) {
    $sb = New-Object Text.StringBuilder
    do {
      $task = $ws.ReceiveAsync([ArraySegment[byte]]$global:buf, [Threading.CancellationToken]::None)
      if (-not $task.Wait($StepTimeout * 1000)) { return $null }
      [void]$sb.Append([Text.Encoding]::UTF8.GetString($global:buf, 0, $task.Result.Count))
    } while (-not $task.Result.EndOfMessage)
    $txt = $sb.ToString()
    if ($txt -match ('^\{"id":' + $myId + ',')) { return ($txt | ConvertFrom-Json) }
  }
  return $null
}

Start-Sleep -Milliseconds 1500
$dir = Split-Path $Commands
$outDir = Join-Path $dir "out"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory $outDir | Out-Null }
$cmds = Get-Content $Commands -Raw | ConvertFrom-Json
foreach ($c in ($cmds | ForEach-Object { $_ })) {
  if ($c.sleep) { Start-Sleep -Milliseconds $c.sleep; continue }
  if ($c.screenshot) {
    $p = @{ format = 'png' }
    if ($c.full) { $p.captureBeyondViewport = $true }
    $res = Invoke-Cdp 'Page.captureScreenshot' $p
    if ($res -and $res.result.data) { [IO.File]::WriteAllBytes((Join-Path $outDir $c.screenshot), [Convert]::FromBase64String($res.result.data)); "screenshot out$($c.screenshot)" }
    continue
  }
  if ($c.eval) {
    $js = [IO.File]::ReadAllText((Join-Path $dir $c.eval))
    $res = Invoke-Cdp 'Runtime.evaluate' @{ expression = $js; awaitPromise = $true; returnByValue = $true }
    if (-not $res) { "[$($c.eval)] TIMEOUT"; continue }
    if ($res.result.exceptionDetails) { "[$($c.eval)] EXCEPTION: " + $res.result.exceptionDetails.exception.description }
    else { "[$($c.eval)] " + $res.result.result.value }
    continue
  }
  $p = @{}
  if ($c.params) { $c.params.PSObject.Properties | ForEach-Object { $p[$_.Name] = $_.Value } }
  $res = Invoke-Cdp $c.method $p
  if (-not $res) { "$($c.method) TIMEOUT" } elseif ($res.error) { "ERROR $($c.method): " + ($res.error | ConvertTo-Json -Compress) }
}
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*$UserDir*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
