import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export const HealthService = {
    async getHealthData(student_id: number) {

        // Ensure student_id is defined
        if (!student_id) return null;

        // Ensure Health Record Exists (Auto-create pattern from old backend)
        let healthRecord = await prisma.health_records.findFirst({
            where: { student_id: student_id }
        });

        if (!healthRecord) {
            healthRecord = await prisma.health_records.create({
                data: {
                    student_id: student_id
                }
            });
        }

        // Fetch fitness tests
        // The old SQL used DISTINCT ON (test_name) ordering by test_name, created_at DESC
        // We can replicate this by fetching all and reducing in memory (Prisma doesn't natively support DISTINCT ON multiple columns simply)
        const allFitnessTests = await prisma.student_fitness_tests.findMany({
            where: { student_id: student_id },
            orderBy: [
                { test_name: 'asc' },
                { created_at: 'desc' }
            ]
        });

        // Deduplicate by test_name taking the latest
        const uniqueFitnessMap = new Map();
        for (const test of allFitnessTests) {
            if (!uniqueFitnessMap.has(test.test_name)) {
                uniqueFitnessMap.set(test.test_name, test);
            }
        }

        const fitness = Array.from(uniqueFitnessMap.values());

        // Parse vaccinations JSON since Prisma returns JsonValue
        let vaccinations = [];
        try {
            if (healthRecord.vaccinations) {
                vaccinations = typeof healthRecord.vaccinations === 'string'
                    ? JSON.parse(healthRecord.vaccinations)
                    : healthRecord.vaccinations;
            }
        } catch (e) {
            console.error("Failed to parse vaccinations JSON", e);
        }

        // Return combined data
        return {
            ...healthRecord,
            vaccinations: vaccinations,
            fitness: fitness
        };
    },

    async updateHealthData(student_id: number, data: any) {
        if (!student_id) throw new Error("Student ID is required");

        // Ensure health record exists first
        const existing = await prisma.health_records.findFirst({
            where: { student_id: student_id }
        });

        let recordId: number;

        if (!existing) {
            const newRecord = await prisma.health_records.create({
                data: { student_id: student_id }
            });
            recordId = newRecord.id;
        } else {
            recordId = existing.id;
        }

        // Validate and stringify vaccinations
        let vaccinationsJson: Prisma.InputJsonValue = [];
        if (data.vaccinations && Array.isArray(data.vaccinations)) {
            vaccinationsJson = data.vaccinations;
        }

        return prisma.health_records.update({
            where: { id: recordId },
            data: {
                weight: data.weight ? parseFloat(data.weight) : null,
                height: data.height ? parseFloat(data.height) : null,
                blood_pressure: data.blood_pressure || null,
                blood_type: data.blood_type || null,
                allergies: data.allergies || null,
                chronic_illness: data.chronic_illness || null,
                vaccinations: vaccinationsJson
            }
        });
    }
};
