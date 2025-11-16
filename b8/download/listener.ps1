# listener.ps1
$port = 2019
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $port)
$listener.Start()

Write-Host "--- Data Listener v3.0 (PowerShell) ---"
Write-Host "Server is ready. Listening on localhost:$port..."
Write-Host "Waiting for a client connection..."
Write-Host "----------------------------------------"

try {
    # Accept the client connection (blocks until a connection is made)
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)

    Write-Host "`n--- Connection established ---"

    # Read data from the client
    # ReadToEnd reads all data sent until the connection closes
    $data = $reader.ReadToEnd()

    if ($data) {
        Write-Host "--- RECEIVED DATA (Wi-Fi Device Names) ---"
        Write-Host $data
    } else {
        Write-Host "Received no data."
    }

} catch {
    Write-Error "An error occurred during listening or reading: $($_.Exception.Message)"
} finally {
    # Clean up and close
    if ($reader) { $reader.Close() }
    if ($stream) { $stream.Close() }
    if ($client) { $client.Close() }
    $listener.Stop()
    Write-Host "`n--- Listener finished ---"
}

# Keep the window open to view the results
Read-Host "Press Enter to close this window..."