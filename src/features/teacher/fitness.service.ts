import { prisma } from '@/lib/prisma';

function extractLevelNumber(value: string) {
    const m = String(value || '').match(/(\d+)/);
    return m ? m[1] : '';
}

/**
 * Fitness service is stubbed because current DB has no fitness result tables.
 * It still resolves students by class/room so the page can be used for data entry UI.
 */
export const TeacherFitnessService = {
    async getStudentsForTest(teacher_id: number, classLevel?: string, room?: string) {
        void teacher_id;
        const students = await prisma.students.findMany({
            where: {
                classrooms: {
                    AND: [
                        classLevel && classLevel !== 'ทั้งหมด' ? {
                            OR: [
                                { grade_levels: { name: { contains: extractLevelNumber(classLevel) } } },
                                { grade_levels: { name: classLevel } }
                            ]
                        } : {},
                        room && room !== 'ทั้งหมด' ? {
                            OR: [
                                { room_name: { endsWith: `/${room}` } },
                                { room_name: { endsWith: ` ${room}` } },
                                { room_name: room }
                            ]
                        } : {}
                    ]
                }
            },
            orderBy: [
                { classrooms: { id: 'asc' } },
                { student_code: 'asc' }
            ],
            include: {
                name_prefixes: true,
                classrooms: { include: { grade_levels: true } }
            },
        });

        return students.map((s) => ({
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            class_name: `${s.classrooms?.grade_levels?.name || ''}/${s.classrooms?.room_name || ''}`,
            fitness_tests: [],
        }));
    },
    async getAcademicYears() {
        return prisma.academic_years.findMany({
            orderBy: { year_name: 'desc' },
            select: { id: true, year_name: true, is_active: true }
        });
    },
    async saveFitnessTest(data: any) {
        void data;
        return { message: 'ระบบทดสอบสมรรถภาพยังไม่พร้อมใช้งาน' };
    },
};
