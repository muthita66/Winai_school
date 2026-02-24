import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { parseIntegerParam } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const semesterParsed = parseIntegerParam(searchParams.get('semester_id'), { required: true, min: 1 });
        if (!semesterParsed.ok) return errorResponse("Invalid parameter: semester_id", 400, semesterParsed.error);
        const semesterId = semesterParsed.value!;
        const classroomId = searchParams.get('classroom_id') ? Number(searchParams.get('classroom_id')) : undefined;

        const data = await RegistrationService.browseSubjects(semesterId, classroomId);
        return successResponse(data, "Browse subjects retrieved");
    } catch (error: any) {
        return errorResponse("Failed to browse", 500, error.message);
    }
}
