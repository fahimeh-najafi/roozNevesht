Option Explicit
Dim Shell, Command, Argument
If WScript.Arguments.Count <> 2 Then WScript.Quit 1
Command = ""
For Each Argument In WScript.Arguments
    If InStr(Argument, Chr(34)) > 0 Then WScript.Quit 1
    If Len(Command) > 0 Then Command = Command & " "
    Command = Command & Chr(34) & Argument & Chr(34)
Next
Set Shell = CreateObject("WScript.Shell")
WScript.Quit Shell.Run(Command, 0, True)