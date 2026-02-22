import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { parseStudentIdFromSession } from '@/app/api/student/_utils';

const confirmCartSchema = z.object({
    year: z.number().int().positive(),
    semester: z.number().int().positive(),
});

export async function POST(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const body = await request.json();
        const parsed = confirmCartSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid payload format", 400, parsed.error.format());
        }

        const { year, semester } = parsed.data;
        const data = await RegistrationService.confirmCart(student_id, year, semester);
        return successResponse(data, "Cart confirmed successfully");
    } catch (error: any) {
        return errorResponse("Failed to confirm cart", 500, error.message);
    }
}
