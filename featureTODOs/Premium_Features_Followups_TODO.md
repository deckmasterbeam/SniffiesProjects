# Premium Features: Remaining Work

Status: the Premium Features master toggle and per-feature switches are implemented in core, client, userscript and bookmarklet. Only the items below are left. This file replaces `Premium_Features_Toggle_TODO.md`.

- [ ] Capture `POST /api/authenticate/current` from a free account and confirm how `user.private.appstoreMembership` differs. A paid account returns `name: "Plus"`, `subscriptionStatus: "active"` and a future `end`; it has only been seen on a paid account, so we still need to confirm the field is missing or null on a free one. Paid-account detection and the "you don't need these" notice are built on that assumption.
- [ ] E2E coverage (see `PLAYWRIGHT_TESTING_TODO.md` §1, §2, §6). The existing specs were updated for the new section but have not been run, and there are no new specs.
