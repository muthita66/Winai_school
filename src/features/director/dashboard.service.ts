import { prisma } from '@/lib/prisma';

interface DashboardFilters {
    gender?: string;
    class_level?: string;
    room?: string;
    subject_id?: number;
}

export const DirectorDashboardService = {
    // Get filter options — deduplicate subjects by subject_code
    async getFilterOptions() {
        const classLevels = await prisma.students.groupBy({ by: ['class_level'], orderBy: { class_level: 'asc' } });
        const rooms = await prisma.students.groupBy({ by: ['class_level', 'room'], orderBy: [{ class_level: 'asc' }, { room: 'asc' }] });
        const allSubjects = await prisma.subjects.findMany({ select: { id: true, subject_code: true, name: true }, orderBy: { subject_code: 'asc' } });
        // Deduplicate by subject_code — keep first occurrence
        const seen = new Set<string>();
        const subjects = allSubjects.filter(s => {
            const key = s.subject_code || `id_${s.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return {
            classLevels: classLevels.map(c => c.class_level).filter(Boolean),
            rooms: rooms.map(r => ({ level: r.class_level, room: r.room })).filter(r => r.level && r.room),
            subjects,
        };
    },

    async getFullDashboard(filters?: DashboardFilters) {
        const studentWhere: any = {};
        if (filters?.gender) studentWhere.gender = { contains: filters.gender, mode: 'insensitive' };
        if (filters?.class_level) studentWhere.class_level = filters.class_level;
        if (filters?.room) studentWhere.room = filters.room;

        const currentYear = new Date().getFullYear();
        const currentBEYear = currentYear + 543;

        // === 1. EXECUTIVE OVERVIEW ===
        const totalStudents = await prisma.students.count({ where: studentWhere });
        const totalTeachers = await prisma.teachers.count();
        const totalSubjects = await prisma.subjects.count();
        const totalSections = await prisma.subject_sections.count();
        let totalActivities = 0;
        try { const r: any[] = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM school_activities'); totalActivities = r[0]?.c || 0; } catch { }

        const male = await prisma.students.count({ where: { ...studentWhere, gender: { contains: 'ชาย', mode: 'insensitive' } } });
        const female = await prisma.students.count({ where: { ...studentWhere, gender: { contains: 'หญิง', mode: 'insensitive' } } });

        // Finance
        let income = 0, expense = 0;
        try {
            const incR: any[] = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0)::float AS total FROM finance_records WHERE type ILIKE 'income' OR type = 'รายรับ'`);
            income = Number(incR[0]?.total || 0);
            const expR: any[] = await prisma.$queryRawUnsafe(`SELECT COALESCE(SUM(amount),0)::float AS total FROM finance_records WHERE type ILIKE 'expense' OR type = 'รายจ่าย'`);
            expense = Number(expR[0]?.total || 0);
        } catch { }
        let financeByCategory: any[] = [];
        try { financeByCategory = await prisma.$queryRawUnsafe(`SELECT category, type, SUM(amount)::float AS total FROM finance_records WHERE category IS NOT NULL AND category != '' GROUP BY category, type ORDER BY total DESC LIMIT 10`); } catch { }

        // Monthly income/expense
        let financeMonthly: any[] = [];
        try {
            financeMonthly = await prisma.$queryRawUnsafe(`
                SELECT TO_CHAR(record_date, 'YYYY-MM') AS month,
                       SUM(CASE WHEN type ILIKE 'income' OR type = 'รายรับ' THEN amount ELSE 0 END)::float AS income,
                       SUM(CASE WHEN type ILIKE 'expense' OR type = 'รายจ่าย' THEN amount ELSE 0 END)::float AS expense
                FROM finance_records GROUP BY month ORDER BY month DESC LIMIT 12
            `) as any[];
        } catch { }

        // === 2. STUDENT ANALYTICS ===
        const studentsByLevel = await prisma.students.groupBy({ by: ['class_level'], where: studentWhere, _count: { id: true }, orderBy: { class_level: 'asc' } });
        const studentsByRoom = await prisma.students.groupBy({ by: ['class_level', 'room'], where: studentWhere, _count: { id: true }, orderBy: [{ class_level: 'asc' }, { room: 'asc' }] });

        // Student IDs for filtered queries
        const studentIds = filters?.gender || filters?.class_level || filters?.room
            ? (await prisma.students.findMany({ where: studentWhere, select: { id: true } })).map(s => s.id)
            : undefined;

        const attWhere: any = studentIds ? { student_id: { in: studentIds } } : {};
        const totalAttendance = await prisma.attendance.count({ where: attWhere });
        const presentCount = await prisma.attendance.count({ where: { ...attWhere, status: 'present' } });
        const absentCount = await prisma.attendance.count({ where: { ...attWhere, status: 'absent' } });
        const lateCount = await prisma.attendance.count({ where: { ...attWhere, status: 'late' } });
        const leaveCount = await prisma.attendance.count({ where: { ...attWhere, status: 'leave' } });
        const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 10000) / 100 : 0;

        // Attendance heatmap (weekly summary)
        let attendanceHeatmap: any[] = [];
        try {
            const heatSql = studentIds
                ? `SELECT TO_CHAR(date, 'YYYY-IW') AS week, status, COUNT(*)::int AS cnt FROM attendance WHERE student_id = ANY(ARRAY[${studentIds.join(',')}]::int[]) AND date IS NOT NULL GROUP BY week, status ORDER BY week DESC LIMIT 60`
                : `SELECT TO_CHAR(date, 'YYYY-IW') AS week, status, COUNT(*)::int AS cnt FROM attendance WHERE date IS NOT NULL GROUP BY week, status ORDER BY week DESC LIMIT 60`;
            attendanceHeatmap = await prisma.$queryRawUnsafe(heatSql) as any[];
        } catch { }

        // Grades
        const gradeWhere: any = {};
        if (studentIds) gradeWhere.student_id = { in: studentIds };
        if (filters?.subject_id) {
            const sectionIds = (await prisma.subject_sections.findMany({ where: { subject_id: filters.subject_id }, select: { id: true } })).map(s => s.id);
            gradeWhere.section_id = { in: sectionIds };
        }
        const gradeDistribution = await prisma.grades.groupBy({ by: ['grade'], where: gradeWhere, _count: { id: true }, orderBy: { grade: 'asc' } });

        // Education quality KPIs
        let gpaAvg = 0, gradeAbove3Pct = 0, gradeFPct = 0;
        try {
            const allGrades = await prisma.grades.findMany({ where: gradeWhere, select: { total_score: true, grade: true } });
            const gradeMap: Record<string, number> = { '4': 4, 'A': 4, '3.5': 3.5, 'B+': 3.5, '3': 3, 'B': 3, '2.5': 2.5, 'C+': 2.5, '2': 2, 'C': 2, '1.5': 1.5, 'D+': 1.5, '1': 1, 'D': 1, '0': 0, 'F': 0 };
            const gpaValues = allGrades.map(g => gradeMap[g.grade || ''] ?? null).filter((v): v is number => v !== null);
            if (gpaValues.length) {
                gpaAvg = Math.round((gpaValues.reduce((a, b) => a + b, 0) / gpaValues.length) * 100) / 100;
                gradeAbove3Pct = Math.round((gpaValues.filter(v => v >= 3).length / gpaValues.length) * 100);
                gradeFPct = Math.round((gpaValues.filter(v => v === 0).length / gpaValues.length) * 100);
            }
        } catch { }

        // Competency stats
        let competencyStats: any[] = [];
        try {
            competencyStats = await prisma.$queryRawUnsafe(`
                SELECT ct.name, AVG(cr.score)::float AS avg_score, COUNT(cr.id)::int AS total
                FROM competency_results cr
                JOIN competency_topics ct ON ct.name = cr.name AND ct.year = cr.year AND ct.semester = cr.semester
                ${studentIds ? `WHERE cr.student_id = ANY(ARRAY[${studentIds.join(',')}]::int[])` : ''}
                GROUP BY ct.name ORDER BY ct.name
            `) as any[];
        } catch { }

        // Registration stats — popular subjects (deduplicated)
        let registrationStats: any[] = [];
        try {
            registrationStats = await prisma.$queryRawUnsafe(`
                SELECT DISTINCT ON (sub.subject_code) sub.subject_code, sub.name, COUNT(r.id)::int AS reg_count
                FROM registrations r
                JOIN subject_sections ss ON r.section_id = ss.id
                JOIN subjects sub ON ss.subject_id = sub.id
                WHERE r.status = 'registered'
                ${studentIds ? `AND r.student_id = ANY(ARRAY[${studentIds.join(',')}]::int[])` : ''}
                GROUP BY sub.id, sub.subject_code, sub.name
                ORDER BY sub.subject_code, reg_count DESC
            `) as any[];
        } catch { }

        // === 3. AT-RISK STUDENTS ===
        const atRiskStudents = await this.getAtRiskStudents(studentWhere, filters?.subject_id);

        // === 4. HR (DETAILED) ===
        const teachersByDept = await prisma.teachers.groupBy({ by: ['department'], _count: { id: true }, orderBy: { department: 'asc' } });
        const teacherStudentRatio = totalTeachers > 0 ? Math.round((totalStudents / totalTeachers) * 10) / 10 : 0;
        const sectionsCount = await prisma.subject_sections.groupBy({ by: ['teacher_id'], _count: { id: true } });
        const avgSectionsPerTeacher = sectionsCount.length > 0 ? Math.round((sectionsCount.reduce((sum, s) => sum + s._count.id, 0) / sectionsCount.length) * 10) / 10 : 0;

        const retirementAge = 60;
        const retirementCutoff = new Date(currentYear - 55, 0, 1);
        const nearRetirementTeachers = await prisma.teachers.findMany({
            where: { birthday: { lt: retirementCutoff } },
            select: { id: true, teacher_code: true, prefix: true, first_name: true, last_name: true, birthday: true, department: true, position: true, academic_rank: true, employment_type: true },
            orderBy: { birthday: 'asc' },
        });
        const nearRetirementList = nearRetirementTeachers.map(t => {
            const age = t.birthday ? currentYear - t.birthday.getFullYear() : 0;
            const retireYear = t.birthday ? t.birthday.getFullYear() + retirementAge : 0;
            const yearsLeft = retireYear - currentYear;
            return { id: t.id, code: t.teacher_code, prefix: t.prefix, firstName: t.first_name, lastName: t.last_name, age, retireYear: retireYear + 543, yearsLeft: Math.max(yearsLeft, 0), department: t.department || 'ไม่ระบุ', position: t.position || '-', academicRank: t.academic_rank || '-' };
        });

        let teachingEvalAvg = 0;
        try { const evalR = await prisma.subject_evaluation_results.aggregate({ _avg: { score: true } }); teachingEvalAvg = Math.round((evalR._avg.score || 0) * 100) / 100; } catch { }

        const teachersByGender = await prisma.teachers.groupBy({ by: ['gender'], _count: { id: true } });
        const teachersByEmpType = await prisma.teachers.groupBy({ by: ['employment_type'], _count: { id: true } });
        const teachersByAcademicRank = await prisma.teachers.groupBy({ by: ['academic_rank'], _count: { id: true } });
        const teachersByPosition = await prisma.teachers.groupBy({ by: ['position'], _count: { id: true } });

        const allTeachers = await prisma.teachers.findMany({ select: { birthday: true } });
        const ageGroups: Record<string, number> = { '≤30': 0, '31-40': 0, '41-50': 0, '51-55': 0, '56-60': 0, 'ไม่ระบุ': 0 };
        for (const t of allTeachers) {
            if (!t.birthday) { ageGroups['ไม่ระบุ']++; continue; }
            const age = currentYear - t.birthday.getFullYear();
            if (age <= 30) ageGroups['≤30']++;
            else if (age <= 40) ageGroups['31-40']++;
            else if (age <= 50) ageGroups['41-50']++;
            else if (age <= 55) ageGroups['51-55']++;
            else ageGroups['56-60']++;
        }

        let teacherWorkload: any[] = [];
        try {
            teacherWorkload = await prisma.$queryRawUnsafe(`
                SELECT t.id, t.teacher_code, t.prefix, t.first_name, t.last_name, t.department,
                       COUNT(ss.id)::int AS section_count
                FROM teachers t JOIN subject_sections ss ON ss.teacher_id = t.id
                GROUP BY t.id ORDER BY section_count DESC LIMIT 10
            `) as any[];
        } catch { }

        // Retirement timeline (group by year)
        const retirementTimeline: Record<number, { year: number; count: number; teachers: string[]; departments: string[] }> = {};
        for (const t of nearRetirementList) {
            if (!retirementTimeline[t.retireYear]) retirementTimeline[t.retireYear] = { year: t.retireYear, count: 0, teachers: [], departments: [] };
            retirementTimeline[t.retireYear].count++;
            retirementTimeline[t.retireYear].teachers.push(`${t.prefix || ''}${t.firstName} ${t.lastName}`);
            if (t.department && !retirementTimeline[t.retireYear].departments.includes(t.department)) retirementTimeline[t.retireYear].departments.push(t.department);
        }

        // Duty teachers this week
        let dutyTeachers: any[] = [];
        try {
            dutyTeachers = await prisma.$queryRawUnsafe(`
                SELECT dt.week_start, t.teacher_code, t.prefix, t.first_name, t.last_name, t.department
                FROM duty_teachers dt JOIN teachers t ON dt.teacher_id = t.id
                WHERE dt.week_start >= CURRENT_DATE - INTERVAL '7 days'
                ORDER BY dt.week_start DESC, t.teacher_code
            `) as any[];
        } catch { }

        // Advisor stats
        let advisorStats: any[] = [];
        try {
            advisorStats = await prisma.$queryRawUnsafe(`
                SELECT ta.class_level, ta.room, COUNT(ta.id)::int AS advisor_count,
                       STRING_AGG(t.prefix || t.first_name || ' ' || t.last_name, ', ' ORDER BY t.teacher_code) AS advisors
                FROM teacher_advisors ta JOIN teachers t ON ta.teacher_id = t.id
                GROUP BY ta.class_level, ta.room ORDER BY ta.class_level, ta.room
            `) as any[];
        } catch { }

        // Teacher effectiveness (avg grades per teacher)
        let teacherEffectiveness: any[] = [];
        try {
            teacherEffectiveness = await prisma.$queryRawUnsafe(`
                SELECT t.teacher_code, t.prefix, t.first_name, t.last_name, t.department,
                       AVG(g.total_score)::float AS avg_score, COUNT(g.id)::int AS grade_count
                FROM teachers t
                JOIN subject_sections ss ON ss.teacher_id = t.id
                JOIN grades g ON g.section_id = ss.id WHERE g.total_score IS NOT NULL
                GROUP BY t.id ORDER BY avg_score DESC LIMIT 15
            `) as any[];
        } catch { }

        // === 5. STUDENT HEALTH ===
        const healthData = await this.getStudentHealthSummary(studentWhere);

        // === 6. PROJECTS ===
        let projects: any[] = [];
        let projectsTotal = 0, projectsBudgetTotal = 0, projectsBudgetUsed = 0;
        try {
            projects = await prisma.$queryRawUnsafe('SELECT * FROM projects ORDER BY year DESC, id DESC LIMIT 30') as any[];
            projectsTotal = projects.length;
            projectsBudgetTotal = projects.reduce((sum: number, p: any) => sum + Number(p.budget_total || 0), 0);
            projectsBudgetUsed = projects.reduce((sum: number, p: any) => sum + Number(p.budget_used || 0), 0);
        } catch { }

        // Project budget by department
        let projectsByDept: any[] = [];
        try {
            projectsByDept = await prisma.$queryRawUnsafe(`
                SELECT department, COUNT(*)::int AS count, SUM(budget_total)::float AS total_budget,
                       SUM(budget_used)::float AS used_budget, AVG(quality_score)::float AS avg_quality, AVG(kpi_score)::float AS avg_kpi
                FROM projects WHERE department IS NOT NULL GROUP BY department ORDER BY total_budget DESC
            `) as any[];
        } catch { }

        // === 7. TOP rooms ===
        let topRooms: any[] = [];
        try {
            let roomSql = `SELECT s.class_level, s.room, AVG(g.total_score)::float AS avg_score, COUNT(g.id)::int AS count FROM grades g JOIN students s ON g.student_id = s.id WHERE g.total_score IS NOT NULL`;
            if (filters?.class_level) roomSql += ` AND s.class_level = '${filters.class_level}'`;
            if (filters?.room) roomSql += ` AND s.room = '${filters.room}'`;
            roomSql += ` GROUP BY s.class_level, s.room ORDER BY avg_score DESC LIMIT 5`;
            topRooms = await prisma.$queryRawUnsafe(roomSql);
        } catch { }

        // === 8. UPCOMING EVENTS ===
        let upcomingEvents: any[] = [];
        try {
            const actEvents: any[] = await prisma.$queryRawUnsafe(`SELECT name, date AS event_date, location, category, 'activity' AS source FROM school_activities WHERE date IS NOT NULL ORDER BY date DESC LIMIT 10`) as any[];
            const calEvents = await prisma.teacher_calendar.findMany({ orderBy: { event_date: 'desc' }, take: 10 });
            upcomingEvents = [
                ...actEvents.map((e: any) => ({ title: e.name, date: e.event_date, location: e.location, category: e.category, source: 'activity' })),
                ...calEvents.map(e => ({ title: e.title, date: e.event_date, location: null, category: null, source: 'calendar' })),
            ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 15);
        } catch { }

        // === 9. CURRICULUM ===
        const curriculumData = await this.getCurriculumSummary();

        // === 10. EVALUATION ===
        const evaluationData = await this.getEvaluationSummary();

        // === 11. ACTION ITEMS ===
        const actionItems = await this.getActionItems(currentYear);

        // === ALERTS ===
        const alerts: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];
        const budgetUsedPct = income > 0 ? Math.round((expense / income) * 100) : 0;
        if (budgetUsedPct > 80) alerts.push({ type: 'danger', message: `งบประมาณใช้ไปแล้ว ${budgetUsedPct}% (เกิน 80%)` });
        if (attendanceRate < 95 && totalAttendance > 0) alerts.push({ type: 'warning', message: `อัตราเข้าเรียน ${attendanceRate}% (ต่ำกว่าเกณฑ์ 95%)` });
        if (atRiskStudents.length > 0) alerts.push({ type: 'danger', message: `พบ ${atRiskStudents.length} นักเรียนเฝ้าระวัง` });
        if (nearRetirementList.length > 0) alerts.push({ type: 'info', message: `ครูใกล้เกษียณ ${nearRetirementList.length} คน (${nearRetirementList.filter(t => t.yearsLeft <= 2).length} คนภายใน 2 ปี)` });
        if (healthData.healthIssues.length > 0) alerts.push({ type: 'warning', message: `นักเรียนมีปัญหาสุขภาพ ${healthData.healthIssues.length} คน` });
        if (gradeFPct > 10) alerts.push({ type: 'danger', message: `นักเรียนได้ F ${gradeFPct}% (เกิน 10%)` });
        if (actionItems.length > 0) alerts.push({ type: 'info', message: `มี ${actionItems.length} รายการที่ต้องดำเนินการ` });

        return {
            summary: { totalStudents, totalTeachers, totalSubjects, totalSections, totalActivities, male, female },
            finance: { income, expense, balance: income - expense, budgetUsedPct, byCategory: financeByCategory, monthly: financeMonthly.reverse() },
            studentsByLevel: studentsByLevel.map(g => ({ level: g.class_level, count: g._count.id })),
            studentsByRoom: studentsByRoom.map(g => ({ level: g.class_level, room: g.room, count: g._count.id })),
            attendance: { total: totalAttendance, present: presentCount, absent: absentCount, late: lateCount, leave: leaveCount, rate: attendanceRate, heatmap: attendanceHeatmap },
            grades: { distribution: gradeDistribution.map(g => ({ grade: g.grade, count: g._count.id })), gpaAvg, gradeAbove3Pct, gradeFPct },
            competencyStats,
            registrationStats,
            atRiskStudents,
            topRooms,
            hr: {
                teachersByDept: teachersByDept.map(g => ({ dept: g.department || 'ไม่ระบุ', count: g._count.id })),
                ratio: teacherStudentRatio, avgSections: avgSectionsPerTeacher,
                nearRetirement: nearRetirementList.length, nearRetirementList,
                evalAvg: teachingEvalAvg,
                byGender: teachersByGender.map(g => ({ gender: g.gender || 'ไม่ระบุ', count: g._count.id })),
                byEmpType: teachersByEmpType.map(g => ({ type: g.employment_type || 'ไม่ระบุ', count: g._count.id })),
                byAcademicRank: teachersByAcademicRank.map(g => ({ rank: g.academic_rank || 'ไม่ระบุ', count: g._count.id })),
                byPosition: teachersByPosition.map(g => ({ position: g.position || 'ไม่ระบุ', count: g._count.id })),
                ageGroups: Object.entries(ageGroups).map(([group, count]) => ({ group, count })),
                workloadTop10: teacherWorkload,
                retirementTimeline: Object.values(retirementTimeline).sort((a, b) => a.year - b.year),
                dutyTeachers,
                advisorStats,
                teacherEffectiveness,
            },
            health: healthData,
            projects: { total: projectsTotal, budgetTotal: projectsBudgetTotal, budgetUsed: projectsBudgetUsed, items: projects, byDept: projectsByDept },
            upcomingEvents,
            curriculum: curriculumData,
            evaluation: evaluationData,
            actionItems,
            alerts,
            advanced: await this.getAdvancedAnalytics(studentWhere, currentYear),
            comparisons: await this.getComparisons(studentWhere),
        };
    },

    async getCurriculumSummary() {
        // Subjects by group (deduplicated)
        let subjectsByGroup: any[] = [];
        try {
            subjectsByGroup = await prisma.$queryRawUnsafe(`
                SELECT COALESCE(subject_group, 'ไม่ระบุ') AS grp, COUNT(DISTINCT subject_code)::int AS count,
                       SUM(COALESCE(credit,0))::float AS total_credits
                FROM subjects GROUP BY grp ORDER BY count DESC
            `) as any[];
        } catch { }

        // Sections without students
        let emptySections: any[] = [];
        try {
            emptySections = await prisma.$queryRawUnsafe(`
                SELECT ss.id, sub.subject_code, sub.name, t.first_name AS teacher_first, t.last_name AS teacher_last, ss.class_level, ss.room
                FROM subject_sections ss
                LEFT JOIN subjects sub ON ss.subject_id = sub.id
                LEFT JOIN teachers t ON ss.teacher_id = t.id
                LEFT JOIN registrations r ON r.section_id = ss.id AND r.status = 'registered'
                WHERE r.id IS NULL
                LIMIT 20
            `) as any[];
        } catch { }

        // Sections without teachers
        const sectionsNoTeacher = await prisma.subject_sections.count({ where: { teacher_id: null } });

        // Subject type distribution (deduplicated)
        let subjectTypes: any[] = [];
        try {
            subjectTypes = await prisma.$queryRawUnsafe(`
                SELECT COALESCE(subject_type, 'ไม่ระบุ') AS type, COUNT(DISTINCT subject_code)::int AS count
                FROM subjects GROUP BY type ORDER BY count DESC
            `) as any[];
        } catch { }

        const totalCredits = await prisma.subjects.aggregate({ _sum: { credit: true } });

        return {
            subjectsByGroup,
            emptySections,
            sectionsNoTeacher,
            subjectTypes,
            totalCredits: Number(totalCredits._sum.credit || 0),
        };
    },

    async getEvaluationSummary() {
        // Advisor evaluation
        let advisorEvalByTopic: any[] = [];
        try {
            advisorEvalByTopic = await prisma.$queryRawUnsafe(`
                SELECT topic, AVG(score)::float AS avg_score, COUNT(*)::int AS total
                FROM advisor_evaluation_results
                GROUP BY topic ORDER BY avg_score DESC
            `) as any[];
        } catch { }

        // Subject evaluation — top/bottom teachers
        let subjectEvalTop: any[] = [];
        let subjectEvalBottom: any[] = [];
        try {
            subjectEvalTop = await prisma.$queryRawUnsafe(`
                SELECT t.teacher_code, t.prefix, t.first_name, t.last_name, t.department,
                       AVG(ser.score)::float AS avg_score, COUNT(ser.id)::int AS eval_count
                FROM subject_evaluation_results ser
                JOIN teachers t ON ser.teacher_id = t.id
                GROUP BY t.id ORDER BY avg_score DESC LIMIT 10
            `) as any[];
            subjectEvalBottom = await prisma.$queryRawUnsafe(`
                SELECT t.teacher_code, t.prefix, t.first_name, t.last_name, t.department,
                       AVG(ser.score)::float AS avg_score, COUNT(ser.id)::int AS eval_count
                FROM subject_evaluation_results ser
                JOIN teachers t ON ser.teacher_id = t.id
                GROUP BY t.id HAVING COUNT(ser.id) >= 3 ORDER BY avg_score ASC LIMIT 10
            `) as any[];
        } catch { }

        // Eval by topic
        let subjectEvalByTopic: any[] = [];
        try {
            subjectEvalByTopic = await prisma.$queryRawUnsafe(`
                SELECT topic, AVG(score)::float AS avg_score, COUNT(*)::int AS total
                FROM subject_evaluation_results GROUP BY topic ORDER BY avg_score DESC
            `) as any[];
        } catch { }

        return { advisorEvalByTopic, subjectEvalTop, subjectEvalBottom, subjectEvalByTopic };
    },

    async getActionItems(currentYear: number) {
        const items: { type: string; priority: 'high' | 'medium' | 'low'; message: string; detail?: string }[] = [];

        // Rooms without advisors
        try {
            const allRooms = await prisma.classroom_master.findMany({ select: { class_level: true, room: true } });
            const advisedRooms = await prisma.teacher_advisors.findMany({ select: { class_level: true, room: true } });
            const advisedSet = new Set(advisedRooms.map(a => `${a.class_level}-${a.room}`));
            const noAdvisor = allRooms.filter(r => !advisedSet.has(`${r.class_level}-${r.room}`));
            if (noAdvisor.length > 0) {
                items.push({ type: 'advisor', priority: 'high', message: `ห้องที่ยังไม่มีที่ปรึกษา ${noAdvisor.length} ห้อง`, detail: noAdvisor.map(r => `${r.class_level}/${r.room}`).join(', ') });
            }
        } catch { }

        // Students not registered
        try {
            const regStudents: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(DISTINCT student_id)::int AS cnt FROM registrations WHERE status = 'registered'`);
            const totalSt = await prisma.students.count();
            const notReg = totalSt - (regStudents[0]?.cnt || 0);
            if (notReg > 0) items.push({ type: 'registration', priority: 'medium', message: `นักเรียนที่ยังไม่ลงทะเบียน ${notReg} คน` });
        } catch { }

        // Sections without teacher
        const noTeacher = await prisma.subject_sections.count({ where: { teacher_id: null } });
        if (noTeacher > 0) items.push({ type: 'section', priority: 'high', message: `Section ที่ยังไม่มีครูสอน ${noTeacher} section` });

        // Teachers near license expiry (check if license_no exists but no recent data)
        try {
            const teachersNoLicense = await prisma.teachers.count({ where: { OR: [{ license_no: null }, { license_no: '' }] } });
            if (teachersNoLicense > 0) items.push({ type: 'license', priority: 'low', message: `ครูที่ยังไม่มีเลขใบอนุญาต ${teachersNoLicense} คน` });
        } catch { }

        return items;
    },

    async getAdvancedAnalytics(studentWhere: any, currentYear: number) {
        let predictiveRisk: any[] = [];
        try {
            // Fetch students matching the current filter to limit scope
            const filteredSt = await prisma.students.findMany({
                where: studentWhere,
                select: { id: true, student_code: true, prefix: true, first_name: true, last_name: true, class_level: true, room: true },
            });
            const stIds = filteredSt.map(s => s.id);

            if (stIds.length > 0) {
                predictiveRisk = await prisma.$queryRawUnsafe(`
                    WITH StudentRisk AS (
                        SELECT s.id, s.student_code, s.prefix, s.first_name, s.last_name, s.class_level, s.room,
                               COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.student_id = s.id AND a.status='absent'), 0)::int AS absent_count,
                               COALESCE((SELECT SUM(ABS(point)) FROM student_conduct c WHERE c.student_id = s.id AND c.point < 0), 0)::int AS conduct_penalty,
                               COALESCE((SELECT COUNT(*) FROM grades g WHERE g.student_id = s.id AND g.grade IN ('F','0','I')), 0)::int AS fail_count
                        FROM students s
                        WHERE s.id = ANY(ARRAY[${stIds.join(',')}]::int[])
                    )
                    SELECT *, 
                           (absent_count * 30 + conduct_penalty * 20 + fail_count * 50) AS risk_score,
                           CASE 
                               WHEN (absent_count * 30 + conduct_penalty * 20 + fail_count * 50) > 200 THEN 'Critical'
                               WHEN (absent_count * 30 + conduct_penalty * 20 + fail_count * 50) > 100 THEN 'Watch'
                               ELSE 'Low Risk'
                           END AS risk_level
                    FROM StudentRisk
                    WHERE (absent_count * 30 + conduct_penalty * 20 + fail_count * 50) > 0
                    ORDER BY risk_score DESC LIMIT 20
                `) as any[];
            }
        } catch { }

        let subjectDifficulty: any[] = [];
        try {
            subjectDifficulty = await prisma.$queryRawUnsafe(`
                SELECT sub.subject_code, sub.name, 
                       COUNT(g.id)::int AS total_students,
                       SUM(CASE WHEN g.grade IN ('F','0','I') THEN 1 ELSE 0 END)::int AS fail_count,
                       (SUM(CASE WHEN g.grade IN ('F','0','I') THEN 1 ELSE 0 END)::float / NULLIF(COUNT(g.id), 0)) * 100 AS f_rate,
                       AVG(g.total_score)::float AS avg_score
                FROM subjects sub
                JOIN subject_sections ss ON ss.subject_id = sub.id
                JOIN grades g ON g.section_id = ss.id
                GROUP BY sub.id, sub.subject_code, sub.name
                HAVING COUNT(g.id) >= 10
                ORDER BY f_rate DESC LIMIT 20
            `) as any[];
        } catch { }

        let teacherWorkloadVsEval: any[] = [];
        try {
            teacherWorkloadVsEval = await prisma.$queryRawUnsafe(`
                SELECT t.teacher_code, t.prefix, t.first_name, t.last_name,
                       COUNT(DISTINCT ss.id)::int AS section_count,
                       AVG(ser.score)::float AS avg_eval
                FROM teachers t
                LEFT JOIN subject_sections ss ON ss.teacher_id = t.id
                LEFT JOIN subject_evaluation_results ser ON ser.teacher_id = t.id
                GROUP BY t.id, t.teacher_code, t.prefix, t.first_name, t.last_name
                HAVING COUNT(DISTINCT ss.id) > 0 AND AVG(ser.score) IS NOT NULL
                ORDER BY section_count DESC
            `) as any[];
        } catch { }

        let competencyRadar: any[] = [];
        try {
            competencyRadar = await prisma.$queryRawUnsafe(`
                SELECT name AS topic, AVG(avg_score)::float AS avg_score
                FROM competency_topics
                GROUP BY name ORDER BY name
            `) as any[];
        } catch { }

        let budgetRoi: any[] = [];
        try {
            budgetRoi = await prisma.$queryRawUnsafe(`
                SELECT department, 
                       COUNT(id)::int AS project_count,
                       SUM(budget_used)::float AS total_used,
                       AVG(quality_score)::float AS avg_quality,
                       AVG(kpi_score)::float AS avg_kpi
                FROM projects 
                WHERE department IS NOT NULL AND budget_used > 0
                GROUP BY department
                ORDER BY avg_quality DESC
            `) as any[];
        } catch { }

        let attendanceFlow: any[] = [];
        try {
            // PostgreSQL specific DOW extraction
            attendanceFlow = await prisma.$queryRawUnsafe(`
                SELECT EXTRACT(ISODOW FROM date)::int AS day_of_week, 
                       COUNT(*)::int AS absent_count
                FROM attendance 
                WHERE status = 'absent' AND date IS NOT NULL
                GROUP BY day_of_week
                ORDER BY day_of_week
            `) as any[];
        } catch { }

        // Basic AI Summary Generator logic
        const executiveSummary: string[] = [];
        if (predictiveRisk.length > 0 && predictiveRisk[0].risk_level === 'Critical') {
            const critCount = predictiveRisk.filter(r => r.risk_level === 'Critical').length;
            executiveSummary.push(`⚠️ พบนักเรียนกลุ่มเสี่ยงระดับวิกฤต (Critical) จำนวน ${critCount} คน (มีแนวโน้มการขาดเรียนเกรดเฉลี่ยต่ำ) โปรดให้ครูแนะแนวเข้าช่วยเหลือด่วน`);
        }
        if (subjectDifficulty.length > 0) {
            const hard = subjectDifficulty[0];
            if (hard.f_rate > 20) {
                executiveSummary.push(`🔴 วิชา ${hard.name} เป็นคอขวดหลักของโรงเรียน มีอัตราเด็กติด F สูงถึง ${Math.round(hard.f_rate)}% (คะแนนรวมเฉลี่ยเพียง ${Math.round(hard.avg_score)})`);
            }
        }
        if (teacherWorkloadVsEval.length > 0) {
            const overloaded = teacherWorkloadVsEval[0];
            if (overloaded.section_count > 10 && overloaded.avg_eval < 3.8) {
                executiveSummary.push(`💡 ครู ${overloaded.first_name} มีภาระงานสอนสูงผิดปกติ (${overloaded.section_count} section) ซึ่งแปรผกผันกับคะแนนประเมินที่เริ่มลดลง (${Math.round(overloaded.avg_eval * 100) / 100}/5)`);
            } else {
                executiveSummary.push(`✅ ภาระงานครูโดยเฉลี่ยอยู่ในจุดสมดุลและไม่ส่งผลกระทบเชิงลบต่อคุณภาพการสอน`);
            }
        }
        if (budgetRoi.length > 0) {
            const bestRoi = budgetRoi[0];
            executiveSummary.push(`🌟 แผนก ${bestRoi.department} ใช้งบประมาณได้มีประสิทธิภาพสูงสุด โดยมีคะแนน Quality Score เฉลี่ย ${Math.round(bestRoi.avg_quality)}/5 เติบโตตามเป้า`);
        }
        if (attendanceFlow.length > 0) {
            // Check max absent day
            const maxAbsentDay = [...attendanceFlow].sort((a, b) => b.absent_count - a.absent_count)[0];
            const thDayMap = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
            if (maxAbsentDay && thDayMap[maxAbsentDay.day_of_week]) {
                executiveSummary.push(`📉 สถิติพบการขาดเรียนสูงผิดปกติในวัน${thDayMap[maxAbsentDay.day_of_week]} (${maxAbsentDay.absent_count} ครั้ง) ฝ่ายปกครองควรตรวจสอบ`);
            }
        }

        return {
            predictiveRisk,
            subjectDifficulty,
            teacherWorkloadVsEval,
            competencyRadar,
            budgetRoi,
            attendanceFlow,
            executiveSummary
        };
    },

    async getAtRiskStudents(studentWhere: any, subjectId?: number) {
        const students = await prisma.students.findMany({
            where: studentWhere,
            select: { id: true, student_code: true, first_name: true, last_name: true, class_level: true, room: true, gender: true, prefix: true },
        });
        if (!students.length) return [];
        const ids = students.map(s => s.id);

        const gradeWhere: any = { student_id: { in: ids }, grade: { in: ['F', '0', 'I'] } };
        if (subjectId) gradeWhere.subject_sections = { subject_id: subjectId };
        const failGrades = await prisma.grades.findMany({
            where: gradeWhere,
            include: { subject_sections: { include: { subjects: true } } },
        });

        const absentCounts: any[] = await prisma.$queryRawUnsafe(`
            SELECT student_id, COUNT(*)::int AS absent_count FROM attendance
            WHERE status = 'absent' AND student_id = ANY(ARRAY[${ids.join(',')}]::int[])
            GROUP BY student_id HAVING COUNT(*) >= 3
        `);

        const conductIssues = await prisma.student_conduct.findMany({
            where: { student_id: { in: ids }, point: { lt: 0 } },
            orderBy: { log_date: 'desc' },
        });

        const riskMap: Record<number, { student: any; reasons: { type: string; detail: string; severity: 'high' | 'medium' | 'low' }[] }> = {};
        const getOrCreate = (studentId: number) => {
            if (!riskMap[studentId]) {
                const s = students.find(st => st.id === studentId);
                if (!s) return null;
                riskMap[studentId] = { student: s, reasons: [] };
            }
            return riskMap[studentId];
        };

        for (const g of failGrades) {
            const entry = getOrCreate(g.student_id!);
            if (!entry) continue;
            const subjectName = g.subject_sections?.subjects?.name || 'ไม่ทราบวิชา';
            entry.reasons.push({ type: 'grade', detail: `เกรด ${g.grade} วิชา ${subjectName}`, severity: 'high' });
        }
        for (const a of absentCounts) {
            const entry = getOrCreate(a.student_id);
            if (!entry) continue;
            entry.reasons.push({ type: 'absent', detail: `ขาดเรียน ${a.absent_count} ครั้ง`, severity: a.absent_count >= 10 ? 'high' : 'medium' });
        }
        const conductByStudent: Record<number, number> = {};
        for (const c of conductIssues) {
            if (!c.student_id) continue;
            conductByStudent[c.student_id] = (conductByStudent[c.student_id] || 0) + Math.abs(c.point || 0);
        }
        for (const [sid, totalPoints] of Object.entries(conductByStudent)) {
            const entry = getOrCreate(Number(sid));
            if (!entry) continue;
            entry.reasons.push({ type: 'conduct', detail: `หักคะแนนพฤติกรรม ${totalPoints} คะแนน`, severity: totalPoints >= 20 ? 'high' : 'medium' });
        }

        return Object.values(riskMap)
            .sort((a, b) => {
                const aHigh = a.reasons.filter(r => r.severity === 'high').length;
                const bHigh = b.reasons.filter(r => r.severity === 'high').length;
                if (bHigh !== aHigh) return bHigh - aHigh;
                return b.reasons.length - a.reasons.length;
            })
            .slice(0, 50);
    },

    async getStudentHealthSummary(studentWhere: any) {
        const filteredStudents = await prisma.students.findMany({
            where: studentWhere,
            select: { id: true, student_code: true, prefix: true, first_name: true, last_name: true, class_level: true, room: true, gender: true },
        });
        const ids = filteredStudents.map(s => s.id);
        if (!ids.length) return { totalChecked: 0, bmi: { underweight: 0, normal: 0, overweight: 0, obese: 0, noData: 0 }, bmiByLevel: [], bloodTypes: [], healthIssues: [], fitnessTests: [], vaccinations: [], visionIssues: 0, allergyCount: 0, chronicCount: 0, totalStudents: 0, allergyRanking: [], fitnessScoreboard: [] };

        const healthRecords = await prisma.student_health.findMany({
            where: { student_id: { in: ids } },
            select: { student_id: true, weight: true, height: true, blood_type: true, allergies: true, chronic_illness: true },
        });

        const bmiCategories = { underweight: 0, normal: 0, overweight: 0, obese: 0, noData: 0 };
        const bmiByLevel: Record<string, { underweight: number; normal: number; overweight: number; obese: number }> = {};

        for (const h of healthRecords) {
            const w = Number(h.weight || 0);
            const heightCm = Number(h.height || 0);
            if (w > 0 && heightCm > 0) {
                const heightM = heightCm > 3 ? heightCm / 100 : heightCm;
                const bmi = w / (heightM * heightM);
                const student = filteredStudents.find(s => s.id === h.student_id);
                const level = student?.class_level || 'ไม่ระบุ';
                if (!bmiByLevel[level]) bmiByLevel[level] = { underweight: 0, normal: 0, overweight: 0, obese: 0 };
                if (bmi < 18.5) { bmiCategories.underweight++; bmiByLevel[level].underweight++; }
                else if (bmi < 25) { bmiCategories.normal++; bmiByLevel[level].normal++; }
                else if (bmi < 30) { bmiCategories.overweight++; bmiByLevel[level].overweight++; }
                else { bmiCategories.obese++; bmiByLevel[level].obese++; }
            } else { bmiCategories.noData++; }
        }

        const bloodTypeMap: Record<string, number> = {};
        for (const h of healthRecords) {
            const bt = h.blood_type?.trim() || 'ไม่ระบุ';
            bloodTypeMap[bt] = (bloodTypeMap[bt] || 0) + 1;
        }
        const bloodTypes = Object.entries(bloodTypeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

        const healthIssues: any[] = [];
        const allergyMap: Record<string, number> = {};
        for (const h of healthRecords) {
            const issues: string[] = [];
            if (h.allergies && h.allergies.trim()) {
                issues.push(`แพ้: ${h.allergies.trim()}`);
                // Track allergy ranking
                const allergyItems = h.allergies.split(/[,;\/]/).map(a => a.trim()).filter(Boolean);
                for (const a of allergyItems) { allergyMap[a] = (allergyMap[a] || 0) + 1; }
            }
            if (h.chronic_illness && h.chronic_illness.trim()) issues.push(`โรคประจำตัว: ${h.chronic_illness.trim()}`);
            if (issues.length > 0) {
                const student = filteredStudents.find(s => s.id === h.student_id);
                if (student) {
                    healthIssues.push({ studentCode: student.student_code, prefix: student.prefix, firstName: student.first_name, lastName: student.last_name, classLevel: student.class_level, room: student.room, issues });
                }
            }
        }

        const allergyRanking = Object.entries(allergyMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15);
        const allergyCount = healthRecords.filter(h => h.allergies && h.allergies.trim()).length;
        const chronicCount = healthRecords.filter(h => h.chronic_illness && h.chronic_illness.trim()).length;

        let visionIssues = 0;
        try {
            const vr: any[] = await prisma.$queryRawUnsafe(`
                SELECT COUNT(*)::int AS cnt FROM health_records
                WHERE student_id = ANY(ARRAY[${ids.join(',')}]::int[])
                AND ((vision_left IS NOT NULL AND vision_left != '' AND vision_left != 'ปกติ')
                OR (vision_right IS NOT NULL AND vision_right != '' AND vision_right != 'ปกติ'))
            `);
            visionIssues = vr[0]?.cnt || 0;
        } catch { }

        let fitnessTests: any[] = [];
        try {
            fitnessTests = await prisma.$queryRawUnsafe(`
                SELECT test_name, COUNT(*)::int AS total,
                       COUNT(*) FILTER (WHERE status ILIKE '%ผ่าน%' OR status = 'pass')::int AS passed,
                       COUNT(*) FILTER (WHERE status ILIKE '%ไม่ผ่าน%' OR status = 'fail')::int AS failed
                FROM student_fitness_tests WHERE student_id = ANY(ARRAY[${ids.join(',')}]::int[])
                GROUP BY test_name ORDER BY test_name
            `) as any[];
        } catch { }

        // Fitness scoreboard by room
        let fitnessScoreboard: any[] = [];
        try {
            fitnessScoreboard = await prisma.$queryRawUnsafe(`
                SELECT s.class_level, s.room,
                       COUNT(*)::int AS total_tests,
                       COUNT(*) FILTER (WHERE ft.status ILIKE '%ผ่าน%' OR ft.status = 'pass')::int AS passed,
                       ROUND(COUNT(*) FILTER (WHERE ft.status ILIKE '%ผ่าน%' OR ft.status = 'pass')::numeric / NULLIF(COUNT(*),0) * 100, 1)::float AS pass_rate
                FROM student_fitness_tests ft JOIN students s ON ft.student_id = s.id
                WHERE ft.student_id = ANY(ARRAY[${ids.join(',')}]::int[])
                GROUP BY s.class_level, s.room ORDER BY pass_rate DESC LIMIT 10
            `) as any[];
        } catch { }

        let vaccinations: any[] = [];
        try {
            vaccinations = await prisma.$queryRawUnsafe(`
                SELECT vaccine_name, COUNT(DISTINCT student_id)::int AS student_count,
                       COUNT(*) FILTER (WHERE status ILIKE '%ฉีดแล้ว%' OR status = 'completed')::int AS completed
                FROM student_vaccinations WHERE student_id = ANY(ARRAY[${ids.join(',')}]::int[])
                GROUP BY vaccine_name ORDER BY student_count DESC
            `) as any[];
        } catch { }

        return {
            totalChecked: healthRecords.length, bmi: bmiCategories,
            bmiByLevel: Object.entries(bmiByLevel).map(([level, data]) => ({ level, ...data })).sort((a, b) => a.level.localeCompare(b.level)),
            bloodTypes, healthIssues, allergyCount, chronicCount, visionIssues,
            fitnessTests, vaccinations, totalStudents: ids.length,
            allergyRanking, fitnessScoreboard,
        };
    },

    async getComparisons(studentWhere: any) {
        let studentWeaknesses: any[] = [];
        try {
            const filteredSt = await prisma.students.findMany({
                where: studentWhere,
                select: { id: true, student_code: true, prefix: true, first_name: true, last_name: true, class_level: true, room: true },
            });
            const stIds = filteredSt.map(s => s.id);
            if (stIds.length > 0) {
                studentWeaknesses = await prisma.$queryRawUnsafe(`
                    SELECT s.student_code, s.prefix, s.first_name, s.last_name, s.class_level, s.room,
                           sub.subject_code, sub.name AS subject_name, g.grade, g.total_score
                    FROM grades g
                    JOIN students s ON g.student_id = s.id
                    JOIN subject_sections ss ON g.section_id = ss.id
                    JOIN subjects sub ON ss.subject_id = sub.id
                    WHERE s.id = ANY(ARRAY[${stIds.join(',')}]::int[])
                      AND g.grade IN ('F', '0', '1', '1.5')
                    ORDER BY g.total_score ASC
                    LIMIT 50
                `) as any[];
            }
        } catch { }

        let bestRoomPerSubject: any[] = [];
        try {
            bestRoomPerSubject = await prisma.$queryRawUnsafe(`
                WITH RoomScores AS (
                    SELECT sub.subject_code, sub.name AS subject_name, 
                           s.class_level, s.room, 
                           AVG(g.total_score)::float AS avg_score,
                           COUNT(g.id)::int AS student_count
                    FROM grades g
                    JOIN students s ON g.student_id = s.id
                    JOIN subject_sections ss ON g.section_id = ss.id
                    JOIN subjects sub ON ss.subject_id = sub.id
                    WHERE g.total_score IS NOT NULL
                    GROUP BY sub.subject_code, sub.name, s.class_level, s.room
                    HAVING COUNT(g.id) >= 5
                ),
                RankedRooms AS (
                    SELECT *, (ROW_NUMBER() OVER(PARTITION BY subject_code ORDER BY avg_score DESC))::int as rnk
                    FROM RoomScores
                )
                SELECT * FROM RankedRooms WHERE rnk = 1 ORDER BY avg_score DESC LIMIT 30
            `) as any[];
        } catch { }

        let teacherPerformance: any[] = [];
        try {
            teacherPerformance = await prisma.$queryRawUnsafe(`
                SELECT t.teacher_code, t.prefix, t.first_name, t.last_name, t.department,
                       AVG(ser.score)::float AS avg_eval,
                       AVG(g.total_score)::float AS avg_grade,
                       COUNT(DISTINCT ss.id)::int AS section_count
                FROM teachers t
                LEFT JOIN subject_evaluation_results ser ON ser.teacher_id = t.id
                LEFT JOIN subject_sections ss ON ss.teacher_id = t.id
                LEFT JOIN grades g ON g.section_id = ss.id AND g.total_score IS NOT NULL
                GROUP BY t.id, t.teacher_code, t.prefix, t.first_name, t.last_name, t.department
                HAVING COUNT(DISTINCT ss.id) > 0 OR AVG(ser.score) IS NOT NULL
                ORDER BY avg_eval DESC NULLS LAST, avg_grade DESC NULLS LAST
            `) as any[];
        } catch { }

        return { studentWeaknesses, bestRoomPerSubject, teacherPerformance };
    }
};
