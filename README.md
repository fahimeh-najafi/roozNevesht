# Daybook

A personal calendar and daily notebook, with a private local server and SQLite storage.

## Run

Requires Node.js 24 or newer. From the project folder:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

Open http://127.0.0.1:5173/. The production server serves the built application; it does not need VS Code or Vite to remain open.

## Word Book

Use the book icon in the header or open http://127.0.0.1:5173/word-book.html.
Add Norsk, English, and Farsi translations in the first table row; all fields are optional. Farsi fields support Persian script and read right-to-left. Saved rows are read-only until you choose Edit from the three-dot menu beside the row. Save commits your changes; Cancel discards them. Delete is also in the three-dot menu and asks for confirmation. Words are stored in the same SQLite database as your notes, in a separate table. The notes JSON export does not include words; a full database backup includes both.

Click any Farsi field to open the on-screen Persian keyboard; no Windows keyboard layout is needed. It inserts at the cursor and supports selected-text replacement, space, half-space, and backspace. Close it with the X button, Escape, or by clicking outside it. Your physical keyboard still works normally.

Click any column heading to sort saved words alphabetically in that language; click it again to reverse the order. The arrow shows the current direction. Sorting ignores letter case and keeps empty translations last in either direction. Translations stay together, and unsaved edits are preserved. Added or saved words follow the selected order until you reload the page.

Use the search field above the table to instantly filter saved words by any part of their Norsk, English, or Farsi translations. Search ignores letter case and surrounding spaces, shows the matching count, and works with the selected sort order. Clear search to restore all rows without losing unsaved edits. Adding, saving, or deleting a word updates the results automatically; search does not include edits until they are saved.

## Automatic Windows startup

```powershell
.\scripts\startup.ps1
```

This installs a shortcut in your user's Startup folder and a per-user scheduled watchdog. It starts the background server at Windows sign-in and restarts the server if it exits. The watchdog checks every minute and relaunches the background launcher if it stops; it also runs on battery power and after waking from sleep. Duplicate launchers are ignored only after checking that the saved process ID actually belongs to this project's launcher, so Windows reusing an old ID cannot block startup.

No administrator permission is requested. If Windows policy blocks task registration, the installer warns and retains the sign-in shortcut, but recovery of a stopped launcher is unavailable. The computer must be on, awake, and signed in; the server remains available when the screen is locked. It cannot respond while the laptop is asleep or powered off. Starting before sign-in requires a separately configured Windows service. This is not an internet deployment.

The installer starts the scheduled watchdog immediately when registration succeeds. Otherwise, start the background launcher through the Windows Run dialog with `shell:startup`, then open the Daybook shortcut. Both launch through Windows Script Host with the console hidden, so no PowerShell or Node window should appear. The background app does not depend on PowerShell script permissions. If the launcher stops, the watchdog relaunches it within about a minute when installed. Run the installer again to update an older installation that opens console windows.

To disable automatic startup and stop the background server:

```powershell
.\scripts\startup.ps1 -Remove
```

If PowerShell blocks local scripts, do not change your system execution policy just for this app. Run `npm.cmd start` for the current session, or review the scripts and unblock those files according to your organization's security policy.

## Notes and backups

- The database is `data/daybook.sqlite`, in this project folder. `data/` is excluded from Git.
- Notes are acknowledged as saved only after the database confirms the write. SQLite uses full synchronous durability and WAL journaling.
- Old browser notes are imported once, without overwriting existing database notes. Use the same browser and exact original URL, http://127.0.0.1:5173/, for migration. Notes stored under another host or port cannot be read automatically.
- Unsaved changes are kept as browser recovery drafts and retried every five seconds when the server returns. A failed database write is shown in the editor.
- The download button exports all currently loaded notes as JSON. Database storage is not a backup: make regular exports and keep a copy elsewhere. There is not yet a JSON restore interface.
- To copy the raw SQLite database safely, stop the app first, then copy `data/daybook.sqlite`. Do not copy just the main database file while the server is writing because committed changes can still be in `daybook.sqlite-wal`.
- The database is not encrypted. Anyone with access to your Windows account/project files can read it. This is a single-user app; concurrent edits to the same date from separate tabs use the last database write.
- Do not move or delete the project folder while relying on its startup shortcut. The background log is `data/server.log`.

The server binds only to `127.0.0.1` and rejects unrecognized hosts and cross-site requests. It has no login system and must not be exposed to the internet or a shared network. For access while your PC is off, deploy to an always-on host with persistent storage, HTTPS, and authentication first.

## Development

With the database server running at port 5173:

```powershell
npm.cmd run dev
npm.cmd test
```

Vite runs at http://127.0.0.1:5174/ and proxies database requests to the local server. After changing code, run `npm.cmd run build` to update the production UI. Restart the background server after changing server code.