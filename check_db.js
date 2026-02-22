const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const sections = await prisma.subject_sections.findMany({
        select: { year: true, semester: true },
        distinct: ['year', 'semester']
    });
    console.log('Available Year/Semester in subject_sections:');
    console.log(JSON.stringify(sections, null, 2));

    const registrations = await prisma.registrations.count();
    console.log('Total registrations:', registrations);

    const grades = await prisma.grades.count();
    console.log('Total grades:', grades);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
