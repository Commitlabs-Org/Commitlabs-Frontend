import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { ok } from '@/lib/backend/apiResponse';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const POST = withApiHandler(async (req: NextRequest) => {
    // Only allow this route in development mode
    if (process.env.NODE_ENV !== 'development') {
        return ok({ message: 'Not Found' }, 404);
    }

    try {
        await execAsync('npm run seed:mock');
        return ok({ message: 'Mock data seeded successfully.' }, 200);
    } catch (e: any) {
        return ok({ message: 'Failed to seed mock data', error: e.message }, 500);
    }
});
