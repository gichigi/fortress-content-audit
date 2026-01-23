---
description: Push to GitHub with a clear, atomic commit message
allowed-tools: Bash(git:*)
---

Push to GitHub in one command with a clear commit message.

Steps:
1. Check `git status` to see what will be committed
2. Check `git diff` to review the actual changes
3. Create an atomic commit with a clear, descriptive message
4. Push to the remote branch

Follow these commit message guidelines:
- First line: 50 chars max, clear action (Add/Fix/Update/Remove/Refactor)
- Body (if needed): Explain the "why" not the "what"
- Example: "Fix PDF export by migrating to client-side html2pdf.js"

Include the co-author line:
```
Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```
