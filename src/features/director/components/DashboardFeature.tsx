"use client";
import { useState, useEffect, useCallback } from "react";
import { DirectorApiService } from "@/services/director-api.service";
import Link from "next/link";

// === Pure CSS/SVG Chart Components ===
function Gauge({ value, max = 100, label, color }: { value: number; max?: number; label: string; color: string }) {
    const pct = Math.min(Math.round((value / max) * 100), 100);
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct}, 100`} strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold text-slate-800">{pct}%</span></div>
            </div>
            <span className="text-xs text-slate-500 font-medium text-center leading-tight">{label}</span>
        </div>
    );
}

function BarChart({ data, height = 140 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-1.5 justify-around" style={{ height }}>
            {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-600">{d.value}</span>
                    <div className="w-full rounded-t-md transition-all duration-500" style={{ height: `${Math.max((d.value / max) * (height - 30), 4)}px`, background: d.color || `hsl(${210 + i * 30}, 70%, 50%)`, minWidth: 16 }} />
                    <span className="text-[9px] text-slate-500 truncate w-full text-center" title={d.label}>{d.label}</span>
                </div>
            ))}
        </div>
    );
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    let cumPct = 0;
    const segments = data.map(d => { const pct = (d.value / total) * 100; const start = cumPct; cumPct += pct; return { ...d, pct, start }; });
    const gradient = segments.map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ');
    return (
        <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full relative shrink-0" style={{ background: `conic-gradient(${gradient})` }}>
                <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center"><span className="text-sm font-bold text-slate-700">{total.toLocaleString()}</span></div>
            </div>
            <div className="space-y-1 min-w-0">{segments.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} /><span className="text-slate-600 truncate">{s.label}</span><span className="font-bold text-slate-800 ml-auto">{s.value.toLocaleString()}</span></div>
            ))}</div>
        </div>
    );
}

// === MAIN ===
export function DashboardFeature({ session }: { session: any }) {
    const [d, setD] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<string>('overview');
    const [filterOptions, setFilterOptions] = useState<any>(null);
    const [filters, setFilters] = useState<{ gender: string; class_level: string; room: string; subject_id: string }>({ gender: '', class_level: '', room: '', subject_id: '' });
    const [expandedRisk, setExpandedRisk] = useState<number | null>(null);

    useEffect(() => { DirectorApiService.getFilterOptions().then(setFilterOptions).catch(() => { }); }, []);

    const loadData = useCallback(() => {
        setLoading(true);
        const f: any = {};
        if (filters.gender) f.gender = filters.gender;
        if (filters.class_level) f.class_level = filters.class_level;
        if (filters.room) f.room = filters.room;
        if (filters.subject_id) f.subject_id = Number(filters.subject_id);
        DirectorApiService.getSummary(f).then(data => { setD(data); setLoading(false); }).catch(() => setLoading(false));
    }, [filters]);

    useEffect(() => { loadData(); }, [loadData]);

    const filteredRooms = filterOptions?.rooms?.filter((r: any) => !filters.class_level || r.level === filters.class_level) || [];
    const updateFilter = (key: string, value: string) => { const next = { ...filters, [key]: value }; if (key === 'class_level') next.room = ''; setFilters(next); };
    const clearFilters = () => setFilters({ gender: '', class_level: '', room: '', subject_id: '' });
    const hasFilters = Object.values(filters).some(v => !!v);

    if (!d && loading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /><p className="text-slate-500 font-medium">กำลังโหลด Executive Dashboard...</p></div>);
    if (!d) return <div className="bg-white rounded-2xl p-12 text-center text-slate-500">ไม่สามารถโหลดข้อมูลได้</div>;

    const s = d.summary || {};
    const f = d.finance || {};
    const att = d.attendance || {};
    const hr = d.hr || {};
    const proj = d.projects || {};
    const health = d.health || {};
    const cur = d.curriculum || {};
    const evalData = d.evaluation || {};
    const actItems = d.actionItems || [];
    const events = d.upcomingEvents || [];
    const grades = d.grades || {};
    const alerts = d.alerts || [];
    const atRisk = d.atRiskStudents || [];
    const adv = d.advanced || {};
    const exSummary = adv.executiveSummary || [];
    const advRisk = adv.predictiveRisk || [];
    const advSubjDif = adv.subjectDifficulty || [];
    const advWorkload = adv.teacherWorkloadVsEval || [];
    const advCompetency = adv.competencyRadar || [];
    const advRoi = adv.budgetRoi || [];
    const advAtt = adv.attendanceFlow || [];
    const comparisons = d.comparisons || {};
    const tabs = [
        { id: 'overview', label: '📊 ภาพรวม' },
        { id: 'students', label: `👨‍🎓 นักเรียน ${atRisk.length ? `(⚠️${atRisk.length})` : ''}` },
        { id: 'hr', label: `👩‍🏫 บุคลากร ${hr.nearRetirement ? `(⏰${hr.nearRetirement})` : ''}` },
        { id: 'health', label: `🏥 สุขภาพ ${health.healthIssues?.length ? `(⚠️${health.healthIssues.length})` : ''}` },
        { id: 'curriculum', label: '📚 หลักสูตร' },
        { id: 'evaluation', label: '📝 ผลประเมิน' },
        { id: 'finance', label: '💰 งบประมาณ' },
        { id: 'projects', label: '📌 โครงการ' },
        { id: 'comparisons', label: '📈 เปรียบเทียบ' },
        { id: 'actions', label: `🔔 ดำเนินการ ${actItems.length ? `(${actItems.length})` : ''}` },
    ];

    return (
        <div className="space-y-5">
            {/* ─── HERO ─── */}
            <section className="bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 rounded-3xl p-7 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-white/5 to-transparent" />
                <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-white/10">Executive Dashboard</span>
                            <span className="bg-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-medium text-emerald-300 border border-emerald-500/20">● Live</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight">สวัสดี, {session.name || "ผู้อำนวยการ"}</h1>
                        <p className="text-indigo-200 text-sm">ปีการศึกษา {new Date().getFullYear() + 543} • {new Date().toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex gap-2">
                        {[{ v: s.totalStudents, l: 'นักเรียน' }, { v: s.totalTeachers, l: 'ครู' }, { v: s.totalSubjects, l: 'วิชา' }].map((c, i) => (
                            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10 text-center min-w-[70px]">
                                <div className="text-xl font-bold">{c.v || 0}</div><div className="text-[10px] text-indigo-200">{c.l}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FILTER PANEL ─── */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-slate-700">🎛 ตัวกรอง</span>
                    {hasFilters && <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg font-medium">✕ ล้างทั้งหมด</button>}
                    {loading && <span className="text-xs text-indigo-500 animate-pulse ml-auto">กำลังโหลด...</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">เพศ</label>
                        <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={filters.gender} onChange={e => updateFilter('gender', e.target.value)}>
                            <option value="">ทั้งหมด</option>
                            <option value="ชาย">ชาย</option>
                            <option value="หญิง">หญิง</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">ระดับชั้น</label>
                        <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={filters.class_level} onChange={e => updateFilter('class_level', e.target.value)}>
                            <option value="">ทุกชั้น</option>
                            {(filterOptions?.classLevels || []).map((l: string) => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">ห้อง</label>
                        <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={filters.room} onChange={e => updateFilter('room', e.target.value)}>
                            <option value="">ทุกห้อง</option>
                            {filteredRooms.map((r: any, i: number) => <option key={i} value={r.room}>{r.level}/{r.room}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">วิชา (กรองเกรด)</label>
                        <select className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={filters.subject_id} onChange={e => updateFilter('subject_id', e.target.value)}>
                            <option value="">ทุกวิชา</option>
                            {(filterOptions?.subjects || []).map((s: any) => <option key={s.id} value={s.id}>{s.subject_code} - {s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* ─── ALERTS ─── */}
            {alerts.length > 0 && (
                <div className="space-y-2">
                    {alerts.map((a: any, i: number) => (
                        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium ${a.type === 'danger' ? 'bg-red-50 border-red-200 text-red-700' : a.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                            <span>{a.type === 'danger' ? '🔴' : a.type === 'warning' ? '🟡' : '🔵'}</span>
                            <span>{a.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── TABS ─── */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ════════════ TAB: OVERVIEW ════════════ */}
            {tab === 'overview' && (
                <div className="space-y-5">
                    {/* EXECUTIVE SUMMARY (AI-like Insights) */}
                    {exSummary.length > 0 && (
                        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-2xl p-6 shadow-lg text-white">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">🤖 Executive Smart Summary</h3>
                            <div className="space-y-3">
                                {exSummary.map((text: string, i: number) => (
                                    <div key={i} className="flex items-start gap-3 bg-white/10 rounded-xl p-3 border border-white/10 backdrop-blur-sm">
                                        <div className="text-sm leading-relaxed">{text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-5">🎯 ตัวชี้วัดหลัก (KPI)</h3>
                        <div className="flex flex-wrap justify-around gap-6">
                            <Gauge value={att.rate || 0} label="อัตราเข้าเรียน" color={att.rate >= 95 ? '#10b981' : att.rate >= 80 ? '#f59e0b' : '#ef4444'} />
                            <Gauge value={f.budgetUsedPct || 0} label="งบประมาณใช้ไป" color={f.budgetUsedPct <= 60 ? '#10b981' : f.budgetUsedPct <= 80 ? '#f59e0b' : '#ef4444'} />
                            <Gauge value={s.totalTeachers && s.totalStudents ? Math.min(Math.round((s.totalTeachers / (s.totalStudents / 20)) * 100), 100) : 0} label="อัตราครูเพียงพอ" color="#6366f1" />
                            <Gauge value={hr.evalAvg ? Math.round((hr.evalAvg / 5) * 100) : 0} label="ผลประเมินครู" color="#8b5cf6" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: "นักเรียน", value: s.totalStudents, icon: "👨‍🎓", g: "from-blue-500 to-indigo-600", href: "/director/students" },
                            { label: "ครู", value: s.totalTeachers, icon: "👩‍🏫", g: "from-emerald-500 to-teal-600", href: "/director/teachers" },
                            { label: "รายวิชา", value: s.totalSubjects, icon: "📚", g: "from-amber-500 to-orange-600", href: "/director/subjects" },
                            { label: "กิจกรรม", value: s.totalActivities, icon: "📅", g: "from-purple-500 to-pink-600", href: "/director/activities" },
                        ].map((c, i) => (
                            <Link key={i} href={c.href} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:-translate-y-0.5 transition-all">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.g} flex items-center justify-center text-lg mb-2`}>{c.icon}</div>
                                <div className="text-xs text-slate-500">{c.label}</div>
                                <div className="text-2xl font-bold text-slate-800">{(c.value || 0).toLocaleString()}</div>
                            </Link>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">👥 สัดส่วนเพศ</h3>
                            <DonutChart data={[
                                { label: 'ชาย', value: s.male || 0, color: '#3b82f6' },
                                { label: 'หญิง', value: s.female || 0, color: '#ec4899' },
                                { label: 'ไม่ระบุ', value: Math.max(0, (s.totalStudents || 0) - (s.male || 0) - (s.female || 0)), color: '#cbd5e1' },
                            ].filter(x => x.value > 0)} />
                        </div>
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">💰 การเงิน</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between p-2.5 rounded-xl bg-green-50 border border-green-200"><span className="text-sm text-green-700">รายรับ</span><span className="font-bold text-green-700">{(f.income || 0).toLocaleString()} ฿</span></div>
                                <div className="flex justify-between p-2.5 rounded-xl bg-red-50 border border-red-200"><span className="text-sm text-red-700">รายจ่าย</span><span className="font-bold text-red-700">{(f.expense || 0).toLocaleString()} ฿</span></div>
                                <div className={`flex justify-between p-2.5 rounded-xl border ${f.balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}><span className="text-sm" style={{ color: f.balance >= 0 ? '#1d4ed8' : '#dc2626' }}>คงเหลือ</span><span className="font-bold" style={{ color: f.balance >= 0 ? '#1d4ed8' : '#dc2626' }}>{(f.balance || 0).toLocaleString()} ฿</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Education Quality KPIs */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { l: "GPA เฉลี่ย", v: grades.gpaAvg || 0, ic: "🎓", g: "from-indigo-500 to-violet-600" },
                            { l: "เกรด ≥3", v: `${grades.gradeAbove3Pct || 0}%`, ic: "📈", g: "from-emerald-500 to-teal-600" },
                            { l: "เกรด F", v: `${grades.gradeFPct || 0}%`, ic: "📉", g: grades.gradeFPct > 10 ? "from-red-500 to-rose-600" : "from-slate-400 to-slate-500" },
                        ].map((c, i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.g} flex items-center justify-center text-lg mb-2`}>{c.ic}</div>
                                <div className="text-[10px] text-slate-500">{c.l}</div><div className="text-xl font-bold text-slate-800">{c.v}</div>
                            </div>
                        ))}
                    </div>

                    {/* Upcoming Events */}
                    {events.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-200"><h3 className="font-bold text-slate-800">📅 กิจกรรม/ปฏิทินล่าสุด</h3></div>
                            <div className="divide-y divide-slate-50 max-h-[250px] overflow-y-auto">
                                {events.map((e: any, i: number) => (
                                    <div key={i} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
                                        <span className="text-lg">{e.source === 'activity' ? '🎪' : '📋'}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-slate-800 truncate">{e.title}</div>
                                            {e.location && <div className="text-[10px] text-slate-500">📍 {e.location}</div>}
                                        </div>
                                        <span className="text-[10px] text-slate-400 shrink-0">{e.date ? new Date(e.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ TAB: STUDENTS ════════════ */}
            {tab === 'students' && (
                <div className="space-y-5">
                    {/* Attendance Stats */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4">📋 สถิติการเข้าเรียน</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {[
                                { l: "ทั้งหมด", v: att.total, c: "bg-slate-100 text-slate-700 border-slate-200" },
                                { l: "มาเรียน", v: att.present, c: "bg-green-50 text-green-700 border-green-200" },
                                { l: "ขาดเรียน", v: att.absent, c: "bg-red-50 text-red-700 border-red-200" },
                                { l: "มาสาย", v: att.late, c: "bg-amber-50 text-amber-700 border-amber-200" },
                                { l: "ลา", v: att.leave, c: "bg-blue-50 text-blue-700 border-blue-200" },
                            ].map((a, i) => (
                                <div key={i} className={`rounded-xl p-3 border text-center ${a.c}`}><div className="text-xl font-bold">{(a.v || 0).toLocaleString()}</div><div className="text-[10px] font-medium mt-0.5">{a.l}</div></div>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-sm text-slate-600">อัตราเข้าเรียน:</span>
                            <span className={`text-lg font-bold ${att.rate >= 95 ? 'text-green-600' : att.rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{att.rate || 0}%</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${att.rate >= 95 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{att.rate >= 95 ? '✅ ผ่าน' : '⚠️ ต่ำ'}</span>
                        </div>
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📊 จำนวนแยกระดับชั้น</h3>
                            <BarChart data={(d.studentsByLevel || []).map((l: any) => ({ label: l.level || '-', value: l.count, color: '#6366f1' }))} height={150} />
                        </div>
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📈 การกระจายเกรด {filters.subject_id ? '(เฉพาะวิชาที่เลือก)' : ''}</h3>
                            <BarChart data={(d.grades?.distribution || []).map((g: any) => ({ label: g.grade || '-', value: g.count, color: g.grade === 'A' || g.grade === '4' ? '#10b981' : g.grade === 'F' || g.grade === '0' ? '#ef4444' : '#6366f1' }))} height={150} />
                        </div>
                    </div>

                    {/* Attendance Flow Pattern */}
                    {advAtt.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">🌊 รูปแบบการขาดเรียน (รายวัน)</h3>
                            <BarChart data={advAtt.map((a: any) => {
                                const thDayMap: Record<number, string> = { 1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัส', 5: 'ศุกร์', 6: 'เสาร์', 7: 'อาทิตย์' };
                                return { label: thDayMap[a.day_of_week] || a.day_of_week, value: a.absent_count, color: '#f59e0b' };
                            })} height={120} />
                        </div>
                    )}

                    {/* ═══ AT-RISK STUDENTS PANEL (PREDICTIVE MATRIX) ═══ */}
                    <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-red-50 to-amber-50 border-b border-red-200 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-red-800 flex items-center gap-2">🚨 นักเรียนเฝ้าระวัง</h3>
                                <p className="text-xs text-red-600 mt-0.5">นักเรียนที่มีความเสี่ยงด้านวิชาการ / เข้าเรียน / พฤติกรรม</p>
                            </div>
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold border border-red-200">{atRisk.length} คน</span>
                        </div>
                        {atRisk.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">✅ ไม่พบนักเรียนเฝ้าระวังจากเงื่อนไขที่เลือก</div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                {atRisk.map((entry: any, i: number) => {
                                    const st = entry.student;
                                    const reasons = entry.reasons || [];
                                    const highCount = reasons.filter((r: any) => r.severity === 'high').length;
                                    const isExpanded = expandedRisk === i;

                                    return (
                                        <div key={st.id || i} className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-red-50/30' : ''}`}>
                                            <button onClick={() => setExpandedRisk(isExpanded ? null : i)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                                                <span className="text-sm text-slate-400 w-6 shrink-0">{i + 1}</span>
                                                {/* Severity Indicator */}
                                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${highCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`} />
                                                {/* Student Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-slate-800 truncate">
                                                        {st.prefix || ''}{st.first_name || ''} {st.last_name || ''}
                                                        <span className="text-slate-400 font-normal ml-2">{st.student_code}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">{st.class_level}/{st.room} • {st.gender}</div>
                                                </div>
                                                {/* Risk Tags */}
                                                <div className="flex gap-1 shrink-0">
                                                    {reasons.some((r: any) => r.type === 'grade') && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">เกรด</span>}
                                                    {reasons.some((r: any) => r.type === 'absent') && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">ขาด</span>}
                                                    {reasons.some((r: any) => r.type === 'conduct') && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700">พฤติกรรม</span>}
                                                </div>
                                                <span className="text-slate-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                                            </button>
                                            {/* Expanded Detail */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 pl-14 space-y-1.5">
                                                    {reasons.map((r: any, j: number) => (
                                                        <div key={j} className={`flex items-start gap-2 text-sm p-2.5 rounded-lg border ${r.severity === 'high' ? 'bg-red-50 border-red-200 text-red-700' : r.severity === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                                                            <span className="shrink-0">{r.type === 'grade' ? '📉' : r.type === 'absent' ? '🚫' : '⚠️'}</span>
                                                            <div>
                                                                <span className="font-medium">{r.type === 'grade' ? 'ผลการเรียน' : r.type === 'absent' ? 'การเข้าเรียน' : 'พฤติกรรม'}: </span>
                                                                <span>{r.detail}</span>
                                                            </div>
                                                            <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${r.severity === 'high' ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>{r.severity === 'high' ? 'สูง' : 'ปานกลาง'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Top rooms & room table */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">🏆 Top 5 ห้องคะแนนสูงสุด</h3>
                            <div className="space-y-2">
                                {(d.topRooms || []).length === 0 ? <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p> : (d.topRooms || []).map((r: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-slate-400' : 'bg-amber-700'}`}>{i + 1}</span><span className="text-sm font-medium text-slate-800">{r.class_level}/{r.room}</span></div>
                                        <span className="text-sm font-bold text-indigo-600">{Number(r.avg_score || 0).toFixed(1)} ({r.count}คน)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-3 border-b border-slate-200"><h3 className="font-bold text-slate-800 text-sm">📋 จำนวนนักเรียนรายห้อง</h3></div>
                            <div className="overflow-y-auto max-h-[200px]">
                                <table className="w-full"><thead className="sticky top-0"><tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ชั้น</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ห้อง</th>
                                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">จำนวน</th>
                                </tr></thead><tbody>{(d.studentsByRoom || []).map((r: any, i: number) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50"><td className="px-3 py-1.5 text-xs text-slate-800">{r.level || '-'}</td><td className="px-3 py-1.5 text-xs text-slate-600">{r.room || '-'}</td><td className="px-3 py-1.5 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">{r.count}</span></td></tr>
                                ))}</tbody></table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════ TAB: HR (DETAILED) ════════════ */}
            {tab === 'hr' && (
                <div className="space-y-5">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { l: "ครูทั้งหมด", v: s.totalTeachers, ic: "👩‍🏫", g: "from-indigo-500 to-violet-600" },
                            { l: "ครู:นักเรียน", v: `1:${hr.ratio}`, ic: "⚖️", g: "from-emerald-500 to-teal-600" },
                            { l: "Section/ครู", v: hr.avgSections, ic: "📚", g: "from-amber-500 to-orange-600" },
                            { l: "ใกล้เกษียณ", v: hr.nearRetirement, ic: "⏰", g: "from-red-500 to-rose-600" },
                            { l: "ผลประเมิน", v: `${hr.evalAvg || 0}/5`, ic: "⭐", g: "from-purple-500 to-pink-600" },
                        ].map((c, i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.g} flex items-center justify-center text-lg mb-2`}>{c.ic}</div>
                                <div className="text-[10px] text-slate-500">{c.l}</div><div className="text-xl font-bold text-slate-800">{c.v}</div>
                            </div>
                        ))}
                    </div>

                    {/* Near-Retirement Detail Table */}
                    {(hr.nearRetirementList || []).length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
                            <div className="p-4 bg-gradient-to-r from-red-50 to-amber-50 border-b border-red-200">
                                <h3 className="font-bold text-red-800 flex items-center gap-2">⏰ รายชื่อครูใกล้เกษียณอายุราชการ</h3>
                                <p className="text-xs text-red-600 mt-0.5">ครูที่มีอายุ 55 ปีขึ้นไป (เกษียณเมื่ออายุ 60 ปี)</p>
                            </div>
                            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="sticky top-0">
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">#</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">รหัส</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ชื่อ-สกุล</th>
                                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">อายุ</th>
                                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">เหลือ</th>
                                            <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">ปีเกษียณ (พ.ศ.)</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">กลุ่มสาระ</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ตำแหน่ง</th>
                                            <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">วิทยฐานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(hr.nearRetirementList || []).map((t: any, i: number) => (
                                            <tr key={t.id || i} className={`border-b border-slate-50 hover:bg-slate-50 ${t.yearsLeft <= 1 ? 'bg-red-50' : t.yearsLeft <= 3 ? 'bg-amber-50/50' : ''}`}>
                                                <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                                                <td className="px-3 py-2 text-xs text-slate-600 font-mono">{t.code}</td>
                                                <td className="px-3 py-2 text-xs text-slate-800 font-medium">{t.prefix}{t.firstName} {t.lastName}</td>
                                                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.age >= 59 ? 'bg-red-100 text-red-700' : t.age >= 57 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{t.age} ปี</span></td>
                                                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.yearsLeft <= 1 ? 'bg-red-200 text-red-800 animate-pulse' : t.yearsLeft <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{t.yearsLeft} ปี</span></td>
                                                <td className="px-3 py-2 text-center text-xs text-slate-600">{t.retireYear}</td>
                                                <td className="px-3 py-2 text-xs text-slate-600">{t.department}</td>
                                                <td className="px-3 py-2 text-xs text-slate-600">{t.position}</td>
                                                <td className="px-3 py-2 text-xs text-slate-600">{t.academicRank}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Demographics Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Gender */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">👥 สัดส่วนเพศบุคลากร</h3>
                            <DonutChart data={(hr.byGender || []).map((g: any) => ({
                                label: g.gender, value: g.count,
                                color: g.gender === 'ชาย' ? '#3b82f6' : g.gender === 'หญิง' ? '#ec4899' : '#cbd5e1'
                            }))} />
                        </div>
                        {/* Department */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📊 แยกตามกลุ่มสาระ</h3>
                            <BarChart data={(hr.teachersByDept || []).map((t: any) => ({ label: (t.dept || '').substring(0, 10), value: t.count, color: '#8b5cf6' }))} height={150} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Employment Type */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📋 ประเภทการจ้าง</h3>
                            <BarChart data={(hr.byEmpType || []).map((t: any, i: number) => ({ label: (t.type || '').substring(0, 12), value: t.count, color: `hsl(${200 + i * 40}, 60%, 50%)` }))} height={140} />
                        </div>
                        {/* Academic Rank */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">🎓 วิทยฐานะ</h3>
                            <BarChart data={(hr.byAcademicRank || []).map((r: any, i: number) => ({ label: (r.rank || '').substring(0, 12), value: r.count, color: `hsl(${280 + i * 30}, 60%, 50%)` }))} height={140} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Age Distribution */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📈 กลุ่มอายุบุคลากร</h3>
                            <BarChart data={(hr.ageGroups || []).map((g: any) => ({
                                label: g.group, value: g.count,
                                color: g.group === '56-60' ? '#ef4444' : g.group === '51-55' ? '#f59e0b' : '#6366f1'
                            }))} height={140} />
                        </div>
                        {/* Eval Gauge */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-4">
                            <h3 className="font-bold text-slate-800">⭐ ผลประเมินการสอนเฉลี่ย</h3>
                            <Gauge value={hr.evalAvg ? Math.round((hr.evalAvg / 5) * 100) : 0} label={`เฉลี่ย ${hr.evalAvg || 0} / 5`} color="#8b5cf6" />
                        </div>
                    </div>

                    {/* Teacher Workload Top 10 */}
                    {(hr.workloadTop10 || []).length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-200">
                                <h3 className="font-bold text-slate-800">📚 Top 10 ภาระงานสอน (จำนวน Section)</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead><tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">#</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">รหัส</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ชื่อ-สกุล</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">กลุ่มสาระ</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">จำนวน Section</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ภาระงาน</th>
                                    </tr></thead>
                                    <tbody>{(hr.workloadTop10 || []).map((t: any, i: number) => {
                                        const maxSec = hr.workloadTop10[0]?.section_count || 1;
                                        return (
                                            <tr key={t.id || i} className="border-b border-slate-50 hover:bg-slate-50">
                                                <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                                                <td className="px-3 py-2 text-xs text-slate-600 font-mono">{t.teacher_code}</td>
                                                <td className="px-3 py-2 text-xs text-slate-800 font-medium">{t.prefix}{t.first_name} {t.last_name}</td>
                                                <td className="px-3 py-2 text-xs text-slate-600">{t.department || '-'}</td>
                                                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.section_count >= 8 ? 'bg-red-100 text-red-700' : t.section_count >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{t.section_count}</span></td>
                                                <td className="px-3 py-2"><div className="h-2 bg-slate-100 rounded-full overflow-hidden w-24"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(t.section_count / maxSec) * 100}%` }} /></div></td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ TAB: HEALTH ════════════ */}
            {tab === 'health' && (
                <div className="space-y-5">
                    {/* Health KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {[
                            { l: "ตรวจสุขภาพแล้ว", v: `${health.totalChecked || 0}/${health.totalStudents || 0}`, ic: "🩺", g: "from-emerald-500 to-teal-600" },
                            { l: "BMI ปกติ", v: health.bmi?.normal || 0, ic: "✅", g: "from-green-500 to-emerald-600" },
                            { l: "มีอาการแพ้", v: health.allergyCount || 0, ic: "🤧", g: "from-amber-500 to-orange-600" },
                            { l: "โรคประจำตัว", v: health.chronicCount || 0, ic: "💊", g: "from-red-500 to-rose-600" },
                            { l: "ปัญหาสายตา", v: health.visionIssues || 0, ic: "👁️", g: "from-purple-500 to-violet-600" },
                        ].map((c, i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.g} flex items-center justify-center text-lg mb-2`}>{c.ic}</div>
                                <div className="text-[10px] text-slate-500">{c.l}</div><div className="text-xl font-bold text-slate-800">{typeof c.v === 'number' ? c.v.toLocaleString() : c.v}</div>
                            </div>
                        ))}
                    </div>

                    {/* BMI & Blood Type */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📊 ดัชนีมวลกาย (BMI)</h3>
                            {health.bmi ? (
                                <DonutChart data={[
                                    { label: `ผอม (${health.bmi.underweight})`, value: health.bmi.underweight || 0, color: '#60a5fa' },
                                    { label: `ปกติ (${health.bmi.normal})`, value: health.bmi.normal || 0, color: '#34d399' },
                                    { label: `น้ำหนักเกิน (${health.bmi.overweight})`, value: health.bmi.overweight || 0, color: '#fbbf24' },
                                    { label: `อ้วน (${health.bmi.obese})`, value: health.bmi.obese || 0, color: '#f87171' },
                                    { label: `ไม่มีข้อมูล (${health.bmi.noData})`, value: health.bmi.noData || 0, color: '#cbd5e1' },
                                ].filter(x => x.value > 0)} />
                            ) : <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
                        </div>
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">🩸 หมู่เลือด</h3>
                            {(health.bloodTypes || []).length > 0 ? (
                                <BarChart data={(health.bloodTypes || []).map((b: any, i: number) => ({
                                    label: b.type || '-', value: b.count,
                                    color: b.type === 'A' ? '#ef4444' : b.type === 'B' ? '#3b82f6' : b.type === 'AB' ? '#8b5cf6' : b.type === 'O' ? '#f59e0b' : '#94a3b8'
                                }))} height={150} />
                            ) : <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
                        </div>
                    </div>

                    {/* BMI by Level */}
                    {(health.bmiByLevel || []).length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📈 BMI แยกตามระดับชั้น</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead><tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ระดับชั้น</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-blue-600">ผอม</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-green-600">ปกติ</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-amber-600">น้ำหนักเกิน</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-red-600">อ้วน</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">สัดส่วน</th>
                                    </tr></thead>
                                    <tbody>{(health.bmiByLevel || []).map((lvl: any, i: number) => {
                                        const total = lvl.underweight + lvl.normal + lvl.overweight + lvl.obese || 1;
                                        return (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                                <td className="px-3 py-2 text-xs font-medium text-slate-800">{lvl.level}</td>
                                                <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">{lvl.underweight}</span></td>
                                                <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700">{lvl.normal}</span></td>
                                                <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">{lvl.overweight}</span></td>
                                                <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">{lvl.obese}</span></td>
                                                <td className="px-3 py-2"><div className="flex h-3 rounded-full overflow-hidden w-32 bg-slate-100">
                                                    <div className="bg-blue-400" style={{ width: `${(lvl.underweight / total) * 100}%` }} />
                                                    <div className="bg-green-400" style={{ width: `${(lvl.normal / total) * 100}%` }} />
                                                    <div className="bg-amber-400" style={{ width: `${(lvl.overweight / total) * 100}%` }} />
                                                    <div className="bg-red-400" style={{ width: `${(lvl.obese / total) * 100}%` }} />
                                                </div></td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Health Issues List */}
                    {(health.healthIssues || []).length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                                <h3 className="font-bold text-amber-800 flex items-center gap-2">⚠️ นักเรียนที่มีปัญหาสุขภาพ</h3>
                                <p className="text-xs text-amber-600 mt-0.5">นักเรียนที่มีอาการแพ้ / โรคประจำตัว ที่ต้องเฝ้าระวัง</p>
                            </div>
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="sticky top-0"><tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">#</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">รหัส</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ชื่อ-สกุล</th>
                                        <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">ชั้น/ห้อง</th>
                                        <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">รายละเอียด</th>
                                    </tr></thead>
                                    <tbody>{(health.healthIssues || []).map((h: any, i: number) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-amber-50/30">
                                            <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td>
                                            <td className="px-3 py-2 text-xs text-slate-600 font-mono">{h.studentCode}</td>
                                            <td className="px-3 py-2 text-xs text-slate-800 font-medium">{h.prefix}{h.firstName} {h.lastName}</td>
                                            <td className="px-3 py-2 text-center text-xs text-slate-600">{h.classLevel}/{h.room}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {(h.issues || []).map((issue: string, j: number) => (
                                                        <span key={j} className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border ${issue.startsWith('แพ้') ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{issue}</span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Fitness Tests & Vaccinations */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Fitness Test Results */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">🏃 ผลสมรรถภาพทางกาย</h3>
                            {(health.fitnessTests || []).length > 0 ? (
                                <div className="space-y-2">
                                    {(health.fitnessTests || []).map((ft: any, i: number) => {
                                        const passRate = ft.total > 0 ? Math.round((ft.passed / ft.total) * 100) : 0;
                                        return (
                                            <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-xs font-medium text-slate-800 truncate" title={ft.test_name}>{(ft.test_name || '').substring(0, 25)}</span>
                                                    <div className="flex gap-1 shrink-0">
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700">ผ่าน {ft.passed}</span>
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700">ไม่ผ่าน {ft.failed}</span>
                                                    </div>
                                                </div>
                                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all ${passRate >= 80 ? 'bg-green-500' : passRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${passRate}%` }} />
                                                </div>
                                                <div className="text-[9px] text-slate-500 mt-0.5 text-right">{passRate}% ผ่าน ({ft.total} คน)</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-sm text-slate-500">ไม่มีข้อมูลผลสมรรถภาพ</p>}
                        </div>

                        {/* Vaccination Coverage */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">💉 ข้อมูลวัคซีน</h3>
                            {(health.vaccinations || []).length > 0 ? (
                                <div className="space-y-2">
                                    {(health.vaccinations || []).map((v: any, i: number) => {
                                        const rate = v.student_count > 0 ? Math.round((v.completed / v.student_count) * 100) : 0;
                                        return (
                                            <div key={i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-xs font-medium text-slate-800">{v.vaccine_name}</span>
                                                    <span className="text-[10px] text-slate-500">{v.completed}/{v.student_count} คน</span>
                                                </div>
                                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full transition-all ${rate >= 90 ? 'bg-emerald-500' : rate >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                                                </div>
                                                <div className="text-[9px] text-slate-500 mt-0.5 text-right">ครอบคลุม {rate}%</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <p className="text-sm text-slate-500">ไม่มีข้อมูลวัคซีน</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════ TAB: FINANCE (ENHANCED) ════════════ */}
            {tab === 'finance' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-md"><div className="text-green-100 text-sm mb-1">💰 รายรับ</div><div className="text-2xl font-bold">{(f.income || 0).toLocaleString()} ฿</div></div>
                        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 text-white shadow-md"><div className="text-red-100 text-sm mb-1">💸 รายจ่าย</div><div className="text-2xl font-bold">{(f.expense || 0).toLocaleString()} ฿</div></div>
                        <div className={`rounded-2xl p-5 text-white shadow-md ${f.balance >= 0 ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-red-600 to-red-800'}`}><div className="text-sm mb-1 opacity-80">📊 คงเหลือ</div><div className="text-2xl font-bold">{(f.balance || 0).toLocaleString()} ฿</div></div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-3"><h3 className="font-bold text-slate-800">งบใช้ไป</h3><span className={`text-lg font-bold ${f.budgetUsedPct > 80 ? 'text-red-600' : f.budgetUsedPct > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>{f.budgetUsedPct || 0}%</span></div>
                        <div className="h-5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all ${f.budgetUsedPct > 80 ? 'bg-red-500' : f.budgetUsedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${f.budgetUsedPct || 0}%` }} /></div>
                    </div>
                    {/* Monthly Chart */}
                    {(f.monthly || []).length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📈 รายรับ-รายจ่ายรายเดือน</h3>
                            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">{(f.monthly || []).map((m: any, i: number) => {
                                const maxVal = Math.max(...(f.monthly || []).map((x: any) => Math.max(x.income || 0, x.expense || 0)), 1);
                                return (<div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="text-[10px] font-medium text-slate-600 mb-1">{m.month}</div>
                                    <div className="flex gap-2 items-center"><div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${(m.income / maxVal) * 100}%` }} /></div><span className="text-[9px] text-green-700 w-20 text-right">{Number(m.income || 0).toLocaleString()}</span></div>
                                    <div className="flex gap-2 items-center"><div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${(m.expense / maxVal) * 100}%` }} /></div><span className="text-[9px] text-red-700 w-20 text-right">{Number(m.expense || 0).toLocaleString()}</span></div>
                                </div>);
                            })}</div>
                        </div>
                    )}
                    {(f.byCategory || []).length > 0 && <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200"><h3 className="font-bold text-slate-800 mb-3">📂 แยกตามหมวด</h3><div className="space-y-1.5">{(f.byCategory || []).map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"><div className="flex items-center gap-2"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.type === 'รายรับ' || c.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.type}</span><span className="text-sm font-medium text-slate-800">{c.category}</span></div><span className="text-sm font-bold text-slate-700">{Number(c.total || 0).toLocaleString()} ฿</span></div>
                    ))}</div></div>}
                </div>
            )}

            {/* ════════════ TAB: PROJECTS (ENHANCED) ════════════ */}
            {tab === 'projects' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200"><div className="text-xs text-slate-500">📌 โครงการ</div><div className="text-2xl font-bold text-slate-800">{proj.total || 0}</div></div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200"><div className="text-xs text-slate-500">💰 งบรวม</div><div className="text-xl font-bold text-indigo-700">{(proj.budgetTotal || 0).toLocaleString()} ฿</div></div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200"><div className="text-xs text-slate-500">💸 เบิกจ่าย</div><div className="text-xl font-bold text-amber-700">{(proj.budgetUsed || 0).toLocaleString()} ฿</div>{proj.budgetTotal > 0 && <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round((proj.budgetUsed / proj.budgetTotal) * 100)}%` }} /></div>}</div>
                    </div>
                    {/* By Department */}
                    {(proj.byDept || []).length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📊 งบโครงการแยกตามแผนก</h3>
                            <BarChart data={(proj.byDept || []).map((d: any, i: number) => ({ label: (d.department || '').substring(0, 10), value: Number(d.total_budget || 0), color: `hsl(${210 + i * 40}, 60%, 50%)` }))} height={140} />
                        </div>
                    )}
                    {/* Budget ROI (Cost vs Quality) */}
                    {advRoi.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📈 ความคุ้มค่าการลงทุน (Budget ROI & Quality)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {advRoi.map((r: any, i: number) => {
                                    const costPerPoint = r.avg_quality > 0 ? (r.total_used / r.avg_quality) : 0;
                                    return (
                                        <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-2">
                                            <div className="flex justify-between items-start">
                                                <span className="text-sm font-bold text-slate-800">{r.department}</span>
                                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{r.project_count} โครงการ</span>
                                            </div>
                                            <div className="flex items-end justify-between mt-2">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 mb-0.5">งบที่ใช้ (฿)</div>
                                                    <div className="text-sm font-bold text-amber-600">{parseFloat(r.total_used).toLocaleString()}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-slate-500 mb-0.5">Quality / KPI</div>
                                                    <div className="text-sm font-bold text-indigo-600">{parseFloat(r.avg_quality).toFixed(1)} <span className="text-slate-300 font-normal">|</span> {parseFloat(r.avg_kpi).toFixed(1)}</div>
                                                </div>
                                            </div>
                                            <div className="mt-1 pt-2 border-t border-slate-200 flex justify-between items-center">
                                                <span className="text-[9px] text-slate-500">ต้นทุนต่อ 1 คะแนนคุณภาพ</span>
                                                <span className="text-xs font-bold text-slate-700">{costPerPoint.toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿/pt</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-3 border-b border-slate-200"><h3 className="font-bold text-slate-800 text-sm">📋 รายการโครงการ</h3></div>
                        {(proj.items || []).length === 0 ? <div className="p-8 text-center text-slate-500 text-sm">ยังไม่มี</div> : (
                            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">#</th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ชื่อ</th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">แผนก</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600">งบ</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-600">ใช้ไป</th>
                                <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">%</th>
                            </tr></thead><tbody>{(proj.items || []).map((p: any, i: number) => {
                                const pct = Number(p.budget_total || 0) > 0 ? Math.round(Number(p.budget_used || 0) / Number(p.budget_total) * 100) : 0; return (
                                    <tr key={p.id || i} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="px-3 py-2 text-xs text-slate-500">{i + 1}</td><td className="px-3 py-2 text-xs text-slate-800 font-medium">{p.name}</td><td className="px-3 py-2 text-xs text-slate-600">{p.department || '-'}</td>
                                        <td className="px-3 py-2 text-xs text-right">{Number(p.budget_total || 0).toLocaleString()}</td><td className="px-3 py-2 text-xs text-right text-amber-700">{Number(p.budget_used || 0).toLocaleString()}</td>
                                        <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${pct > 80 ? 'bg-red-100 text-red-700' : pct > 50 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{pct}%</span></td>
                                    </tr>);
                            })}</tbody></table></div>)}
                    </div>
                </div>
            )}

            {/* ════════════ TAB: CURRICULUM ════════════ */}
            {tab === 'curriculum' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { l: "รายวิชาทั้งหมด", v: s.totalSubjects, ic: "📚", g: "from-indigo-500 to-violet-600" },
                            { l: "Section ทั้งหมด", v: s.totalSections, ic: "📋", g: "from-emerald-500 to-teal-600" },
                            { l: "หน่วยกิตรวม", v: cur.totalCredits || 0, ic: "🎓", g: "from-amber-500 to-orange-600" },
                            { l: "Section ไม่มีครู", v: cur.sectionsNoTeacher || 0, ic: "⚠️", g: cur.sectionsNoTeacher ? "from-red-500 to-rose-600" : "from-slate-400 to-slate-500" },
                        ].map((c, i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${c.g} flex items-center justify-center text-lg mb-2`}>{c.ic}</div>
                                <div className="text-[10px] text-slate-500">{c.l}</div><div className="text-xl font-bold text-slate-800">{typeof c.v === 'number' ? c.v.toLocaleString() : c.v}</div>
                            </div>
                        ))}
                    </div>
                    {/* Subject Difficulty Index */}
                    {advSubjDif.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">⚠️ ดัชนีความยากรายวิชา (วิชาที่มีแนวโน้มติด F สูง)</h3>
                            <div className="overflow-x-auto max-h-[400px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 shadow-sm">
                                        <tr className="border-b text-slate-600">
                                            <th className="px-3 py-2 text-left">รหัสวิชา</th>
                                            <th className="px-3 py-2 text-left">ชื่อวิชา</th>
                                            <th className="px-3 py-2 text-center">นร. ทั้งหมด</th>
                                            <th className="px-3 py-2 text-center text-red-600">ติด F/0</th>
                                            <th className="px-3 py-2 text-right">F-Rate (%)</th>
                                            <th className="px-3 py-2 text-right">เกรดเฉลี่ย</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {advSubjDif.map((s: any, i: number) => {
                                            const fRate = parseFloat(s.f_rate || 0);
                                            const vColor = fRate > 20 ? 'text-red-500' : 'text-amber-500';
                                            const bColor = fRate > 20 ? 'bg-red-400' : 'bg-amber-400';
                                            return (
                                                <tr key={i} className={`hover:bg-slate-50 ${fRate > 20 ? 'bg-red-50/20' : ''}`}>
                                                    <td className="px-3 py-2 font-mono text-slate-500 text-xs">{s.subject_code}</td>
                                                    <td className="px-3 py-2 font-medium text-xs truncate max-w-[200px]" title={s.name}>{s.name}</td>
                                                    <td className="px-3 py-2 text-center font-bold">{parseFloat(s.total_students).toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-center font-bold text-red-600">{s.fail_count}</td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-2 text-xs">
                                                            <span className={`font-bold ${vColor}`}>{fRate.toFixed(1)}%</span>
                                                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${bColor}`} style={{ width: Math.min(fRate, 100) + '%' }} /></div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-bold text-indigo-600">{parseFloat(s.avg_score).toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📊 วิชาแยกตามกลุ่มสาระ</h3>
                            {(cur.subjectsByGroup || []).length > 0 ? <BarChart data={(cur.subjectsByGroup || []).map((g: any, i: number) => ({ label: (g.grp || '').substring(0, 10), value: g.count, color: `hsl(${220 + i * 30}, 60%, 50%)` }))} height={150} /> : <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
                        </div>
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📋 ประเภทรายวิชา</h3>
                            {(cur.subjectTypes || []).length > 0 ? <DonutChart data={(cur.subjectTypes || []).map((t: any, i: number) => ({ label: `${t.type} (${t.count})`, value: t.count, color: `hsl(${180 + i * 50}, 55%, 50%)` }))} /> : <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
                        </div>
                    </div>
                    {/* Registration Stats */}
                    {(d.registrationStats || []).length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📈 วิชายอดนิยม (จำนวนลงทะเบียน)</h3>
                            <BarChart data={(d.registrationStats || []).slice(0, 10).map((r: any, i: number) => ({ label: (r.name || '').substring(0, 12), value: r.reg_count, color: `hsl(${200 + i * 25}, 60%, 50%)` }))} height={150} />
                        </div>
                    )}
                    {/* School Competency Radar / Overview */}
                    {advCompetency.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">🎯 เรดาร์สมรรถนะองค์รวมระดับโรงเรียน</h3>
                            <div className="space-y-3">
                                {advCompetency.map((c: any, i: number) => {
                                    const score = parseFloat(c.avg_score || 0);
                                    const pct = Math.min((score / 4) * 100, 100);
                                    return (
                                        <div key={i} className="relative pt-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-slate-700 truncate pr-2">{c.topic}</span>
                                                <span className="text-xs font-bold text-indigo-600">{score.toFixed(2)}</span>
                                            </div>
                                            <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-slate-100">
                                                <div style={{ width: `${pct}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-indigo-500 to-violet-500 transition-all rounded-full"></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ TAB: EVALUATION ════════════ */}
            {tab === 'evaluation' && (
                <div className="space-y-5">
                    {/* Overall eval */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-wrap justify-around gap-6">
                        <Gauge value={hr.evalAvg ? Math.round((hr.evalAvg / 5) * 100) : 0} label={`ประเมินการสอนเฉลี่ย ${hr.evalAvg || 0}/5`} color="#8b5cf6" />
                    </div>

                    {/* Workload vs Eval Correlation */}
                    {advWorkload.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">⚖️ ความสัมพันธ์ภาระงาน (Section) vs คะแนนผลประเมิน</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
                                {advWorkload.slice(0, 20).map((w: any, i: number) => {
                                    const score = parseFloat(w.avg_eval);
                                    const secs = parseInt(w.section_count);
                                    const isWarning = secs > 10 && score < 3.8;
                                    return (
                                        <div key={i} className={`p-3 rounded-xl border flex flex-col gap-2 ${isWarning ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="flex justify-between items-start">
                                                <span className="text-xs font-bold text-slate-700 truncate" title={`${w.first_name} ${w.last_name}`}>{w.first_name} {w.last_name}</span>
                                                {isWarning && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">⚠️ Overload</span>}
                                            </div>
                                            <div className="flex justify-between items-end mt-1">
                                                <div>
                                                    <div className="text-[9px] text-slate-500 mb-0.5">Section สอน</div>
                                                    <div className="text-sm font-bold text-slate-800">{secs} <span className="text-[9px] font-normal text-slate-400">กลุ่ม</span></div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-slate-500 mb-0.5">ผลประเมิน</div>
                                                    <div className={`text-sm font-bold ${score >= 4 ? 'text-green-600' : score >= 3.5 ? 'text-blue-600' : 'text-red-600'}`}>{score.toFixed(2)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Subject eval by topic */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📊 ผลประเมินรายหัวข้อ (วิชา)</h3>
                            {(evalData.subjectEvalByTopic || []).length > 0 ? <div className="space-y-2">{(evalData.subjectEvalByTopic || []).map((t: any, i: number) => (
                                <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2"><span className="text-xs text-slate-700 flex-1 truncate">{t.topic}</span><span className="text-[10px] font-bold text-violet-700">{Math.round((t.avg_score || 0) * 100) / 100}</span>
                                    <div className="w-16 h-2 bg-slate-200 rounded-full"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min((t.avg_score || 0) * 20, 100)}%` }} /></div></div>
                            ))}</div> : <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
                        </div>
                        {/* Advisor eval by topic */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-3">📋 ผลประเมินรายหัวข้อ (ที่ปรึกษา)</h3>
                            {(evalData.advisorEvalByTopic || []).length > 0 ? <div className="space-y-2">{(evalData.advisorEvalByTopic || []).map((t: any, i: number) => (
                                <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2"><span className="text-xs text-slate-700 flex-1 truncate">{t.topic}</span><span className="text-[10px] font-bold text-emerald-700">{Math.round((t.avg_score || 0) * 100) / 100}</span>
                                    <div className="w-16 h-2 bg-slate-200 rounded-full"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((t.avg_score || 0) * 20, 100)}%` }} /></div></div>
                            ))}</div> : <p className="text-sm text-slate-500">ไม่มีข้อมูล</p>}
                        </div>
                    </div>
                    {/* Top/Bottom teachers */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="bg-white rounded-2xl shadow-sm border border-green-200 overflow-hidden">
                            <div className="p-3 bg-green-50 border-b border-green-200"><h3 className="font-bold text-green-800 text-sm">🏆 Top 10 ผลประเมินสูงสุด</h3></div>
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto"><table className="w-full"><tbody>{(evalData.subjectEvalTop || []).map((t: any, i: number) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-green-50/30"><td className="px-3 py-1.5 text-xs text-slate-500">{i + 1}</td><td className="px-3 py-1.5 text-xs text-slate-800 font-medium">{t.prefix}{t.first_name} {t.last_name}</td><td className="px-3 py-1.5 text-xs text-slate-500">{t.department || '-'}</td><td className="px-3 py-1.5 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">{Math.round((t.avg_score || 0) * 100) / 100}</span></td></tr>
                            ))}</tbody></table></div>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                            <div className="p-3 bg-amber-50 border-b border-amber-200"><h3 className="font-bold text-amber-800 text-sm">📉 Bottom 10 ผลประเมินต่ำสุด</h3></div>
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto"><table className="w-full"><tbody>{(evalData.subjectEvalBottom || []).map((t: any, i: number) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-amber-50/30"><td className="px-3 py-1.5 text-xs text-slate-500">{i + 1}</td><td className="px-3 py-1.5 text-xs text-slate-800 font-medium">{t.prefix}{t.first_name} {t.last_name}</td><td className="px-3 py-1.5 text-xs text-slate-500">{t.department || '-'}</td><td className="px-3 py-1.5 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{Math.round((t.avg_score || 0) * 100) / 100}</span></td></tr>
                            ))}</tbody></table></div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════ TAB: ACTION ITEMS ════════════ */}
            {tab === 'actions' && (
                <div className="space-y-5">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4">🔔 รายการที่ต้องดำเนินการ ({actItems.length})</h3>
                        {actItems.length === 0 ? <p className="text-sm text-slate-500 text-center py-8">✅ ไม่มีรายการที่ต้องดำเนินการ</p> : (
                            <div className="space-y-2">{actItems.map((item: any, i: number) => (
                                <div key={i} className={`p-3 rounded-xl border flex items-start gap-3 ${item.priority === 'high' ? 'bg-red-50 border-red-200' : item.priority === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                                    <span className="text-lg shrink-0">{item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🔵'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-800">{item.message}</div>
                                        {item.detail && <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={item.detail}>{item.detail}</div>}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${item.priority === 'high' ? 'bg-red-200 text-red-800' : item.priority === 'medium' ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>{item.priority === 'high' ? 'สูง' : item.priority === 'medium' ? 'กลาง' : 'ต่ำ'}</span>
                                </div>
                            ))}</div>
                        )}
                    </div>
                    {/* Advisor coverage */}
                    {(hr.advisorStats || []).length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-3 border-b border-slate-200"><h3 className="font-bold text-slate-800 text-sm">👨‍🏫 ครูที่ปรึกษาประจำชั้น</h3></div>
                            <div className="overflow-x-auto max-h-[300px] overflow-y-auto"><table className="w-full"><thead><tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">ชั้น/ห้อง</th>
                                <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-600">จำนวน</th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-600">รายชื่อ</th>
                            </tr></thead><tbody>{(hr.advisorStats || []).map((a: any, i: number) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                    <td className="px-3 py-1.5 text-xs font-medium text-slate-800">{a.class_level}/{a.room}</td>
                                    <td className="px-3 py-1.5 text-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.advisor_count >= 2 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{a.advisor_count}</span></td>
                                    <td className="px-3 py-1.5 text-[10px] text-slate-600 truncate max-w-[200px]" title={a.advisors}>{a.advisors}</td>
                                </tr>
                            ))}</tbody></table></div>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ TAB: COMPARISONS ════════════ */}
            {tab === 'comparisons' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Weak Students per Subject */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-200">
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">📉 นักเรียนกลุ่มอ่อนรายวิชา</h3>
                            {(comparisons.studentWeaknesses || []).length > 0 ? (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {(comparisons.studentWeaknesses || []).map((w: any, i: number) => (
                                        <div key={i} className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-red-800 truncate">{w.prefix}{w.first_name} {w.last_name}</div>
                                                <div className="text-[10px] text-red-600 mt-1">ม.{w.class_level}/{w.room} • {w.subject_name} ({w.subject_code})</div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className="block text-lg font-bold text-red-700 leading-none">{w.grade}</span>
                                                <span className="text-[9px] text-red-500 font-medium">{w.total_score} คะแนน</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">✅ ไม่พบนักเรียนที่สอบตกหรือได้เกรดต่ำ</div>
                            )}
                        </div>

                        {/* Best Room per Subject */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200">
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">🏆 แชมป์เปี้ยนรายวิชา (ห้องคะแนนสูงสุด)</h3>
                            {(comparisons.bestRoomPerSubject || []).length > 0 ? (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {(comparisons.bestRoomPerSubject || []).map((r: any, i: number) => (
                                        <div key={i} className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-emerald-800 truncate">{r.subject_name}</div>
                                                <div className="text-[10px] text-emerald-600 mt-1">{r.subject_code} • {r.student_count} คน</div>
                                            </div>
                                            <div className="shrink-0 text-right flex flex-col items-end">
                                                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold mb-1">ม.{r.class_level}/{r.room}</span>
                                                <span className="text-[10px] text-emerald-700 font-medium">เฉลี่ย {Math.round(r.avg_score * 10) / 10}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">ไม่มีข้อมูลการให้คะแนนเพียงพอ</div>
                            )}
                        </div>
                    </div>

                    {/* Teacher Performance (Eval vs Grade) */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-indigo-200">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">👩‍🏫 ประสิทธิภาพการสอน (ประเมินครู & เกรดนักเรียน)</h3>
                        <p className="text-xs text-slate-500 mb-4">แสดงครูที่มีคะแนนการประเมินการสอนและเกรดเฉลี่ยของนักเรียน เพื่อวิเคราะห์ความสอดคล้องของคุณภาพการสอน</p>

                        {(comparisons.teacherPerformance || []).length > 0 ? (
                            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-600 border-b">อันดับ</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-600 border-b">ชื่อ-สกุล</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-600 border-b text-center">กลุ่มสาระ</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-600 border-b text-center">Section ที่สอน</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-600 border-b text-center">ผลประเมิน (เต็ม 5)</th>
                                            <th className="px-4 py-3 text-xs font-semibold text-slate-600 border-b text-center">คะแนนเก็บเด็กเฉลี่ย</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(comparisons.teacherPerformance || []).map((t: any, i: number) => {
                                            const evalScore = t.avg_eval ? Math.round(t.avg_eval * 100) / 100 : 0;
                                            const evalColor = evalScore >= 4.5 ? 'text-green-600 bg-green-50' : evalScore >= 3.5 ? 'text-amber-600 bg-amber-50' : evalScore > 0 ? 'text-red-600 bg-red-50' : 'text-slate-400 bg-slate-50';
                                            const gradeScore = t.avg_grade ? Math.round(t.avg_grade * 10) / 10 : 0;
                                            return (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-slate-500">{i + 1}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">
                                                        {t.prefix}{t.first_name} {t.last_name}
                                                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{t.teacher_code}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-600 text-center">{t.department || '-'}</td>
                                                    <td className="px-4 py-3 text-center"><span className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-700">{t.section_count}</span></td>
                                                    <td className="px-4 py-3 text-center">
                                                        {evalScore > 0 ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${evalColor}`}>{evalScore}</span>
                                                                <div className="w-16 h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                                                                    <div className={`h-full rounded-full ${evalScore >= 4.5 ? 'bg-green-500' : evalScore >= 3.5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(evalScore / 5) * 100}%` }} />
                                                                </div>
                                                            </div>
                                                        ) : <span className="text-xs text-slate-400">-</span>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {gradeScore > 0 ? (
                                                            <span className={`text-sm font-bold ${gradeScore >= 75 ? 'text-emerald-600' : gradeScore >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{gradeScore}</span>
                                                        ) : <span className="text-xs text-slate-400">-</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">ยังไม่มีข้อมูลเพียงพอต่อการวิเคราะห์</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
