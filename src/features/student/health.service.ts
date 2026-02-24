import { prisma } from '@/lib/prisma';

/**
 * Health service — stubbed out because presentATOM has no health_records
 * or student_fitness_tests tables. Returns empty data.
 */
export const HealthService = {
    async getHealthData(student_id: number) {
        if (!student_id) return null;

        // No health tables in presentATOM — return empty structure
        return {
            id: null,
            student_id,
            weight: null,
            height: null,
            blood_pressure: null,
            blood_type: null,
            allergies: null,
            chronic_illness: null,
            vaccinations: [],
            fitness: [],
        };
    },

    async updateHealthData(student_id: number, data: any) {
        if (!student_id) throw new Error("Student ID is required");
        // No health tables in presentATOM — no-op
        return { message: 'ระบบข้อมูลสุขภาพยังไม่พร้อมใช้งาน' };
    }
};
