import { RegistrationService } from '@/features/student/registration.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { parseIntegerParam } from '@/app/api/student/_utils';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const idParsed = parseIntegerParam((await params).id, { required: true, min: 1 });
        if (!idParsed.ok) return errorResponse("Invalid ID", 400, idParsed.error);
        const id = idParsed.value!;

        const data = await RegistrationService.removeCartItem(id);
        return successResponse(data, "Item removed");
    } catch (error: any) {
        return errorResponse("Failed to remove item", 500, error.message);
    }
}
