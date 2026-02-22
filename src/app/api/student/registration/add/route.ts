import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { parseStudentIdFromSession } from '@/app/api/student/_utils';

const addToCartSchema = z.object({
    section_id: z.number().int().positive(),
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
        const parsed = addToCartSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid payload format", 400, parsed.error.format());
        }

        const { section_id, year, semester } = parsed.data;
        const data = await RegistrationService.addToCart(student_id, section_id, year, semester);
        return successResponse(data, "Subjects added to cart");
    } catch (error: any) {
        return errorResponse("Failed to add to cart", 500, error.message);
    }
}
