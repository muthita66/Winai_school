import { prisma } from '@/lib/prisma';

export const GradesService = {
    async getGrades(student_id: number, year?: number, semester?: number) {
        if (!student_id) return [];

        // Build where clause
        const enrollmentWhere: any = { student_id };

        if (year || semester) {
            enrollmentWhere.teaching_assignments = {
                semesters: {
                    ...(year ? { academic_years: { year_name: String(year) } } : {}),
                    ...(semester ? { semester_number: semester } : {}),
                }
            };
        }

        const enrollments = await prisma.enrollments.findMany({
            where: enrollmentWhere,
            include: {
                teaching_assignments: {
                    include: {
                        subjects: true,
                        semesters: {
                            include: { academic_years: true }
                        },
                        grade_categories: {
                            include: {
                                assessment_items: {
                                    include: {
                                        student_scores: {
                                            where: { enrollments: { student_id } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                final_grades: {
                    include: { grade_scales: true }
                }
            }
        });

        // Deduplicate by subject_code
        const uniqueSubjects = new Map();

        enrollments.forEach(enrollment => {
            const ta = enrollment.teaching_assignments;
            const subject = ta.subjects;
            if (!subject) return;

            // Calculate total score from assessment items
            let totalScore = 0;
            let maxPossible = 0;

            ta.grade_categories.forEach(cat => {
                cat.assessment_items.forEach(item => {
                    maxPossible += Number(item.max_score || 0);
                    const studentScore = item.student_scores?.[0];
                    if (studentScore) {
                        totalScore += Number(studentScore.score || 0);
                    }
                });
            });

            const finalGrade = enrollment.final_grades;

            uniqueSubjects.set(subject.subject_code, {
                subject_code: subject.subject_code,
                subject: subject.subject_name,
                credit: Number(subject.credit || 0),
                total: finalGrade ? Number(finalGrade.total_score) : totalScore,
                grade: finalGrade?.letter_grade || null,
                grade_point: finalGrade?.grade_point ? Number(finalGrade.grade_point) : null,
                year: ta.semesters?.academic_years?.year_name || '',
                semester: ta.semesters?.semester_number || 0,
            });
        });

        return Array.from(uniqueSubjects.values()).sort((a, b) =>
            a.subject_code.localeCompare(b.subject_code)
        );
    }
};
