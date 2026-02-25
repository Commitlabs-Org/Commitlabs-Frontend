import { NextResponse } from "next/server";

export async function GET() {
    const metrics = {
        status: "up",
        uptime: process.uptime(),
        mock_requests_total: Math.floor(Math.random() * 1000),
        mock_errors_total: Math.floor(Math.random() * 10),
        timestamp: new Date().toISOString(),
    };

    return NextResponse.json(metrics);
}
