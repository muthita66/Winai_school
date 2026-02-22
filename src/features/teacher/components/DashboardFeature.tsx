"use client";
import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";
import Link from "next/link";

export function DashboardFeature({ session }: { session: any }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        TeacherApiService.getDashboardSummary(session.id).then(d => {
            setData(d);
            setLoading(false);
        }).catch(() => setLoading(false));

        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, [session.id]);

    const dateStr = now.toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-slate-500">
                <svg className="w-8 h-8 animate-spin text-emerald-600 mb-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p>กำลังโหลดแดชบอร์ด...</p>
            </div>
        );
    }

    const stats = [
        { label: "จำนวนนักเรียน", value: data?.students || 0, color: "from-blue-500 to-indigo-600", icon: "👨‍🎓", href: "/teacher/students" },
        { label: "รายวิชาที่สอน", value: data?.subjects || 0, color: "from-emerald-500 to-teal-600", icon: "📚", href: "/teacher/scores" },
        { label: "หัวข้อคะแนน", value: data?.scoreItems || 0, color: "from-amber-500 to-orange-600", icon: "📝", href: "/teacher/score_input" },
        { label: "กิจกรรมทั้งหมด", value: data?.allEvents || 0, color: "from-purple-500 to-pink-600", icon: "📅", href: "/teacher/calendar" },
    ];

    return (
        <div className="space-y-6">
            {/* Hero */}
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-teal-500 rounded-full blur-2xl opacity-50"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 backdrop-blur-sm border border-white/20">Teacher Console</div>
                        <h1 className="text-3xl font-bold mb-2">สวัสดี, {session.name || "ครู"}</h1>
                        <div className="flex flex-wrap gap-3 mt-3">
                            <span className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm border border-white/20">📅 {dateStr}</span>
                            <span className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm border border-white/20">🕐 {timeStr}</span>
                            <span className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm border border-white/20">⚡ พร้อมทำงาน</span>
                        </div>
                        <div className="mt-5 flex gap-3">
                            <Link href="/teacher/attendance" className="bg-white text-emerald-700 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all hover:scale-105">เช็คชื่อนักเรียน</Link>
                            <Link href="/teacher/scores" className="bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-xl font-semibold text-sm border border-white/30 hover:bg-white/30 transition-all">กรอกคะแนน</Link>
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 min-w-[220px]">
                        <div className="text-emerald-100 text-sm font-medium mb-3">ภาพรวมวันนี้</div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm"><span className="text-emerald-100">กิจกรรมใกล้ถึง</span><strong className="text-white">{data?.upcomingEvents || 0}</strong></div>
                            <div className="flex justify-between text-sm"><span className="text-emerald-100">นักเรียนทั้งหมด</span><strong className="text-white">{data?.students || 0}</strong></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s, i) => (
                    <Link key={i} href={s.href} className="group bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all hover:-translate-y-0.5">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-2xl shadow-md mb-4`}>{s.icon}</div>
                        <div className="text-sm text-slate-500 font-medium">{s.label}</div>
                        <div className="text-3xl font-bold text-slate-800 mt-1">{s.value}</div>
                    </Link>
                ))}
            </div>

            {/* Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Events */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-slate-800">กิจกรรมล่าสุด</h3>
                        <Link href="/teacher/calendar" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">ดูทั้งหมด →</Link>
                    </div>
                    <div className="space-y-3">
                        {(data?.recentEvents || []).length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-4">ยังไม่มีกิจกรรม</p>
                        ) : (
                            (data?.recentEvents || []).map((ev: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <span className="text-sm text-slate-700 font-medium">{ev.title}</span>
                                    <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">{ev.event_date ? new Date(ev.event_date).toLocaleDateString("th-TH") : "-"}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Tasks */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-bold text-slate-800">งานที่ต้องทำ</h3>
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg font-medium border border-emerald-100">วันนี้</span>
                    </div>
                    <div className="space-y-3">
                        {[
                            { text: "เช็คชื่อนักเรียน", href: "/teacher/attendance" },
                            { text: "บันทึกคะแนน", href: "/teacher/score_input" },
                            { text: "ตรวจสอบตารางสอน", href: "/teacher/calendar" },
                        ].map((task, i) => (
                            <Link key={i} href={task.href} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 transition-colors group">
                                <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-200 group-hover:bg-emerald-500 transition-colors shrink-0"></span>
                                <span className="text-sm text-slate-700 font-medium group-hover:text-emerald-700 transition-colors">{task.text}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
