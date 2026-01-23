---
description: Kill all Next.js dev servers and verify they are down
allowed-tools: Bash(killall)
---

Kill all Next.js dev servers running and then verify they're down.

Check:
1. Kill any processes running on port 3000
2. Kill any node processes named "next"
3. Verify no servers are running on common dev ports (3000, 3001, 5000)
