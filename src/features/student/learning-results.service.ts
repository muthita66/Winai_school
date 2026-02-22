import { prisma } from '@/lib/prisma';

export const LearningResultsService = {
    async getAdvisorEvaluation(student_id: number, year: number, semester: number) {
        if (!student_id || !year || !semester) return [];

        const results = await prisma.advisor_evaluation_results.groupBy({
            by: ['topic'],
            where: {
                student_id: student_id,
                year: year,
                semester: semester
            },
            _avg: {
                score: true
            },
            orderBy: {
                topic: 'asc'
            }
        });

        return results.map(r => ({
            name: r.topic,
            score: r._avg.score ? Math.round(Number(r._avg.score) * 100) / 100 : 0
        }));
    },

    async getSubjectEvaluation(student_id: number, section_id: number, year: number, semester: number, subject_id?: number) {
        if (!student_id || !section_id) return [];

        // Exact section match
        const exactMatches = await prisma.subject_evaluation_results.findMany({
            where: {
                student_id,
                section_id,
                year,
                semester
            },
            select: {
                topic: true,
                score: true
            },
            orderBy: {
                topic: 'asc'
            }
        });

        if (exactMatches.length > 0) {
            return exactMatches;
        }

        // Fallback by subject_id (distinct by topic, latest desc)
        if (subject_id) {
            const subjectMatches = await prisma.subject_evaluation_results.findMany({
                where: {
                    student_id,
                    subject_sections: {
                        subject_id: subject_id
                    }
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            if (subjectMatches.length > 0) {
                // Deduplicate by topic manually
                const uniqueTopics = new Map();
                for (const match of subjectMatches) {
                    if (!uniqueTopics.has(match.topic)) {
                        uniqueTopics.set(match.topic, {
                            topic: match.topic,
                            score: match.score
                        });
                    }
                }

                // Sort by topic ascending
                return Array.from(uniqueTopics.values()).sort((a, b) => a.topic.localeCompare(b.topic));
            }
        }

        // Final fallback by section_id (older term)
        const olderMatches = await prisma.subject_evaluation_results.findMany({
            where: {
                student_id,
                section_id
            },
            orderBy: [
                { year: 'desc' },
                { semester: 'desc' },
                { topic: 'asc' }
            ],
            select: {
                topic: true,
                score: true
            }
        });

        if (olderMatches.length > 0) {
            // Deduplicate by topic manually (taking the first encountered per topic as it is sorted by latest year/term)
            const uniqueTopics = new Map();
            for (const match of olderMatches) {
                if (!uniqueTopics.has(match.topic)) {
                    uniqueTopics.set(match.topic, match);
                }
            }
            return Array.from(uniqueTopics.values());
        }

        return [];
    }
};
