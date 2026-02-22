import { prisma } from '@/lib/prisma';

export const EvaluationService = {
    // 1. Get Evaluation Topics
    async getTopics(year?: number, semester?: number) {

        // Seed topics from results if necessary
        if (year && semester) {
            const existingCount = await prisma.competency_topics.count({
                where: { year, semester }
            });

            if (existingCount === 0) {
                // Try to seed from distinct competency_results
                const distinctResults = await prisma.competency_results.findMany({
                    where: { year, semester },
                    distinct: ['name'],
                    select: { name: true },
                    orderBy: { name: 'asc' }
                });

                if (distinctResults.length > 0) {
                    const topicsToCreate = distinctResults.map((r, index) => ({
                        name: r.name,
                        year: year,
                        semester: semester,
                        order_index: index + 1
                    }));

                    await prisma.competency_topics.createMany({
                        data: topicsToCreate,
                        skipDuplicates: true
                    });
                }
            }
        }

        // Fetch topics
        const whereClause: any = {};
        if (year) whereClause.year = year;
        if (semester) whereClause.semester = semester;

        return prisma.competency_topics.findMany({
            where: whereClause,
            orderBy: [
                { order_index: 'asc' },
                { id: 'asc' }
            ],
            select: {
                id: true,
                name: true,
                year: true,
                semester: true,
                order_index: true
            }
        });
    },

    async getCompetencyResults(student_id: number, year: number, semester: number, section_id?: number) {
        if (!student_id || !year || !semester) return [];
        const whereClause: any = { student_id, year, semester };
        if (section_id) whereClause.section_id = section_id;

        return prisma.competency_results.findMany({
            where: whereClause
        });
    },

    // 3. Submit Evaluation
    async submitEvaluation(
        student_id: number,
        year: number,
        semester: number,
        section_id: number | null,
        data: { name: string, score: number }[],
        feedback?: string
    ) {
        if (!student_id || !year || !semester) throw new Error("Missing required evaluation parameters");

        // We use a transaction to ensure clean delete and insert
        return prisma.$transaction(async (tx) => {
            // Delete existing results for the same scope
            const whereClause: any = { student_id, year, semester };
            if (section_id) {
                whereClause.section_id = section_id;

                // Also delete existing feedback if section_id is provided
                await tx.competency_feedback.deleteMany({
                    where: { student_id, section_id, year, semester }
                });
            } else {
                // The old backend also deleted results without section_id
                // If section_id is null, delete all results for that scoped year/semester where section_id is null
                // Note: Old backend `DELETE FROM competency_results WHERE student_id=$1 AND year=$2 AND semester=$3`
                // This would delete ALL results for year/semester regardless of section_id if section_id was falsey.
                // Assuming the intent was scoped deletion, we replicate exactly.
                await tx.competency_results.deleteMany({
                    where: { student_id, year, semester }
                });
            }

            // Insert new feedback if provided and section_id exists
            if (section_id && feedback && feedback.trim().length > 0) {
                await tx.competency_feedback.create({
                    data: {
                        student_id,
                        section_id,
                        year,
                        semester,
                        feedback: feedback.trim()
                    }
                });
            }

            // Insert new result scores
            if (data && data.length > 0) {
                const newResults = data.map(item => ({
                    student_id,
                    section_id: section_id || null, // Allow null section_id
                    name: item.name,
                    score: item.score,
                    year,
                    semester
                }));

                await tx.competency_results.createMany({
                    data: newResults
                });
            }

            return { message: "บันทึกสำเร็จ" };
        });
    }
};
