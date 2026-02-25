import { ConflictError, ForbiddenError, ValidationError } from './errors';

export type CommitmentTypeInput = 'safe' | 'balanced' | 'aggressive';

export interface SignatureContext {
    nonce?: string;
    signature?: string;
    signerAddress?: string;
}

export interface CreateCommitmentInput {
    ownerAddress: string;
    amount: string;
    assetCode: string;
    assetIssuer: string | null;
    durationDays: number;
    maxLossPercent: number;
    commitmentType: CommitmentTypeInput;
    signatureContext: SignatureContext;
}

export interface EarlyExitInput {
    ownerAddress: string;
    signatureContext: SignatureContext;
    currentStatus?: string;
}

const STELLAR_ACCOUNT_ADDRESS_REGEX = /^[GC][A-Z2-7]{55}$/;

async function parseJsonBody(req: Request): Promise<unknown> {
    try {
        return await req.json();
    } catch {
        throw new ValidationError('Request body must be valid JSON.');
    }
}

function asObject(value: unknown, message = 'Request body must be a JSON object.'): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ValidationError(message);
    }
    return value as Record<string, unknown>;
}

function readStringField(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new ValidationError(`${field} is required and must be a non-empty string.`);
    }
    return value.trim();
}

function readOptionalStringField(body: Record<string, unknown>, field: string): string | undefined {
    const value = body[field];
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new ValidationError(`${field} must be a string.`);
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new ValidationError(`${field} must be a non-empty string.`);
    }
    return normalized;
}

function readPositiveAmount(body: Record<string, unknown>, field: string): string {
    const value = body[field];
    const asString = typeof value === 'number' ? String(value) : value;
    if (typeof asString !== 'string') {
        throw new ValidationError(`${field} must be a numeric string or number.`);
    }
    const normalized = asString.trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new ValidationError(`${field} must be greater than zero.`);
    }
    return normalized;
}

function readIntegerInRange(
    body: Record<string, unknown>,
    field: string,
    minimum: number,
    maximum?: number
): number {
    const value = body[field];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new ValidationError(`${field} must be an integer.`);
    }
    if (value < minimum || (maximum !== undefined && value > maximum)) {
        throw new ValidationError(`${field} must be between ${minimum} and ${maximum ?? 'unbounded'}.`);
    }
    return value;
}

function validateStellarAddress(value: string, fieldName: string): string {
    if (!STELLAR_ACCOUNT_ADDRESS_REGEX.test(value)) {
        throw new ValidationError(`${fieldName} must be a valid Stellar account address.`);
    }
    return value;
}

function readSignatureContext(body: Record<string, unknown>): SignatureContext {
    const signatureContext = asObject(body.signatureContext ?? {}, 'signatureContext must be a JSON object if provided.');
    const nonceValue = signatureContext.nonce;
    const nonce = nonceValue === undefined || nonceValue === null ? undefined : String(nonceValue);
    return {
        nonce,
        signature: readOptionalStringField(signatureContext, 'signature'),
        signerAddress: readOptionalStringField(signatureContext, 'signerAddress'),
    };
}

function verifySignerMatchesOwner(ownerAddress: string, signatureContext: SignatureContext): void {
    if (
        signatureContext.signerAddress !== undefined &&
        signatureContext.signerAddress.toLowerCase() !== ownerAddress.toLowerCase()
    ) {
        throw new ForbiddenError('Signature signer does not match ownerAddress.');
    }
}

export async function parseCreateCommitmentInput(req: Request): Promise<CreateCommitmentInput> {
    const raw = await parseJsonBody(req);
    const body = asObject(raw);

    const ownerAddress = validateStellarAddress(readStringField(body, 'ownerAddress'), 'ownerAddress');
    const amount = readPositiveAmount(body, 'amount');
    const durationDays = readIntegerInRange(body, 'durationDays', 1, 3650);
    const maxLossPercent = readIntegerInRange(body, 'maxLossPercent', 0, 100);

    const commitmentTypeRaw = readStringField(body, 'commitmentType').toLowerCase();
    if (!['safe', 'balanced', 'aggressive'].includes(commitmentTypeRaw)) {
        throw new ValidationError('commitmentType must be one of safe, balanced, or aggressive.');
    }

    const assetCode = (readOptionalStringField(body, 'assetCode') ?? 'XLM').toUpperCase();
    const assetIssuer = readOptionalStringField(body, 'assetIssuer');
    if (assetCode !== 'XLM' && assetIssuer === undefined) {
        throw new ValidationError('assetIssuer is required for non-XLM assets.');
    }
    if (assetCode !== 'XLM' && assetIssuer !== undefined) {
        validateStellarAddress(assetIssuer, 'assetIssuer');
    }

    const signatureContext = readSignatureContext(body);
    if (signatureContext.signerAddress !== undefined) {
        validateStellarAddress(signatureContext.signerAddress, 'signatureContext.signerAddress');
    }
    verifySignerMatchesOwner(ownerAddress, signatureContext);

    return {
        ownerAddress,
        amount,
        assetCode,
        assetIssuer: assetCode === 'XLM' ? null : (assetIssuer ?? null),
        durationDays,
        maxLossPercent,
        commitmentType: commitmentTypeRaw as CommitmentTypeInput,
        signatureContext,
    };
}

export async function parseEarlyExitInput(req: Request): Promise<EarlyExitInput> {
    const raw = await parseJsonBody(req);
    const body = asObject(raw);

    const ownerAddress = validateStellarAddress(readStringField(body, 'ownerAddress'), 'ownerAddress');
    const currentStatus = readOptionalStringField(body, 'currentStatus')?.toLowerCase();
    if (currentStatus !== undefined && currentStatus !== 'active') {
        throw new ConflictError('Commitment is not in an active state.');
    }

    const signatureContext = readSignatureContext(body);
    if (signatureContext.signerAddress !== undefined) {
        validateStellarAddress(signatureContext.signerAddress, 'signatureContext.signerAddress');
    }
    verifySignerMatchesOwner(ownerAddress, signatureContext);

    return {
        ownerAddress,
        signatureContext,
        currentStatus,
    };
}
