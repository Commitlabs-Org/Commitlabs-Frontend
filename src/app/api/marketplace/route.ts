// src/app/api/marketplace/route.ts
import { NextRequest } from "next/server";
import {
  validatePagination,
  validateFilters,
  validateAmount,
  handleValidationError,
  createMarketplaceListingSchema,
} from "@/lib/backend/validation";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") ?? undefined;
    const limit = searchParams.get("limit") ?? undefined;
    const category = searchParams.get("category");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");

    // Validate pagination
    const pagination = validatePagination(page, limit);

    // Validate filters
    const filters = validateFilters({ category, minPrice, maxPrice });

    // Validate price filters if provided
    if (filters.minPrice) {
      validateAmount(filters.minPrice as string | number);
    }
    if (filters.maxPrice) {
      validateAmount(filters.maxPrice as string | number);
    }

    // Mock response
    const listings = [
      { id: "1", title: "Sample Listing", category: "impact", price: 50 },
      // ... more
    ];

    return Response.json({
      listings,
      pagination,
      filters,
      total: listings.length,
    });
  } catch (error) {
    return handleValidationError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = createMarketplaceListingSchema.parse(body);

    // Mock creation
    const newListing = {
      id: Date.now().toString(),
      title: validatedData.title,
      description: validatedData.description || "",
      price: validatedData.price,
      category: validatedData.category,
      seller: validatedData.sellerAddress,
      createdAt: new Date().toISOString(),
    };

    return Response.json(newListing, { status: 201 });
  } catch (error) {
    return handleValidationError(error);
  }
}
