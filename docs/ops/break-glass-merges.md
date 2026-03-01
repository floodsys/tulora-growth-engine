# Break-glass merges (solo maintainer)

This repo requires:
- 1 approving review
- enforce_admins=true

If no eligible reviewer is available, a break-glass merge may be used:

1. Create a tracking issue documenting the reason for the break-glass merge.
2. Temporarily disable `enforce_admins` on the branch protection rule.
3. Merge the PR with `--admin` (or via the GitHub UI admin override).
4. Immediately re-enable `enforce_admins` on the branch protection rule.
5. Verify `enforce_admins` is active again (e.g., `gh api repos/{owner}/{repo}/branches/main/protection/enforce_admins`).
6. Post the verification results as a comment on the tracking issue.
7. Close the tracking issue once the audit trail is complete.

## Audit checklist

| Step | Evidence |
|------|----------|
| Tracking issue created | Issue URL |
| `enforce_admins` disabled | Timestamp / actor |
| PR merged | Merge commit SHA |
| `enforce_admins` re-enabled | Timestamp / actor |
| Verification posted | Comment URL |

## Notes

- Break-glass merges **must** be the exception, not the rule.
- Every break-glass merge should be reviewed retroactively at the next team sync.
- If break-glass merges become frequent, consider adding a second maintainer or a bot-based approval workflow.
