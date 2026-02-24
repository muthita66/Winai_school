import { prisma } from '@/lib/prisma';

function toNum(v: any) {
    const n = Number(v);
    return isNaN(n) ? null : n;
}

export const TeacherStudentsService = {
    // Get advisory students (students in classrooms where this teacher teaches)
    async getAdvisoryStudents(teacher_id: number, year?: number, semester?: number) {
        // Find classrooms where this teacher has teaching assignments
        const assignmentWhere: any = { teacher_id };
        if (year || semester) {
            assignmentWhere.semesters = {};
            if (semester) assignmentWhere.semesters.semester_number = semester;
            if (year) assignmentWhere.semesters.academic_years = { year_name: String(year) };
        }

        const assignments = await prisma.teaching_assignments.findMany({
            where: assignmentWhere,
            select: { classroom_id: true },
            distinct: ['classroom_id']
        });

        const classroomIds = assignments
            .map(a => a.classroom_id)
            .filter((id): id is number => id !== null);

        if (classroomIds.length === 0) return [];

        const students = await prisma.students.findMany({
            where: { classroom_id: { in: classroomIds } },
            include: {
                name_prefixes: true,
                classrooms: { include: { grade_levels: true } },
                genders: true,
                student_statuses: true,
            },
            orderBy: { student_code: 'asc' }
        });

        return students.map(s => ({
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: s.genders?.name || '',
            class_level: s.classrooms?.grade_levels?.name || '',
            room: s.classrooms?.room_name || '',
            status: s.student_statuses?.status_name || 'active',
        }));
    },

    // Get student basic profile
    async getStudentProfile(student_id: number) {
        if (!student_id) return null;
        const s = await prisma.students.findUnique({
            where: { id: student_id },
            include: {
                name_prefixes: true,
                classrooms: { include: { grade_levels: true, programs: true } },
                genders: true,
                student_statuses: true,
            }
        });
        if (!s) return null;
        return {
            id: s.id,
            student_code: s.student_code,
            prefix: s.name_prefixes?.prefix_name || '',
            first_name: s.first_name,
            last_name: s.last_name,
            gender: s.genders?.name || '',
            class_level: s.classrooms?.grade_levels?.name || '',
            room: s.classrooms?.room_name || '',
            program: s.classrooms?.programs?.name || '',
            status: s.student_statuses?.status_name || '',
            date_of_birth: s.date_of_birth,
            phone: s.phone || '',
            address: s.address || '',
        };
    },

    // Get full student profile for teacher view (grades, attendance, conduct, etc.)
    async getStudentProfileForTeacher(teacher_id: number, student_id: number) {
        if (!teacher_id || !student_id) return null;

        // 1. Basic profile
        const profile = await this.getStudentProfile(student_id);
        if (!profile) return null;

        // 2. Enrollment summary — get all subjects enrolled
        const enrollments = await prisma.enrollments.findMany({
            where: { student_id },
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                        teachers: { include: { name_prefixes: true } },
                        semesters: { include: { academic_years: true } },
                    }
                },
                final_grades: true,
                student_scores: {
                    include: { assessment_items: true }
                }
            }
        });

        // 3. Grades summary
        const grades = enrollments.map(e => {
            const ta = e.teaching_assignments;
            let totalScore = 0;
            let maxPossible = 0;
            e.student_scores.forEach(sc => {
                totalScore += Number(sc.score || 0);
                maxPossible += Number(sc.assessment_items?.max_score || 0);
            });

            return {
                subject_code: ta.subjects?.subject_code || '',
                subject_name: ta.subjects?.subject_name || '',
                credit: ta.subjects?.credit ? Number(ta.subjects.credit) : 0,
                total_score: totalScore,
                max_possible: maxPossible,
                percentage: maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) / 100 : 0,
                grade: e.final_grades?.letter_grade || null,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
            };
        });

        // 4. Attendance summary
        const enrollmentIds = enrollments.map(e => e.id);
        let attendanceSummary = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };

        if (enrollmentIds.length > 0) {
            const records = await prisma.attendance_records.findMany({
                where: { enrollment_id: { in: enrollmentIds } }
            });

            records.forEach(r => {
                attendanceSummary.total++;
                const status = r.status?.toLowerCase() || '';
                if (status === 'present' || status === 'มา') attendanceSummary.present++;
                else if (status === 'absent' || status === 'ขาด') attendanceSummary.absent++;
                else if (status === 'late' || status === 'สาย') attendanceSummary.late++;
                else if (status === 'leave' || status === 'ลา') attendanceSummary.leave++;
            });
        }

        // 5. Conduct / behavior summary
        const behaviorRecords = await prisma.behavior_records.findMany({
            where: { student_id },
            include: { behavior_rules: true },
            orderBy: { incident_date: 'desc' },
            take: 20
        });

        let conductScore = 100;
        behaviorRecords.forEach(r => {
            const points = r.behavior_rules?.points || 0;
            const type = r.behavior_rules?.type || '';
            if (type === 'REWARD' || type === 'reward' || points > 0) {
                conductScore += Math.abs(points);
            } else {
                conductScore -= Math.abs(points);
            }
        });

        const conductHistory = behaviorRecords.map(r => ({
            date: r.incident_date,
            rule: r.behavior_rules?.name || '',
            type: r.behavior_rules?.type || '',
            points: r.behavior_rules?.points || 0,
            remark: r.remark || '',
        }));

        return {
            profile,
            grades,
            attendance: attendanceSummary,
            conduct: {
                score: conductScore,
                history: conductHistory,
            },
        };
    },
};
