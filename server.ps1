# Bertacchio Transcribe - server locale
# Serve la pagina, scarica l'audio dai link tramite yt-dlp e gestisce l'elenco dei brani recenti.
# Avvio: doppio clic su avvia-looper.bat (oppure: powershell -ExecutionPolicy Bypass -File server.ps1)

$ErrorActionPreference = 'Stop'
$Port      = 8765
$Root      = $PSScriptRoot
$YtDlp     = Join-Path $Root 'bin\yt-dlp.exe'
$Cache     = Join-Path $Root 'cache'
$IndexPath = Join-Path $Cache 'index.json'
$Prefix    = "http://localhost:$Port/"
$Utf8      = New-Object Text.UTF8Encoding $false

if (-not (Test-Path $Cache)) { New-Item -ItemType Directory -Path $Cache | Out-Null }

# file della pagina serviti dal server (solo questi percorsi)
$StaticPattern = '^/(index\.html|manifest\.webmanifest|sw\.js|js/[a-z0-9-]+\.js|icons/[a-z0-9-]+\.(png|svg))$'
$StaticTypes = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'
}

$MimeTypes = @{
  '.m4a' = 'audio/mp4'; '.mp4' = 'audio/mp4'; '.webm' = 'audio/webm'; '.opus' = 'audio/ogg'
  '.ogg' = 'audio/ogg'; '.mp3' = 'audio/mpeg'; '.wav' = 'audio/wav'; '.flac' = 'audio/flac'; '.aac' = 'audio/aac'
}

# ---------- risposte ----------
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
  $json = ConvertTo-Json -InputObject $obj -Compress -Depth 6
  Send-Bytes $ctx $status 'application/json; charset=utf-8' ($Utf8.GetBytes($json))
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

# ---------- elenco recenti (cache\index.json) ----------
function Test-CacheName([string]$name) {
  return ($name -match '^[A-Za-z0-9_.\-]+$' -and $name -notmatch '\.\.' -and $name -ne 'index.json')
}

function Read-Index {
  if (-not (Test-Path $IndexPath)) { return ,@() }
  try {
    $data = [IO.File]::ReadAllText($IndexPath, $Utf8) | ConvertFrom-Json
    return ,@($data | Where-Object { $_ -and $_.file })
  } catch {
    return ,@()
  }
}

function Write-Index($list) {
  $json = ConvertTo-Json -InputObject @($list) -Depth 4
  [IO.File]::WriteAllText($IndexPath, $json, $Utf8)
}

function Add-Recent([string]$file, [string]$title, [string]$source, [long]$size) {
  $others = @((Read-Index) | Where-Object { $_.file -ne $file })
  $entry = [pscustomobject]@{
    file = $file; title = $title; source = $source; size = $size
    lastUsed = (Get-Date).ToUniversalTime().ToString('o')
  }
  Write-Index (@($entry) + $others)
}

function Update-RecentUsed([string]$file) {
  $list = Read-Index
  $entry = $list | Where-Object { $_.file -eq $file } | Select-Object -First 1
  if (-not $entry) { return }
  $entry.lastUsed = (Get-Date).ToUniversalTime().ToString('o')
  Write-Index (@($entry) + @($list | Where-Object { $_.file -ne $file }))
}

# ---------- yt-dlp ----------
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

