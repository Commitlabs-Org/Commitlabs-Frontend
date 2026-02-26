// src/lib/backend/validation.ts
import { z } from 'zod';
import { StrKey } from '@stellar/stellar-sdk';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface FilterParams {
  [key: string]: string | number | boolean | undefined;
}

// Zod schemas
const addressSchema = z.string().refine(
  (addr) => StrKey.isValidEd25519PublicKey(addr),
  { message: 'Invalid Stellar address format' }
);

const amountSchema = z.union([z.string(), z.number()]).transform((val) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) {
    throw new Error('Amount must be a positive number');
  }
  return num;
});

const paginationSchema = z.object({
  page: z.union([z.string(), z.number()]).optional().default(1).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 1) {
      throw new Error('Page must be a positive integer');
    }
    return num;
  }),
  limit: z.union([z.string(), z.number()]).optional().default(10).transform((val) => {
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    if (isNaN(num) || num < 1 || num > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    return num;
  }),
}).transform((data) => ({
  page: data.page,
  limit: data.limit,
}));

// Request body schemas
export const createCommitmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  amount: amountSchema,
  creatorAddress: addressSchema,
});

export const createMarketplaceListingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  price: amountSchema,
  category: z.string().min(1, 'Category is required'),
  sellerAddress: addressSchema,
});

export const createAttestationSchema = z.object({
  commitmentId: z.string().min(1, 'Commitment ID is required'),
  attesterAddress: addressSchema,
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().optional(),
});

export type CreateCommitmentInput = z.infer<typeof createCommitmentSchema>;
export type CreateMarketplaceListingInput = z.infer<typeof createMarketplaceListingSchema>;
export type CreateAttestationInput = z.infer<typeof createAttestationSchema>;

// Validate Stellar address
export function validateAddress(address: string): string {
  try {
    return addressSchema.parse(address);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues[0].message, 'address');
    }
    throw error;
  }
}

// Validate amount (positive number, can be string or number)
export function validateAmount(amount: string | number): number {
  try {
    return amountSchema.parse(amount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.issues[0].message, 'amount');
    }
    throw error;
  }
}

// Validate pagination parameters
export function validatePagination(page?: string | number, limit?: string | number): PaginationParams {
  try {
    return paginationSchema.parse({ page, limit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const field = error.issues[0].path[0] as string;
      throw new ValidationError(error.issues[0].message, field);
    }
    throw error;
  }
}

// Validate filters (generic, for now just check types)
export function validateFilters(filters: Record<string, any>): FilterParams {
  const validated: FilterParams = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      validated[key] = value;
    } else {
      throw new ValidationError(`Filter ${key} must be a string, number, or boolean`, key);
    }
  }
  return validated;
}

// Helper to handle validation in API routes
export function handleValidationError(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message, field: error.field }, { status: 400 });
  }
  if (error instanceof z.ZodError) {
    const firstError = error.issues[0];
    const field = firstError.path.join('.');
    return Response.json({ error: firstError.message, field }, { status: 400 });
  }
  throw error; // Re-throw if not validation error
}
