"use client";
import { useState, useEffect } from "react";
import { TeacherApiService } from "@/services/teacher-api.service";

const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export function CalendarFeature({ session }: { session: any }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", event_date: "" });

    const loadEvents = async () => {
        setLoading(true);
        try { const data = await TeacherApiService.getCalendarEvents(); setEvents(data || []); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadEvents(); }, []);

    const handleAdd = async () => {
        if (!form.title || !form.event_date) return;
        await TeacherApiService.addCalendarEvent(form);
        setForm({ title: "", description: "", event_date: "" });
        setShowAdd(false);
        loadEvents();
    };

    const handleDelete = async (id: number) => {
        if (!confirm("ลบกิจกรรมนี้?")) return;
        await TeacherApiService.deleteCalendarEvent(id);
        loadEvents();
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthEvents = events.filter(ev => {
        if (!ev.event_date) return false;
        const d = new Date(ev.event_date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    const eventMap = new Map<string, any[]>();
    monthEvents.forEach(ev => {
        const key = new Date(ev.event_date).toISOString().slice(0, 10);
        if (!eventMap.has(key)) eventMap.set(key, []);
        eventMap.get(key)!.push(ev);
    });

    const renderGrid = () => {
        const weeks = [];
        let dayNum = 1;
        for (let w = 0; w < 6; w++) {
            const days = [];
            for (let i = 0; i < 7; i++) {
                let display = 0, isCurrent = true, dateKey = "";
                if (w === 0 && i < firstDay) { isCurrent = false; display = new Date(year, month, 0).getDate() - firstDay + i + 1; }
                else if (dayNum > daysInMonth) { isCurrent = false; display = dayNum - daysInMonth; dayNum++; }
                else { display = dayNum; dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`; if (!eventMap.has(dateKey)) dateKey = new Date(year, month, dayNum).toISOString().slice(0, 10); dayNum++; }
                const dayEvs = eventMap.get(dateKey) || [];
                const isToday = isCurrent && display === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                days.push(
                    <td key={i} className={`border border-slate-200 p-1 align-top h-28 ${!isCurrent ? 'opacity-30 bg-slate-50/50' : 'bg-white hover:bg-slate-50'} transition-colors`}>
                        <div className={`text-right text-sm p-1 ${isToday ? 'text-emerald-600 font-bold' : 'text-slate-600'}`}>{display}</div>
                        {dayEvs.slice(0, 2).map((ev: any, idx: number) => (
                            <div key={idx} className="text-xs px-1.5 py-0.5 mb-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 truncate cursor-pointer hover:bg-emerald-100" title={ev.title} onClick={() => handleDelete(ev.id)}>{ev.title}</div>
                        ))}
                        {dayEvs.length > 2 && <div className="text-xs text-slate-400 px-1">+{dayEvs.length - 2}</div>}
                    </td>
                );
            }
            weeks.push(<tr key={w}>{days}</tr>);
            if (dayNum > daysInMonth) break;
        }
        return weeks;
    };

    return (
        <div className="space-y-6">
            <section className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4">Calendar</div>
                    <h1 className="text-3xl font-bold">ปฏิทินกิจกรรม</h1>
                    <p className="text-emerald-100 mt-2">จัดการกิจกรรมและตารางนัดหมาย</p>
                </div>
            </section>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors">วันนี้</button>
                    <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                </div>
                <h2 className="text-xl font-bold text-slate-800">{TH_MONTHS[month]} {year + 543}</h2>
                <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm">+ เพิ่มกิจกรรม</button>
            </div>

            {showAdd && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-800">เพิ่มกิจกรรมใหม่</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="ชื่อกิจกรรม" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                        <input className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="รายละเอียด" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        <input type="date" className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
                    </div>
                    <button onClick={handleAdd} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">บันทึก</button>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50">
                            {["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."].map((d, i) => (
                                <th key={i} className={`py-3 px-2 text-center font-medium border-b border-slate-200 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-600'}`}>{d}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{loading ? <tr><td colSpan={7} className="text-center py-8 text-slate-500">กำลังโหลด...</td></tr> : renderGrid()}</tbody>
                </table>
            </div>

            {/* Upcoming list */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">📋 รายการกิจกรรมทั้งหมด ({events.length})</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {events.map((ev, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-colors">
                            <div>
                                <div className="font-medium text-slate-800 text-sm">{ev.title}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{ev.description || "-"} • {ev.event_date ? new Date(ev.event_date).toLocaleDateString("th-TH") : "-"}</div>
                            </div>
                            <button onClick={() => handleDelete(ev.id)} className="text-xs text-red-500 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">ลบ</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
