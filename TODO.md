# TODO - transfer_ownership entrypoint

- [x] Inspect escrow contract + tests + docs
- [ ] Implement `transfer_ownership(commitment_id, new_owner)` in `contracts/escrow/src/lib.rs`
  - [ ] Gate by current owner auth (`c.owner.require_auth()`)
  - [ ] Allow only `Funded` commitments
  - [ ] Update `Commitment.owner`
  - [ ] Maintain `OwnerIndex` for both old + new owners (remove from old, add to new)
  - [ ] Add internal helper(s) for index de-registration
  - [ ] Add event + review-oriented comments
- [ ] Add unit tests in `contracts/escrow/src/test.rs`
  - [ ] Happy path: funded commitment index updates
  - [ ] Fails when commitment not funded
  - [ ] Fails when commitment disputed (still requires funded-only)
  - [ ] Edge: transfer to self / duplicate handling
- [x] Document flow in `contracts/README.md`
- [ ] Run `cargo test` and ensure coverage meets requirement
- [ ] Commit changes on branch (feature/transfer-ownership-entrypoint)

