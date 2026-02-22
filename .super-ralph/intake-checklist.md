# Intake Checklist

> This file is read during Phase C of the intake protocol by the ralph-tui PRD skills.
> It contains learned questions — things the team has discovered should always be asked during intake.
> The `LEARN-001` bead at the end of each epic appends new entries here.

## How to Use

The intake skill reads this file and asks any relevant questions that haven't already been covered
by the standard business interrogation (Phase A) and technical deep-dive (Phase B). Not every
question applies to every piece of work — the skill uses judgment about which are relevant.

## Learned Questions

### Data & Storage
- Have we considered soft deletes vs hard deletes?
- Do we need audit logging for this data?
- What's the data retention policy?
- Are there GDPR/privacy implications for the data involved?

### Security & Access
- Does this need rate limiting?
- What are the authorization boundaries? Who can see/do what?
- Are there API keys or secrets involved? How are they managed?

### Operations
- How will we know if this is broken in production? What monitoring/alerting is needed?
- What's the rollback strategy if this goes wrong?
- Does this need a feature flag for gradual rollout?

### User Experience
- What happens in the empty state (no data yet)?
- What happens during loading? What does the user see?
- What error messages does the user see? Are they actionable?

### Integration
- Does this affect any existing webhooks, scheduled jobs, or background workers?
- Are there third-party API rate limits or quotas we need to respect?
- Does this need to work offline or handle network failures gracefully?

---

*Last updated: seed file — no epics completed yet.*
