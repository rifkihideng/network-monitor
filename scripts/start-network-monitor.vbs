' Jalankan Network Monitor secara tersembunyi saat login.
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "D:\project fix 5"
shell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""D:\project fix 5\scripts\start-network-monitor.ps1""", 0, False
