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
    async getStudentsForTest(teacher_id: number, classLevelOrClassroomId?: number | string, room?: string) {
        void teacher_id;

        let classroomId: number | null = null;

        if (typeof classLevelOrClassroomId === 'number') {
            classroomId = Number.isFinite(classLevelOrClassroomId) ? classLevelOrClassroomId : null;
        } else {
            const classLevel = String(classLevelOrClassroomId || '').trim();
            const roomValue = String(room || '').trim();
            if (!classLevel || !roomValue) return [];

            const levelNo = extractLevelNumber(classLevel);
            const classrooms = await prisma.classrooms.findMany({
                include: { grade_levels: true },
                orderBy: { id: 'asc' },
            });

            const matched = classrooms.find((c) => {
                const gradeName = String(c.grade_levels?.name || '');
                const gradeNo = extractLevelNumber(gradeName);
                const roomName = String(c.room_name || '');
                const levelMatch = gradeName === classLevel || (!!levelNo && !!gradeNo && levelNo === gradeNo);
                const roomMatch = roomName === roomValue || roomName.endsWith(`/${roomValue}`) || roomName.endsWith(` ${roomValue}`);
                return levelMatch && roomMatch;
            });

            classroomId = matched?.id ?? null;
        }

        if (!classroomId) return [];

        const students = await prisma.students.findMany({
            where: { classroom_id: classroomId },
            orderBy: { student_code: 'asc' },
            include: { name_prefixes: true },
        });

        return students.map((s) => ({
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            fitness_tests: [],
        }));
    },

    async saveFitnessTest(data: any) {
        void data;
        return { message: 'ระบบทดสอบสมรรถภาพยังไม่พร้อมใช้งาน' };
    },
};
