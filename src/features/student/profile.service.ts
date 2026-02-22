import { prisma } from '@/lib/prisma';

export const ProfileService = {
    async getProfile(student_id: number) {
        if (!student_id) return null;
        return prisma.students.findUnique({
            where: { id: student_id },
            select: {
                id: true,
                student_code: true,
                first_name: true,
                last_name: true,
                class_level: true,
                classroom: true,
                room: true,
                birthday: true,
                phone: true,
                address: true,
                photo_url: true,
                prefix: true
            }
        });
    },

    async updateProfile(student_id: number, data: any) {
        if (!student_id) throw new Error("Student ID is required");
        return prisma.students.update({
            where: { id: student_id },
            data: {
                prefix: data.prefix || null,
                first_name: data.first_name || null,
                last_name: data.last_name || null,
                birthday: data.birthday ? new Date(data.birthday) : null,
                phone: data.phone || null,
                address: data.address || null
            }
        });
    }
};
