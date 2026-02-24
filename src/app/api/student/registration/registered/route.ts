import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { parseIntegerParam, parseStudentIdFromSession } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        const sessionResult = parseStudentIdFromSession(session);
        if (!sessionResult.ok) return sessionResult.response;
        const student_id = sessionResult.studentId;

        const { searchParams } = new URL(request.url);
        const semesterParsed = parseIntegerParam(searchParams.get('semester_id'));
        const semesterId = semesterParsed.ok ? semesterParsed.value : undefined;

        const data = await RegistrationService.getRegistered(student_id, semesterId ?? undefined);
        return successResponse(data, "Registered retrieved");
    } catch (error: any) {
        return errorResponse("Failed to retrieve registered items", 500, error.message);
    }
}
