import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import React from 'react';
interface AttendanceRecordProps {
  classId: string;
  date: string;
  attendanceData: {
    id: string;
    studentid: string;
    date: string;
    status: 'Present' | 'Absent';
  }[];
}

export default function AttendanceRecord({ classId, date, attendanceData }: AttendanceRecordProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">
        Attendance Record for {date}
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student ID</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendanceData.map((a) => (
            <TableRow key={a.studentid}>
              <TableCell>{a.studentid}</TableCell>
              <TableCell>
                <Badge variant={a.status === 'Present' ? 'success' : 'destructive'}>
                  {a.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
