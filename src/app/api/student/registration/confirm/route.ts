import { successResponse } from '@/lib/api-response';

// In presentATOM, enrollment is immediate (no cart → confirm flow)
export async function POST() {
    return successResponse({ message: 'ลงทะเบียนสำเร็จแล้ว' }, "Already confirmed");
}
