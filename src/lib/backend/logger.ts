/**
 * Lightweight analytics-friendly logger for backend events.
 *
 * These helpers are intentionally simple because the actual business logic
 * lives elsewhere. When the app moves into production we could replace the
 * `emit` implementation with something that forwards events to an analytics
 * service (Mixpanel, Segment, Datadog, etc.).
 *
 * For now we simply write a structured JSON string to the console so that
 * developers and automated tests can verify that the correct hooks are being
 * invoked.
 */

export interface AnalyticsPayload {
    [key: string]: any;
}

interface AnalyticsEvent {
    event: string;
    timestamp: string;
    payload?: AnalyticsPayload;
}

function emit(event: AnalyticsEvent) {
    // In development we use console.log; in production this might be a call
    // to an external service or to a logging library that understands
    // structured events.
    console.log(JSON.stringify(event));
}

export function logCommitmentCreated(payload: AnalyticsPayload = {}) {
    emit({
        event: 'CommitmentCreated',
        timestamp: new Date().toISOString(),
        payload
    });
}

export function logCommitmentSettled(payload: AnalyticsPayload = {}) {
    emit({
        event: 'CommitmentSettled',
        timestamp: new Date().toISOString(),
        payload
    });
}

export function logEarlyExit(payload: AnalyticsPayload = {}) {
    emit({
        event: 'CommitmentEarlyExit',
        timestamp: new Date().toISOString(),
        payload
    });
}

export function logAttestation(payload: AnalyticsPayload = {}) {
    emit({
        event: 'AttestationReceived',
        timestamp: new Date().toISOString(),
        payload
    });
}
