# sender_client.ps1
$TargetHost = "localhost"
$TargetPort = 2019

# --- PART 1: Get Wi-Fi Device Names ---
# Execute netsh, filter for the name lines, join with CRLF, and store as a string
$DataToSend = (netsh wlan show interfaces | Out-String | Select-String -Pattern "Name\s+:\s+" | ForEach-Object {$_.ToString().Trim()}) -join "`r`n"

# --- PART 2: Send Data to localhost:2019 ---
Write-Host "Attempting to send Wi-Fi data to $TargetHost on port $TargetPort..."

try {
    # Attempt to establish the TCP connection and send the data
    $Client = New-Object System.Net.Sockets.TcpClient($TargetHost, $TargetPort)
    $Stream = $Client.GetStream()
    $Writer = New-Object System.IO.StreamWriter($Stream)

    $Writer.WriteLine($DataToSend)
    $Writer.Flush()
    
    Write-Host "Successfully sent Wi-Fi device names. Closing connection."

} catch {
    Write-Error "Failed to connect to the listener. Make sure 'listener.ps1' is running."
} finally {
    # Close resources
    if ($Writer) { $Writer.Close() }
    if ($Stream) { $Stream.Close() }
    if ($Client) { $Client.Close() }
}

# Pause briefly for viewing output
Start-Sleep -Seconds 3