# Wallet security model

## Trust boundaries

The wallet integration in the frontend treats Freighter as an untrusted client-side boundary. The application should never assume that a prompt will succeed, that the extension is installed, or that the network is correct. Every wallet interaction is therefore treated as a potentially rejected, timed-out, or misconfigured operation.

## Failure handling expectations

The wallet hook now normalizes the following states into explicit, user-safe outcomes:

- Extension absent or unavailable: the UI surfaces an install guidance message instead of throwing an unhandled error.
- User rejected the prompt: the hook reports a rejection state without retaining a connected wallet address.
- Wrong network: the hook surfaces a network mismatch error and keeps the address in a non-sensitive display form only.
- Hung or slow calls: wallet calls are capped with a timeout so the UI does not remain in a stale loading state indefinitely.

## Redaction and privacy rules

- Never log full wallet secrets, private keys, signatures, or full public addresses in application logs or errors.
- Display only truncated public addresses in the UI (for example, the first and last four characters).
- Error messages should describe the outcome in generic terms and must not echo back raw wallet payloads.

## Operational guidance

- Treat every wallet action as a user consent boundary and require explicit confirmation.
- Clear session state and disconnect local wallet state whenever a wallet flow fails or is rejected.
- Keep the app’s expected network passphrase in one place so wallet mismatch detection stays consistent.
