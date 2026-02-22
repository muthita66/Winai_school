import { prisma } from '@/lib/prisma';

export const TeacherAttendanceService = {
    async getAttendanceList(teacher_id: number, section_id: number, date: string) {
        const students = await prisma.registrations.findMany({
            where: { section_id },
            include: { students: true },
            distinct: ['student_id']
        });

        const existing = await prisma.attendance.findMany({
            where: { section_id, date: new Date(date) }
        });

        return students.map(r => {
            const student = r.students;
            if (!student) return null;
            const record = existing.find(a => a.student_id === student.id);
            return {
                student_id: student.id,
                student_code: student.student_code,
                first_name: student.first_name,
                last_name: student.last_name,
                status: record?.status || null,
                attendance_id: record?.id || null
            };
        }).filter(Boolean);
    },
    async saveAttendance(records: { student_id: number; section_id: number; date: string; status: string }[]) {
        for (const rec of records) {
            const existing = await prisma.attendance.findFirst({
                where: { student_id: rec.student_id, section_id: rec.section_id, date: new Date(rec.date) }
            });
            if (existing) {
                await prisma.attendance.update({
                    where: { id: existing.id },
                    data: { status: rec.status }
                });
            } else {
                await prisma.attendance.create({
                    data: {
                        student_id: rec.student_id,
                        section_id: rec.section_id,
                        date: new Date(rec.date),
                        status: rec.status
                    }
                });
            }
        }
        return { success: true };
    }
};
