---
name: super-ralph-hotfix
description: Stamp reverse process beads with fast-track hotfix question bank for urgent production fixes
---

# Reverse Pack (Hotfix Domain)

This skill composes with `/super-ralph-reverse`. It stamps the **same bead graph** (deep study → draft → 3 review passes → consolidation), but injects the hotfix-specific question bank into bead 1's study instructions.

## How to Use

Follow `/super-ralph-reverse` exactly, but when stamping **Bead 1 (Deep Study of Source Material)**, replace the `## Question Bank` section with the hotfix question bank below.

Everything else — the bead graph structure, dependency wiring, description templates, stamping procedure — is identical to `/super-ralph-reverse`.

## Hotfix Question Bank

Include this in bead 1's description under `## Question Bank`:

```markdown
## Question Bank

Use these fast-track hotfix questions to guide your study — minimal
interrogation for maximum speed on urgent fixes:

### Fast Intake (1-3 questions max)
1. What's broken? Symptoms, error messages, stack traces.
2. What's the impact? Production down? Data loss? User-facing? Workaround?
3. What's the fix? If known, confirm. If not, investigate and propose.
4. Is there a test for this code path? Quick check — note file:line if found.
```
