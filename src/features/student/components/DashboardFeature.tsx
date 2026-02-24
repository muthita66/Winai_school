"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StudentApiService } from '@/services/student-api.service';

type StudentDashboardSession = {
    name?: string;
    code?: string;
    class_level?: string;
    room?: string;
};

type StudentDashboardData = {
    profile?: {
        id?: number;
        student_code?: string;
        name?: string;
        class_level?: string;
        room?: string;
    };
    currentTerm?: {
        semester?: number;
        year?: string;
    } | null;
    stats?: {
        registeredSubjects?: number;
        completedGrades?: number;
        pendingGrades?: number;
        gpa?: number;
        attendanceRate?: number;
        conductScore?: number;
        upcomingActivities?: number;
    };
    attendance?: {
        present?: number;
        absent?: number;
        late?: number;
        leave?: number;
        total?: number;
        rate?: number;
    };
    upcomingActivities?: Array<{
        id: number;
        title: string;
        start_date: string | Date;
        location?: string;
    }>;
    recentGrades?: Array<{
        enrollment_id: number;
        subject_code: string;
        subject_name: string;
        letter_grade?: string | null;
        total_score?: number | null;
    }>;
};

function formatDateTime(value: string | Date | null | undefined) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function DashboardFeature({ session }: { session: StudentDashboardSession }) {
    const [data, setData] = useState<StudentDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        StudentApiService.getDashboardSummary()
            .then((res) => {
                if (!mounted) return;
                setData(res);
                setError(null);
            })
            .catch((err) => {
                if (!mounted) return;
                setError(err?.message || 'Failed to load dashboard');
            })
            .finally(() => {
                if (!mounted) return;
                setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-slate-500">
                กำลังโหลดแดชบอร์ดนักเรียน...
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 rounded-2xl p-8 border border-red-200 text-red-700">
                โหลดข้อมูลไม่สำเร็จ: {error}
            </div>
        );
    }

    const profile = data?.profile || {};
    const stats = data?.stats || {};
    const attendance = data?.attendance || {};
    const currentTerm = data?.currentTerm;

    const cards = [
        { label: 'วิชาที่ลงทะเบียน', value: stats.registeredSubjects ?? 0, href: '/student/registration', color: 'from-blue-500 to-indigo-600' },
        { label: 'กิจกรรมที่กำลังจะมา', value: stats.upcomingActivities ?? 0, href: '/student/activities', color: 'from-emerald-500 to-teal-600' },
        { label: 'การเข้าเรียน (%)', value: stats.attendanceRate ?? 0, href: '/student/schedule', color: 'from-amber-500 to-orange-600' },
        { label: 'คะแนนความประพฤติ', value: stats.conductScore ?? 0, href: '/student/conduct', color: 'from-fuchsia-500 to-pink-600' },
    ];

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-sky-600 to-cyan-700 text-white rounded-3xl p-7 shadow-lg">
                <div className="flex flex-col lg:flex-row justify-between gap-5">
                    <div>
                        <div className="text-sm bg-white/15 border border-white/20 inline-flex px-3 py-1 rounded-full">
                            Student Dashboard
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold mt-3">
                            สวัสดี, {profile.name || session.name || 'นักเรียน'}
                        </h1>
                        <p className="text-sky-100 mt-2">
                            รหัสนักเรียน: {profile.student_code || session.code || '-'}
                        </p>
                        <p className="text-sky-100 text-sm">
                            ชั้น {profile.class_level || session.class_level || '-'} / ห้อง {profile.room || session.room || '-'}
                        </p>
                    </div>
                    <div className="bg-white/10 border border-white/15 rounded-2xl p-4 min-w-[240px]">
                        <div className="text-sm text-sky-100 mb-2">ภาคเรียนปัจจุบัน</div>
                        {currentTerm ? (
                            <>
                                <div className="text-xl font-bold">ภาคเรียนที่ {currentTerm.semester}</div>
                                <div className="text-sky-100">ปีการศึกษา {currentTerm.year}</div>
                            </>
                        ) : (
                            <div className="text-sky-100">ยังไม่พบภาคเรียนที่ active</div>
                        )}
                        <div className="mt-4 text-xs text-sky-100">
                            GPA (ข้อมูลที่มี): {Number(stats.gpa ?? 0).toFixed(2)}
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card) => (
                    <Link
                        key={card.label}
                        href={card.href}
                        className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} mb-3`} />
                        <div className="text-sm text-slate-500">{card.label}</div>
                        <div className="text-3xl font-bold text-slate-800">{card.value}</div>
                    </Link>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">สรุปการเข้าเรียน</h2>
                        <Link href="/student/schedule" className="text-sm text-cyan-700 hover:text-cyan-800">
                            ดูตารางเรียน
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                            <div className="text-xs text-emerald-700">มาเรียน</div>
                            <div className="text-2xl font-bold text-emerald-800">{attendance.present ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                            <div className="text-xs text-red-700">ขาดเรียน</div>
                            <div className="text-2xl font-bold text-red-800">{attendance.absent ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                            <div className="text-xs text-amber-700">มาสาย</div>
                            <div className="text-2xl font-bold text-amber-800">{attendance.late ?? 0}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                            <div className="text-xs text-slate-600">รวมทั้งหมด</div>
                            <div className="text-2xl font-bold text-slate-800">{attendance.total ?? 0}</div>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-slate-800">กิจกรรมที่กำลังจะมา</h2>
                        <Link href="/student/activities" className="text-sm text-cyan-700 hover:text-cyan-800">
                            ดูทั้งหมด
                        </Link>
                    </div>
                    {(data?.upcomingActivities || []).length === 0 ? (
                        <p className="text-sm text-slate-500">ยังไม่มีกิจกรรมที่ลงทะเบียนไว้</p>
                    ) : (
                        <div className="space-y-3">
                            {(data?.upcomingActivities || []).map((item) => (
                                <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">{formatDateTime(item.start_date)}</div>
                                    <div className="text-xs text-slate-500">{item.location || '-'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800">สรุปผลการเรียน (ล่าสุด)</h2>
                    <Link href="/student/grades" className="text-sm text-cyan-700 hover:text-cyan-800">
                        ดูผลการเรียน
                    </Link>
                </div>
                {(data?.recentGrades || []).length === 0 ? (
                    <p className="text-sm text-slate-500">ยังไม่มีข้อมูลผลการเรียน</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="py-2 pr-3 text-xs font-semibold text-slate-500">รหัสวิชา</th>
                                    <th className="py-2 pr-3 text-xs font-semibold text-slate-500">วิชา</th>
                                    <th className="py-2 pr-3 text-xs font-semibold text-slate-500 text-center">เกรด</th>
                                    <th className="py-2 pr-3 text-xs font-semibold text-slate-500 text-center">คะแนน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.recentGrades || []).map((row) => (
                                    <tr key={row.enrollment_id} className="border-b border-slate-100">
                                        <td className="py-2 pr-3 text-sm text-slate-700">{row.subject_code}</td>
                                        <td className="py-2 pr-3 text-sm text-slate-700">{row.subject_name}</td>
                                        <td className="py-2 pr-3 text-sm text-slate-800 text-center font-semibold">{row.letter_grade || '-'}</td>
                                        <td className="py-2 pr-3 text-sm text-slate-600 text-center">
                                            {row.total_score == null ? '-' : Number(row.total_score).toFixed(1)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
