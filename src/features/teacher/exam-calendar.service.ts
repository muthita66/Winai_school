import { prisma } from '@/lib/prisma';

export const TeacherExamCalendarService = {
    async getExamSchedule(teacher_id: number) {
        const sections = await prisma.subject_sections.findMany({
            where: { teacher_id },
            select: { id: true }
        });
        const sectionIds = sections.map((s) => s.id);

        let exams = await prisma.exam_schedule.findMany({
            where: sectionIds.length > 0 ? { section_id: { in: sectionIds } } : undefined,
            orderBy: { exam_date: 'asc' }
        });

        let fallbackAll = false;
        if (exams.length === 0) {
            exams = await prisma.exam_schedule.findMany({
                orderBy: { exam_date: 'asc' }
            });
            fallbackAll = true;
        }

        const examSectionIds = Array.from(new Set(
            exams
                .map((e) => e.section_id)
                .filter((id): id is number => typeof id === 'number')
        ));

        const examSections = examSectionIds.length > 0
            ? await prisma.subject_sections.findMany({
                where: { id: { in: examSectionIds } },
                include: { subjects: true, teachers: true }
            })
            : [];
        const sectionMap = new Map(examSections.map((s) => [s.id, s]));

        return exams.map((ex) => {
            const section = ex.section_id ? sectionMap.get(ex.section_id) : undefined;
            const teacherName = section?.teachers
                ? `${section.teachers.first_name || ''} ${section.teachers.last_name || ''}`.trim()
                : null;
            return {
                ...ex,
                subject_code: section?.subjects?.subject_code || null,
                subject_name: section?.subjects?.name || null,
                class_level: section?.class_level || null,
                classroom: section?.classroom || null,
                teacher_name: teacherName || null,
                is_fallback_all: fallbackAll,
            };
        });
    }
};
