import { prisma } from '@/lib/prisma';

export const StudentService = {
    /**
     * Get all students with optional filters
     */
    async getAllStudents() {
        try {
            // Prisma maps to the `students` table in backup_db.sql
            const students = await prisma.students.findMany({
                take: 50, // Limit for example
                orderBy: {
                    student_code: 'asc',
                },
            });
            return students;
        } catch (error) {
            console.error('Error fetching students in service:', error);
            throw error;
        }
    },

    /**
     * Get a single student by ID/Code
     */
    async getStudentById(student_code: string) {
        try {
            const student = await prisma.students.findUnique({
                where: { student_code },
            });
            return student;
        } catch (error) {
            console.error('Error fetching student in service:', error);
            throw error;
        }
    },
};
