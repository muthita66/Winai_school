'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter } from 'lucide-react';

export default function BehaviorPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAdvisoryStudents();
    }, []);

    const fetchAdvisoryStudents = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/teacher/students/advisory');
            const data = await res.json();
            setStudents(data);
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredStudents = students.filter(s =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        s.student_code.includes(search)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">บันทึกพฤติกรรม</h1>
                    <p className="text-muted-foreground">จัดการพฤติกรรมและความประพฤติของนักเรียนในที่ปรึกษา</p>
                </div>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> บันทึกใหม่
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>รายชื่อนักเรียนในที่ปรึกษา</CardTitle>
                    <div className="flex items-center gap-2 pt-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาชื่อ หรือรหัสประจำตัว..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" size="icon">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>รหัสประจำตัว</TableHead>
                                <TableHead>ชื่อ-นามสกุล</TableHead>
                                <TableHead>ห้อง</TableHead>
                                <TableHead>คะแนนความประพฤติ</TableHead>
                                <TableHead>สถานะ</TableHead>
                                <TableHead className="text-right">จัดการ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">กำลังโหลดข้อมูล...</TableCell>
                                </TableRow>
                            ) : filteredStudents.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">ไม่พบข้อมูลนักเรียน</TableCell>
                                </TableRow>
                            ) : (
                                filteredStudents.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.student_code}</TableCell>
                                        <TableCell>{s.prefix}{s.first_name} {s.last_name}</TableCell>
                                        <TableCell>{s.class_level}/{s.room}</TableCell>
                                        <TableCell>
                                            <span className="font-bold text-green-600">100</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                ปกติ
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm">รายละเอียด</Button>
                                            <Button variant="ghost" size="sm" className="text-red-600">หักคะแนน</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
