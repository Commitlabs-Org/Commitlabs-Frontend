# TODO

## Contracts - Fix unchecked arithmetic in maturity calculation in create_commitment

- [ ] Create branch `bug/checked-maturity-arithmetic` (if not already).
- [x] Update `contracts/escrow/src/lib.rs` to compute `maturity` using `checked_mul` and `checked_add`.
- [x] Return `InvalidDuration` on overflow.
- [x] Add tests in `contracts/escrow/src/test.rs` covering overflow inputs for `duration_days` and timestamp.
- [x] Document behavior in `contracts/README.md`.
- [x] Add comments on the overflow guard.

- [ ] Run tests / build (requires Rust toolchain / cargo available).
- [ ] Commit with message like `fix: use checked arithmetic for maturity calculation`.

