"use client";

import { useState, useEffect } from "react";
import { StudentApiService } from "@/services/student-api.service";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";

interface ActivitiesFeatureProps {
    session: any;
}

const TH_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

export function ActivitiesFeature({ session }: ActivitiesFeatureProps) {
    const student = session;

    // Data state
    // Queries
    const activitiesQuery = useQuery({
        queryKey: ["student", "activities"],
        queryFn: () => StudentApiService.getAllActivities(),
    });

    const events = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];
    const [currentDate, setCurrentDate] = useState(new Date());
    const isLoading = activitiesQuery.isLoading;
    const fetchError = activitiesQuery.error ? (activitiesQuery.error as any).message : null;

    const shiftMonth = (delta: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
    };

    // Calendar logic
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const monthEvents = events.filter((ev) => {
        if (!ev.date) return false;
        const d = new Date(ev.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    const eventMap = new Map();
    monthEvents.forEach((ev) => {
        const key = new Date(ev.date).toISOString().slice(0, 10);
        if (!eventMap.has(key)) eventMap.set(key, []);
        eventMap.get(key).push(ev);
    });

    const classifyEvent = (name = "") => {
        if (name.includes("ประชุม")) return "meeting text-blue-700 bg-blue-50 border-blue-200";
        if (name.includes("สอบ") || name.includes("วิชาการ")) return "academic text-purple-700 bg-purple-50 border-purple-200";
        if (name.includes("หยุด")) return "holiday text-red-700 bg-red-50 border-red-200";
        return "other text-slate-700 bg-slate-50 border-slate-200";
    };

    const renderCalendarGrid = () => {
        const weeks = [];
        let dayNum = 1;
        let nextMonthDay = 1;

        for (let week = 0; week < 6; week++) {
            const days = [];
            for (let i = 0; i < 7; i++) {
                let displayDay: number | string = "";
                let dateKey = "";
                let isCurrentMonth = true;

                if (week === 0 && i < firstDay) {
                    displayDay = prevDays - firstDay + i + 1;
                    isCurrentMonth = false;
                } else if (dayNum > daysInMonth) {
                    displayDay = nextMonthDay++;
                    isCurrentMonth = false;
                } else {
                    displayDay = dayNum;
                    const d = new Date(year, month, dayNum);
                    // Use local date for key
                    dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    // Try to match DB date strings which might be raw
                    if (!eventMap.has(dateKey)) {
                        dateKey = d.toISOString().slice(0, 10);
                    }

                    dayNum++;
                }

                const dayEvents = eventMap.get(dateKey) || [];

                days.push(
                    <td key={i} className={`border border-slate-200 p-1 md:p-2 align-top h-24 md:h-32 transition-colors hover:bg-slate-50 relative ${!isCurrentMonth ? 'opacity-40 bg-slate-50/50' : 'bg-white'}`}>
                        <div className="flex flex-col h-full">
                            <div className={`text-right text-sm font-medium p-1 ${isCurrentMonth && dayNum - 1 === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? 'text-indigo-600 font-bold bg-indigo-50 rounded-full w-7 h-7 flex items-center justify-center ml-auto' : 'text-slate-600'}`}>
                                {displayDay}
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-1 custom-scrollbar">
                                {dayEvents.slice(0, 3).map((ev: any, idx: number) => (
                                    <div key={idx} className={`text-xs px-2 py-1 rounded border truncate shadow-sm cursor-pointer hover:shadow-md transition-shadow ${classifyEvent(ev.name)}`} title={ev.name}>
                                        {ev.name}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs text-slate-500 font-medium px-1 mt-1">
                                        +{dayEvents.length - 3} รายการ
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                );
            }
            weeks.push(<tr key={week}>{days}</tr>);
            if (dayNum > daysInMonth) break;
        }
        return weeks;
    };

    // Upcoming logic
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayDate = new Date(todayStr);

    const upcomingEvents = events
        .filter(ev => ev.date)
        .map(ev => ({ ...ev, dateObj: new Date(ev.date) }))
        .filter(ev => ev.dateObj >= todayDate)
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
        .slice(0, 6);

    const formatDate = (value: string) => {
        if (!value) return "-";
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return value;
        return d.toLocaleDateString("th-TH");
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="w-full md:w-1/2">
                        <Skeleton variant="rounded" className="h-6 w-20 mb-4 bg-white/20" />
                        <Skeleton variant="rounded" className="h-8 w-64 mb-2 bg-white/20" />
                        <Skeleton variant="rounded" className="h-4 w-80 bg-white/20" />
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 inline-flex flex-col items-start min-w-[200px]">
                        <Skeleton variant="rounded" className="h-4 w-32 mb-2 bg-white/20" />
                        <Skeleton variant="rounded" className="h-8 w-24 bg-white/20" />
                    </div>
                </section>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex justify-between mb-6">
                            <Skeleton variant="rounded" className="h-10 w-48" />
                            <Skeleton variant="rounded" className="h-8 w-32" />
                            <Skeleton variant="rounded" className="h-10 w-32" />
                        </div>
                        <Skeleton variant="rounded" className="h-[500px] w-full" />
                    </div>
                    <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <Skeleton variant="rounded" className="h-10 w-full mb-6" />
                        <div className="space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" className="h-16 w-full" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center text-red-500">
                <p>{fetchError}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <section className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
                <div className="relative z-10">
                    <div className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium mb-4 backdrop-blur-sm border border-white/20">
                        Activities
                    </div>
                    <h1 className="text-3xl font-bold mb-2">ปฏิทินกิจกรรมโรงเรียน</h1>
                    <p className="text-indigo-100 mb-4 max-w-xl">
                        ติดตามกิจกรรมที่จะมาถึงและกิจกรรมที่ผ่านมาทั้งหมดตลอดปีการศึกษา
                    </p>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 inline-flex flex-col items-start min-w-[200px]">
                        <div className="text-indigo-100 text-sm font-medium mb-1">กิจกรรมที่กำลังจะมาถึง</div>
                        <div className="text-2xl font-bold text-white flex items-center gap-2">
                            {upcomingEvents.length} รายการ
                        </div>
                    </div>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-full bg-white opacity-5 transform -skew-x-12 translate-x-20"></div>
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-500 rounded-full blur-2xl opacity-50"></div>
                <svg className="absolute top-1/2 right-1/4 transform -translate-y-1/2 w-48 h-48 text-white/5 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 002 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
                </svg>
            </section>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Calendar View */}
                <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-2">
                            <button onClick={() => shiftMonth(-1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <button onClick={goToToday} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors">
                                วันนี้
                            </button>
                            <button onClick={() => shiftMonth(1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800" id="studentCalMonthLabel">
                            {TH_MONTHS[month]} {year + 543}
                        </h2>
                        <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
                            <button className="px-4 py-2 bg-indigo-50 text-indigo-700 font-medium text-sm">เดือน</button>
                            <button className="px-4 py-2 bg-white text-slate-600 hover:bg-slate-50 font-medium text-sm border-l border-slate-200">ลิสต์</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                        <table className="w-full text-slate-800 min-w-[700px] border-collapse bg-white">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="py-3 px-2 text-center text-red-500 font-medium border-r border-slate-200 w-[14.28%]">อา.</th>
                                    <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">จ.</th>
                                    <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">อ.</th>
                                    <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">พ.</th>
                                    <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">พฤ.</th>
                                    <th className="py-3 px-2 text-center text-slate-600 font-medium border-r border-slate-200 w-[14.28%]">ศ.</th>
                                    <th className="py-3 px-2 text-center text-indigo-500 font-medium w-[14.28%]">ส.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renderCalendarGrid()}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Upcoming Side List */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800 leading-tight">กำลังจะมาถึง</h3>
                                <p className="text-slate-500 text-xs">กิจกรรมในปฏิทิน</p>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 leading-relaxed">
                            {upcomingEvents.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    — ยังไม่มีกิจกรรมที่กำลังจะมาถึง —
                                </div>
                            ) : (
                                upcomingEvents.map((ev, idx) => (
                                    <div key={idx} className="flex gap-4 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors group">
                                        <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-700 rounded-lg p-2 min-w-[50px] shrink-0 border border-indigo-100 group-hover:bg-indigo-100 transition-colors">
                                            <span className="text-lg font-bold leading-none">{ev.dateObj.getDate()}</span>
                                            <span className="text-xs uppercase font-medium mt-1">{TH_MONTHS[ev.dateObj.getMonth()].slice(0, 3)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-slate-800 text-sm truncate" title={ev.name}>{ev.name}</h4>
                                            <div className="mt-1 flex items-center text-xs text-slate-500 gap-1.5">
                                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                <span className="truncate" title={ev.location || "ไม่ได้ระบุ"}>{ev.location || "ไม่ได้ระบุ"}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
