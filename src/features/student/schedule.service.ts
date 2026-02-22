import { prisma } from '@/lib/prisma';

export const ScheduleService = {
    async getClassSchedule(student_id: number, year: number, semester: number) {
        return prisma.registrations.findMany({
            where: {
                student_id,
                year,
                semester,
                // Classes can be seen if they are either in cart or fully registered
                status: { in: ['cart', 'registered'] }
            },
            include: {
                subject_sections: {
                    include: {
                        subjects: true,
                        teachers: true
                    }
                }
            }
        });
    },

    async getExamSchedule(student_id: number, year: number, semester: number) {
        // Find sections the student is registered for
        const registrations = await prisma.registrations.findMany({
            where: {
                student_id,
                year,
                semester,
                status: { in: ['cart', 'registered'] }
            },
            select: { section_id: true }
        });

        const sectionIds = registrations
            .map(r => r.section_id)
            .filter((id): id is number => id !== null);

        if (sectionIds.length === 0) {
            return [];
        }

        // Fetch exam schedules for those sections
        return prisma.exam_schedule.findMany({
            where: {
                section_id: { in: sectionIds }
            },
            orderBy: { exam_date: 'asc' }
        });
    }
};
