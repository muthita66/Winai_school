import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function StudentDashboard() {
    const session = await getSession() as any;
    if (!session || session.role !== 'student') {
        redirect('/login');
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">หน้าหลักนักเรียน</h1>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold mb-2">ยินดีต้อนรับ, {session.name}</h2>
                <p className="text-slate-600">รหัสนักเรียน: {session.code}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Quick action cards can go here */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl text-white shadow-md">
                    <h3 className="font-bold text-lg mb-2">ลงทะเบียนเรียน</h3>
                    <p className="text-blue-100 text-sm">ดูวิชาที่เปิดและลงทะเบียน</p>
                </div>
            </div>
        </div>
    );
}
