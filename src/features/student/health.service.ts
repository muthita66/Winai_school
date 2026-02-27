import { prisma } from '@/lib/prisma';

/**
 * Health service — stubbed out because presentATOM has no health_records
 * or student_fitness_tests tables. Returns empty data.
 */
export const HealthService = {
    async getHealthData(student_id: number) {
        if (!student_id) return null;

        // Get student and profile
        const student = await prisma.students.findUnique({
            where: { id: student_id },
            include: {
                users: {
                    include: {
                        student_health_profiles: true
                    }
                }
            }
        });

        if (!student) return null;

        // Get latest checkup
        const latestCheckup = await prisma.student_health_checkups.findFirst({
            where: { student_id },
            orderBy: { checkup_date: 'desc' }
        });

        // Get vaccinations
        const vaccinations = await prisma.vaccination_records.findMany({
            where: { student_id },
            include: { vaccines: true },
            orderBy: { administered_date: 'desc' }
        });

        // Get fitness
        const fitness = await prisma.student_fitness_records.findMany({
            where: { student_id },
            orderBy: { test_date: 'desc' }
        });

        // Get allergies
        const allergies = await prisma.student_allergies.findMany({
            where: { student_id },
            include: { allergens: true }
        });

        // Get diseases
        const diseases = await prisma.student_diseases.findMany({
            where: { student_id },
            include: { diseases: true }
        });

        return {
            student_id,
            weight: latestCheckup?.weight ? Number(latestCheckup.weight) : null,
            height: latestCheckup?.height ? Number(latestCheckup.height) : null,
            blood_type: student.users.student_health_profiles?.blood_type || null,
            allergies: allergies.map(a => a.allergens.name).join(', '),
            chronic_illness: diseases.map(d => d.diseases.name).join(', '),
            vaccinations: vaccinations.map(v => ({
                id: v.id,
                name: v.vaccines.name,
                date: v.administered_date ? v.administered_date.toISOString().split('T')[0] : "",
                status: "Completed" // New schema doesn't have status, assuming completed if record exists
            })),
            fitness: fitness.map(f => ({
                id: f.id,
                test_name: f.test_name,
                result_value: f.test_result ? String(f.test_result) : null,
                standard_value: f.score ? String(f.score) : null,
                status: f.grade,
                date: f.test_date ? f.test_date.toISOString().split('T')[0] : ""
            })),
        };
    },

    async updateHealthData(student_id: number, data: any) {
        if (!student_id) throw new Error("Student ID is required");

        const { weight, height, blood_type, allergies, chronic_illness, vaccinations } = data;

        const student = await prisma.students.findUnique({
            where: { id: student_id },
            select: { user_id: true }
        });

        if (!student) throw new Error("Student not found");

        return await prisma.$transaction(async (tx) => {
            // 1. Update Profile (Blood Type)
            await tx.student_health_profiles.upsert({
                where: { student_id: student.user_id },
                update: {
                    blood_type: blood_type ?? null,
                    updated_at: new Date()
                },
                create: {
                    student_id: student.user_id,
                    blood_type: blood_type ?? null
                }
            });

            // 2. Update/Create Checkup (Weight, Height, BP)
            // For simplicity, we create a new checkup record for "today" or update if it exists for today
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const existingCheckup = await tx.student_health_checkups.findFirst({
                where: {
                    student_id,
                    checkup_date: today
                }
            });

            if (existingCheckup) {
                await tx.student_health_checkups.update({
                    where: { id: existingCheckup.id },
                    data: {
                        weight: weight ?? null,
                        height: height ?? null
                    }
                });
            } else {
                await tx.student_health_checkups.create({
                    data: {
                        student_id,
                        checkup_date: today,
                        weight: weight ?? null,
                        height: height ?? null
                    }
                });
            }

            // 3. Handle Vaccinations (Simple replace match by name)
            if (Array.isArray(vaccinations)) {
                // Delete existing records for this student
                await tx.vaccination_records.deleteMany({
                    where: { student_id }
                });

                for (const v of vaccinations) {
                    if (!v.name) continue;

                    // Find or create vaccine
                    let vaccine = await tx.vaccines.findUnique({
                        where: { name: v.name }
                    });

                    if (!vaccine) {
                        vaccine = await tx.vaccines.create({
                            data: { name: v.name }
                        });
                    }

                    await tx.vaccination_records.create({
                        data: {
                            student_id,
                            vaccine_id: vaccine.id,
                            administered_date: v.date ? new Date(v.date) : new Date(),
                            remark: v.status
                        }
                    });
                }
            }

            // 4. Handle Allergies (Simple split and replace)
            if (typeof allergies === 'string') {
                await tx.student_allergies.deleteMany({ where: { student_id } });
                const allergyNames = allergies.split(',').map(s => s.trim()).filter(Boolean);
                for (const name of allergyNames) {
                    let allergen = await tx.allergens.findUnique({ where: { name } });
                    if (!allergen) allergen = await tx.allergens.create({ data: { name } });
                    await tx.student_allergies.create({
                        data: {
                            student_id,
                            allergen_id: allergen.id
                        }
                    });
                }
            }

            // 5. Handle Chronic Illnesses (Simple split and replace)
            if (typeof chronic_illness === 'string') {
                await tx.student_diseases.deleteMany({ where: { student_id } });
                const diseaseNames = chronic_illness.split(',').map(s => s.trim()).filter(Boolean);
                for (const name of diseaseNames) {
                    let disease = await tx.diseases.findUnique({ where: { name } });
                    if (!disease) disease = await tx.diseases.create({ data: { name } });
                    await tx.student_diseases.create({
                        data: {
                            student_id,
                            disease_id: disease.id
                        }
                    });
                }
            }

            return { success: true };
        });
    }
};
