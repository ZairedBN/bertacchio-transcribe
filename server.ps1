# Looper MP3 - server locale
# Serve looper.html e scarica l'audio dai link tramite yt-dlp.
# Avvio: doppio clic su avvia-looper.bat (oppure: powershell -ExecutionPolicy Bypass -File server.ps1)

$ErrorActionPreference = 'Stop'
$Port   = 8765
$Root   = $PSScriptRoot
$Page   = Join-Path $Root 'looper.html'
$YtDlp  = Join-Path $Root 'bin\yt-dlp.exe'
$Cache  = Join-Path $Root 'cache'
$Prefix = "http://localhost:$Port/"

if (-not (Test-Path $Cache)) { New-Item -ItemType Directory -Path $Cache | Out-Null }

$MimeTypes = @{
  '.m4a' = 'audio/mp4'; '.mp4' = 'audio/mp4'; '.webm' = 'audio/webm'; '.opus' = 'audio/ogg'
  '.ogg' = 'audio/ogg'; '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.flac' = 'audio/flac'; '.aac' = 'audio/aac'
}

function Send-Bytes($ctx, [int]$status, [string]$type, [byte[]]$bytes) {
  $res = $ctx.Response
  $res.StatusCode = $status
  $res.ContentType = $type
  $res.Headers['Cache-Control'] = 'no-store'
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
  $res.OutputStream.Close()
}

function Send-Json($ctx, [int]$status, $obj) {
  $json = $obj | ConvertTo-Json -Compress
  Send-Bytes $ctx $status 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($json))
}

function Send-File($ctx, [string]$path, [string]$type) {
  $res = $ctx.Response
  $res.StatusCode = 200
  $res.ContentType = $type
  $fs = [IO.File]::OpenRead($path)
  try {
    $res.ContentLength64 = $fs.Length
    $fs.CopyTo($res.OutputStream)
  } finally {
    $fs.Close()
    $res.OutputStream.Close()
  }
}

function Invoke-YtDlp([string]$url) {
  $outTpl = Join-Path $Cache '%(extractor_key)s-%(id)s.%(ext)s'
  $argv = @(
    '-f', 'bestaudio[ext=m4a]/bestaudio',
    '--no-playlist', '--no-simulate', '--no-progress', '--restrict-filenames',
    '--encoding', 'utf-8',
    '-o', $outTpl,
    '--print', 'title',
    '--print', 'after_move:filepath',
    '--', $url
  )
  # ogni argomento tra virgolette (l'URL e' gia' stato validato: niente spazi ne' virgolette)
  $argString = ($argv | ForEach-Object { '"' + ($_ -replace '\\$', '\\') + '"' }) -join ' '

  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = $YtDlp
  $psi.Arguments = $argString
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [Text.Encoding]::UTF8

  $p = [Diagnostics.Process]::Start($psi)
  $errTask = $p.StandardError.ReadToEndAsync()
  $out = $p.StandardOutput.ReadToEnd()
  $p.WaitForExit()
  $err = $errTask.Result

  $lines = @($out -split "`r?`n" | Where-Object { $_.Trim() -ne '' })
  if ($p.ExitCode -ne 0 -or $lines.Count -lt 2) {
    $msg = ($err -split "`r?`n" | Where-Object { $_ -match 'ERROR' } | Select-Object -First 1)
    if (-not $msg) { $msg = "yt-dlp ha restituito il codice $($p.ExitCode)" }
    throw ($msg -replace '^ERROR:\s*', '')
  }
  return @{ title = $lines[0]; path = $lines[-1] }
}

function Handle-Request($ctx) {
  $req = $ctx.Request
  $path = $req.Url.AbsolutePath
  Write-Host ("{0}  {1} {2}" -f (Get-Date -Format 'HH:mm:ss'), $req.HttpMethod, $req.Url.PathAndQuery)

  if ($path -eq '/' -or $path -eq '/looper.html') {
    Send-Bytes $ctx 200 'text/html; charset=utf-8' ([IO.File]::ReadAllBytes($Page))
    return
  }

  if ($path -eq '/api/load') {
    # header personalizzato: impedisce ad altri siti di usare questo server dal browser
    if ($req.Headers['X-Looper'] -ne '1') { Send-Json $ctx 403 @{ error = 'Richiesta non consentita' }; return }
    if (-not (Test-Path $YtDlp)) {
      Send-Json $ctx 500 @{ error = "Manca bin\yt-dlp.exe. Scaricalo da https://github.com/yt-dlp/yt-dlp/releases/latest e mettilo nella cartella bin." }
      return
    }
    $url = $req.QueryString['url']
    $uri = $null
    if (-not $url -or -not [Uri]::TryCreate($url.Trim(), [UriKind]::Absolute, [ref]$uri) -or
        ($uri.Scheme -ne 'http' -and $uri.Scheme -ne 'https') -or $url -match '[\s"]') {
      Send-Json $ctx 400 @{ error = 'Link non valido: deve iniziare con http:// o https://' }
      return
    }
    try {
      $r = Invoke-YtDlp $uri.AbsoluteUri
      $name = Split-Path $r.path -Leaf
      Send-Json $ctx 200 @{ title = $r.title; file = "/media/$name" }
    } catch {
      Send-Json $ctx 502 @{ error = "Download non riuscito: $($_.Exception.Message)" }
    }
    return
  }

  if ($path -like '/media/*') {
    $name = [Uri]::UnescapeDataString($path.Substring(7))
    $file = Join-Path $Cache $name
    if ($name -match '^[A-Za-z0-9_.\-]+$' -and $name -notmatch '\.\.' -and (Test-Path $file -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($name).ToLower()
      $type = $MimeTypes[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      Send-File $ctx $file $type
    } else {
      Send-Json $ctx 404 @{ error = 'File non trovato' }
    }
    return
  }

  Send-Json $ctx 404 @{ error = 'Non trovato' }
}

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add($Prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Impossibile avviare il server su $Prefix (porta gia' in uso? forse il looper e' gia' aperto)." -ForegroundColor Red
  Start-Process $Prefix
  Read-Host 'Premi Invio per chiudere'
  exit 1
}

Write-Host "Looper attivo su $Prefix" -ForegroundColor Green
Write-Host 'Chiudi questa finestra (o premi Ctrl+C) per fermarlo.'
if (-not (Test-Path $YtDlp)) { Write-Host 'Attenzione: bin\yt-dlp.exe non trovato, i link non funzioneranno.' -ForegroundColor Yellow }
if ($env:LOOPER_NO_BROWSER -ne '1') { Start-Process $Prefix }

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.Wait(300)) { }   # attesa a intervalli: permette Ctrl+C
    $ctx = $task.Result
    try { Handle-Request $ctx }
    catch {
      Write-Host "Errore: $($_.Exception.Message)" -ForegroundColor Red
      try { Send-Json $ctx 500 @{ error = $_.Exception.Message } } catch { }
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
