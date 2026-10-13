$ErrorActionPreference = "Stop"
$src = Split-Path $PSScriptRoot -Parent
$pkg = Get-Content "$src\package.json" -Raw | ConvertFrom-Json
$ver = $pkg.version
$out = Join-Path (Split-Path $src -Parent) "kilo-qol-patch-$ver.vsix"

$engine = [System.Security.SecurityElement]::Escape($pkg.engines.vscode)
$desc = [System.Security.SecurityElement]::Escape($pkg.description)
$tags = [System.Security.SecurityElement]::Escape($pkg.keywords -join ",")
$pub = [System.Security.SecurityElement]::Escape($pkg.publisher)

$manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="kilo-qol-patch" Version="$ver" Publisher="$pub"/>
    <DisplayName>Kilo QoL Patch</DisplayName>
    <Description xml:space="preserve">$desc</Description>
    <Tags>$tags</Tags>
    <Categories>Other</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="$engine" /></Properties>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true" />
  </Assets>
</PackageManifest>
"@

$types = @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="md" ContentType="text/markdown"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
  <Override PartName="/extension/LICENSE" ContentType="text/plain"/>
</Types>
'@

$rels = @'
<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="Document" Type="http://schemas.microsoft.com/developer/vsx-schema/2011" Target="extension.vsixmanifest"/>
</Relationships>
'@

$files = [ordered]@{
  "extension/extension.js"         = "$src\extension.js"
  "extension/patch-core.js"        = "$src\patch-core.js"
  "extension/kb-rules.js"          = "$src\kb-rules.js"
  "extension/package.json"         = "$src\package.json"
  "extension/README.md"            = "$src\README.md"
  "extension/LICENSE"              = "$src\LICENSE"
  "extension/icon.png"             = "$src\icon.png"
  "extension/scripts/uninstall.js" = "$src\scripts\uninstall.js"
}

if (Test-Path $out) { Remove-Item -LiteralPath $out -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$fs = [System.IO.File]::Open($out, [System.IO.FileMode]::CreateNew)
try {
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    function Add-ZipText([System.IO.Compression.ZipArchive]$z, [string]$name, [string]$text) {
      $entry = $z.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
      $sw = New-Object System.IO.StreamWriter($entry.Open(), $utf8NoBom)
      $sw.Write($text); $sw.Dispose()
    }
    function Add-ZipFile([System.IO.Compression.ZipArchive]$z, [string]$name, [string]$path) {
      $entry = $z.CreateEntry($name, [System.IO.Compression.CompressionLevel]::Optimal)
      $es = $entry.Open()
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $es.Write($bytes, 0, $bytes.Length); $es.Dispose()
    }
    Add-ZipText $zip "[Content_Types].xml" $types
    Add-ZipText $zip "_rels/.rels" $rels
    Add-ZipText $zip "extension.vsixmanifest" $manifest
    foreach ($k in $files.Keys) { Add-ZipFile $zip $k $files[$k] }
  } finally { $zip.Dispose() }
} finally { $fs.Dispose() }
"built: $out  $((Get-Item $out).Length) bytes"
