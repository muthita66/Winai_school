import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function normalizeAttendanceStatus(status: string | null | undefined) {
    const raw = String(status || '').trim().toLowerCase();

    if (raw === 'present' || raw.includes('มา')) return 'present';
    if (raw === 'absent' || raw.includes('ขาด')) return 'absent';
    if (raw === 'late' || raw.includes('สาย')) return 'late';
    if (raw === 'leave' || raw.includes('ลา')) return 'leave';
    return 'other';
}

export const StudentDashboardService = {
    async getSummary(student_id: number) {
        if (!student_id) {
            return {
                profile: null,
                currentTerm: null,
                stats: {
                    registeredSubjects: 0,
                    completedGrades: 0,
                    pendingGrades: 0,
                    gpa: 0,
                    attendanceRate: 0,
                    conductScore: 100,
                    upcomingActivities: 0,
                },
                attendance: { present: 0, absent: 0, late: 0, leave: 0, total: 0, rate: 0 },
                upcomingActivities: [],
                recentGrades: [],
            };
        }

        const [student, activeSemester] = await Promise.all([
            prisma.students.findUnique({
                where: { id: student_id },
                include: {
                    name_prefixes: true,
                    classrooms: {
                        include: {
                            grade_levels: true,
                        },
                    },
                },
            }),
            prisma.semesters.findFirst({
                where: { is_active: true },
                include: { academic_years: true },
                orderBy: { id: 'desc' },
            }),
        ]);

        if (!student) {
            throw new Error('Student not found');
        }

        const enrollmentWhere: Prisma.enrollmentsWhereInput = { student_id };
        if (activeSemester?.id) {
            const assignments = await prisma.teaching_assignments.findMany({
                where: { semester_id: activeSemester.id },
                select: { id: true },
            });
            enrollmentWhere.teaching_assignment_id = {
                in: assignments.map((ta) => ta.id),
            };
        }

        const [enrollments, attendanceRecords, behaviorRecords, participations] = await Promise.all([
            prisma.enrollments.findMany({
                where: enrollmentWhere,
                include: {
                    teaching_assignments: {
                        include: {
                            subjects: true,
                        },
                    },
                    final_grades: true,
                },
                orderBy: { id: 'desc' },
            }),
            prisma.attendance_records.findMany({
                where: {
                    enrollments: enrollmentWhere,
                },
                select: {
                    status: true,
                },
            }),
            prisma.behavior_records.findMany({
                where: { student_id },
                include: {
                    behavior_rules: true,
                },
            }),
            prisma.event_participants.findMany({
                where: { user_id: student.user_id },
                include: { events: true },
            }),
        ]);

        const attendance = { present: 0, absent: 0, late: 0, leave: 0, total: attendanceRecords.length, rate: 0 };
        for (const record of attendanceRecords) {
            const key = normalizeAttendanceStatus(record.status);
            if (key === 'present') attendance.present += 1;
            if (key === 'absent') attendance.absent += 1;
            if (key === 'late') attendance.late += 1;
            if (key === 'leave') attendance.leave += 1;
        }
        attendance.rate = attendance.total > 0
            ? Math.round(((attendance.present + attendance.late) / attendance.total) * 1000) / 10
            : 0;

        let additions = 0;
        let deductions = 0;
        for (const record of behaviorRecords) {
            const points = record.behavior_rules?.points || 0;
            const type = String(record.behavior_rules?.type || '').toLowerCase();
            if (type === 'reward' || points > 0) additions += Math.abs(points);
            else deductions += Math.abs(points);
        }
        const conductScore = Math.max(0, 100 + additions - deductions);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingActivities = participations
            .filter((p) => p.events.start_datetime >= today)
            .sort((a, b) => a.events.start_datetime.getTime() - b.events.start_datetime.getTime())
            .slice(0, 5)
            .map((p) => ({
                id: p.events.id,
                title: p.events.title,
                start_date: p.events.start_datetime,
                end_date: p.events.end_datetime,
                location: p.events.location || '',
                status: p.status || 'registered',
            }));

        const allGradeRows = enrollments
            .filter((e) => e.teaching_assignments?.subjects)
            .map((e) => ({
                enrollment_id: e.id,
                subject_code: e.teaching_assignments.subjects.subject_code,
                subject_name: e.teaching_assignments.subjects.subject_name,
                total_score: e.final_grades ? Number(e.final_grades.total_score || 0) : null,
                letter_grade: e.final_grades?.letter_grade || null,
                grade_point: e.final_grades?.grade_point != null ? Number(e.final_grades.grade_point) : null,
            }))
            .sort((a, b) => a.subject_code.localeCompare(b.subject_code));

        const recentGrades = allGradeRows.slice(0, 6);

        const graded = allGradeRows.filter((g) => g.grade_point != null);
        const gpa = graded.length > 0
            ? Math.round((graded.reduce((sum, g) => sum + Number(g.grade_point || 0), 0) / graded.length) * 100) / 100
            : 0;

        const prefix = student.name_prefixes?.prefix_name || '';
        const fullName = [prefix, student.first_name, student.last_name].filter(Boolean).join(' ').trim();
        const classLevel = student.classrooms?.grade_levels?.name || '';
        const room = student.classrooms?.room_name || '';

        return {
            profile: {
                id: student.id,
                student_code: student.student_code,
                name: fullName || student.student_code,
                class_level: classLevel,
                room,
            },
            currentTerm: activeSemester ? {
                semester: activeSemester.semester_number,
                year: activeSemester.academic_years?.year_name || '',
            } : null,
            stats: {
                registeredSubjects: enrollments.length,
                completedGrades: allGradeRows.filter((g) => g.letter_grade).length,
                pendingGrades: allGradeRows.filter((g) => !g.letter_grade).length,
                gpa,
                attendanceRate: attendance.rate,
                conductScore,
                upcomingActivities: upcomingActivities.length,
            },
            attendance,
            upcomingActivities,
            recentGrades,
        };
    },
};