# ---------- API ----------
function Handle-Api($ctx, [string]$path) {
  $req = $ctx.Request

  # header personalizzato: impedisce ad altri siti di usare questo server dal browser
  if ($req.Headers['X-Looper'] -ne '1') { Send-Json $ctx 403 @{ error = 'Richiesta non consentita' }; return }

  switch ($path) {
    '/api/ping' {
      Send-Json $ctx 200 @{ ok = $true; links = (Test-Path $YtDlp) }
    }

    '/api/load' {
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
        Add-Recent $name $r.title $uri.AbsoluteUri (Get-Item $r.path).Length
        Send-Json $ctx 200 @{ title = $r.title; file = "/media/$name"; key = $name }
      } catch {
        Send-Json $ctx 502 @{ error = "Download non riuscito: $($_.Exception.Message)" }
      }
    }

    '/api/recent' {
      $list = Read-Index
      $existing = @($list | Where-Object { Test-Path (Join-Path $Cache $_.file) -PathType Leaf })
      # file presenti in cache ma non nell'elenco (es. scaricati prima che esistessero i Recenti)
      $known = @{}; $existing | ForEach-Object { $known[$_.file] = $true }
      $extra = @(Get-ChildItem -LiteralPath $Cache -File |
        Where-Object { (Test-CacheName $_.Name) -and -not $known.ContainsKey($_.Name) } |
        Sort-Object LastWriteTime -Descending |
        ForEach-Object {
          $src = 'File dal PC'
          if ($_.BaseName -match '^Youtube-(.+)$') { $src = "https://www.youtube.com/watch?v=$($Matches[1])" }
          [pscustomobject]@{
            file = $_.Name; title = $_.BaseName; source = $src; size = $_.Length
            lastUsed = $_.LastWriteTimeUtc.ToString('o')
          }
        })
      if ($extra.Count -gt 0) { $existing = @($existing) + $extra }
      if ($existing.Count -ne $list.Count) { Write-Index $existing }
      Send-Json $ctx 200 @{ items = $existing }
    }

    '/api/upload' {
      if ($req.HttpMethod -ne 'POST') { Send-Json $ctx 405 @{ error = 'Usa POST' }; return }
      if ($req.ContentLength64 -gt 500MB) { Send-Json $ctx 413 @{ error = 'File troppo grande' }; return }
      $title = [Uri]::UnescapeDataString([string]$req.Headers['X-Filename'])
      if (-not $title) { $title = 'audio' }
      $ms = New-Object IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      $bytes = $ms.ToArray()
      if ($bytes.Length -eq 0) { Send-Json $ctx 400 @{ error = 'File vuoto' }; return }
      $sha = [Security.Cryptography.SHA1]::Create()
      $hash = -join ($sha.ComputeHash($bytes)[0..7] | ForEach-Object { $_.ToString('x2') })
      $ext = [IO.Path]::GetExtension($title).ToLower()
      if ($ext -notmatch '^\.[a-z0-9]{1,5}$') { $ext = '' }
      $name = "Locale-$hash$ext"
      $file = Join-Path $Cache $name
      if (-not (Test-Path $file)) { [IO.File]::WriteAllBytes($file, $bytes) }
      Add-Recent $name $title 'File dal PC' $bytes.Length
      Send-Json $ctx 200 @{ title = $title; file = "/media/$name"; key = $name }
    }

    '/api/touch' {
      $name = [string]$req.QueryString['file']
      if (Test-CacheName $name) { Update-RecentUsed $name }
      Send-Json $ctx 200 @{ ok = $true }
    }

    '/api/remove' {
      if ($req.HttpMethod -ne 'POST') { Send-Json $ctx 405 @{ error = 'Usa POST' }; return }
      $name = [string]$req.QueryString['file']
      if (-not (Test-CacheName $name)) { Send-Json $ctx 400 @{ error = 'Nome file non valido' }; return }
      $file = Join-Path $Cache $name
      if (Test-Path $file -PathType Leaf) { Remove-Item -LiteralPath $file -Force }
      Write-Index @((Read-Index) | Where-Object { $_.file -ne $name })
      Send-Json $ctx 200 @{ ok = $true }
    }

    '/api/open-cache' {
      if ($req.HttpMethod -ne 'POST') { Send-Json $ctx 405 @{ error = 'Usa POST' }; return }
      Start-Process explorer.exe -ArgumentList ('"' + $Cache + '"')
      Send-Json $ctx 200 @{ ok = $true }
    }

    default { Send-Json $ctx 404 @{ error = 'Non trovato' } }
  }
}

function Handle-Request($ctx) {
  $req = $ctx.Request
  $path = $req.Url.AbsolutePath
  Write-Host ("{0}  {1} {2}" -f (Get-Date -Format 'HH:mm:ss'), $req.HttpMethod, $req.Url.PathAndQuery)

  if ($path -eq '/' -or $path -eq '/looper.html') { $path = '/index.html' }
  if ($path -cmatch $StaticPattern) {
    $file = Join-Path $Root ($path.Substring(1) -replace '/', '\')
    if (Test-Path $file -PathType Leaf) {
      Send-Bytes $ctx 200 $StaticTypes[[IO.Path]::GetExtension($file).ToLower()] ([IO.File]::ReadAllBytes($file))
    } else {
      Send-Json $ctx 404 @{ error = 'Non trovato' }
    }
    return
  }

  if ($path -like '/api/*') { Handle-Api $ctx $path; return }

  if ($path -like '/media/*') {
    $name = [Uri]::UnescapeDataString($path.Substring(7))
    $file = Join-Path $Cache $name
    if ((Test-CacheName $name) -and (Test-Path $file -PathType Leaf)) {
      $type = $MimeTypes[[IO.Path]::GetExtension($name).ToLower()]
      if (-not $type) { $type = 'application/octet-stream' }
      Send-File $ctx $file $type
    } else {
      Send-Json $ctx 404 @{ error = 'File non trovato' }
    }
    return
  }

  Send-Json $ctx 404 @{ error = 'Non trovato' }
}

# ---------- avvio ----------
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

Write-Host "Bertacchio Transcribe attivo su $Prefix" -ForegroundColor Green
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
