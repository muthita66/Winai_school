import { prisma } from '@/lib/prisma';

export const GradesService = {
    async getGrades(student_id: number, year?: number, semester?: number) {

        // Ensure student_id is defined
        if (!student_id) return [];

        const whereClause: any = {
            student_id: student_id
        };

        if (year || semester) {
            whereClause.subject_sections = {
                ...(year ? { year: year } : {}),
                ...(semester ? { semester: semester } : {})
            };
        }

        // Fetch all registrations matching the criteria and include grades
        const registrations = await prisma.registrations.findMany({
            where: whereClause,
            include: {
                subject_sections: {
                    include: {
                        subjects: true
                    }
                }
            }
        });

        // Fetch grades for this student
        const gradesRecords = await prisma.grades.findMany({
            where: { student_id: student_id }
        });

        // The old SQL used DISTINCT ON (s.subject_code), so we need to deduplicate by subject_code
        // We also want to map to the structure expected by the old frontend
        const uniqueSubjects = new Map();

        registrations.forEach((reg: any) => {
            const subjectCode = reg.subject_sections?.subjects?.subject_code;
            if (!subjectCode) return;

            const sectionId = reg.section_id;
            const gradeRecord = gradesRecords.find(g => g.section_id === sectionId);

            // Simple deduction mapping, but should be accurate if a student only registers once per subject per term
            if (!uniqueSubjects.has(subjectCode) || gradeRecord) {

                uniqueSubjects.set(subjectCode, {
                    subject: reg.subject_sections?.subjects?.name,
                    subject_code: subjectCode,
                    credit: reg.subject_sections?.subjects?.credit,
                    total: gradeRecord?.total_score,
                    grade: gradeRecord?.grade
                });
            }
        });

        // Convert Map back to array and sort by subject_code ASC
        return Array.from(uniqueSubjects.values()).sort((a, b) => {
            return a.subject_code.localeCompare(b.subject_code);
        });
    }
};
