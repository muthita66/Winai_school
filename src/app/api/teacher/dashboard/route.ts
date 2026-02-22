import { TeacherDashboardService } from '@/features/teacher/dashboard.service';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const teacher_id = Number(searchParams.get('teacher_id'));
        if (!teacher_id || Number.isNaN(teacher_id)) return errorResponse('teacher_id required', 400);

        const summary = await TeacherDashboardService.getSummary(teacher_id);
        return successResponse(summary);
    } catch (error: any) {
        return errorResponse('Failed to load dashboard', 500, error.message);
    }
}
