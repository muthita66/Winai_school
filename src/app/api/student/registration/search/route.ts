import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { parseIntegerParam } from '@/app/api/student/_utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const keyword = searchParams.get('keyword');
        const semesterParsed = parseIntegerParam(searchParams.get('semester_id'));
        const semesterId = semesterParsed.ok ? semesterParsed.value : undefined;

        if (!keyword) {
            return successResponse([], "No keyword provided");
        }

        const data = await RegistrationService.searchSubjects(keyword, semesterId ?? undefined);
        return successResponse(data, "Subjects retrieved");
    } catch (error: any) {
        return errorResponse("Failed to search", 500, error.message);
    }
}
