"use client";
import { useEffect, useState, useMemo, useTransition } from "react";
import { supabase } from "../utils/supabaseClient";
import Navbar from "../components/Navbar";

// UI component imports
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2, Pencil, BarChart2, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";

export default function MyComplaints() {
  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [isPending, startTransition] = useTransition();

  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const complaintStatuses = ["New", "In Progress", "Resolved", "Closed"];

  // --- NEW: WhatsApp Messaging Helper Function ---
  // This function was missing and is now added.
  const sendMessage = async (mobileNumber, messageText, studentId, classId) => {
    // A null studentId or classId is acceptable for admin-only messages.
    try {
      const { error } = await supabase.from("messages").insert({
        number: mobileNumber,
        text: messageText,
        student_id: studentId,
        class_id: classId,
      });
      if (error) {
        console.error("Error sending message:", error);
        // Optional: Add an alert for the user if sending fails
        // alert(`Failed to send notification: ${error.message}`);
      }
    } catch (e) {
      console.error("An exception occurred while sending message:", e);
    }
  };


  useEffect(() => {
    const fetchUserDataAndComplaints = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        fetchUserComplaints(user.id);
      } else {
        console.log("No user logged in.");
      }
    };
    fetchUserDataAndComplaints();
  }, []);

  const fetchUserComplaints = async (userId) => {
    const { data, error } = await supabase
      .from("complaints")
      .select(`
        id, title, complaint_text, status, resolution_notes, created_at, student_id,
        students!left(name, mobilenumber, class_id),
        assigned_to:profiles!assigned_to_user_id(id, email),
        against_user:profiles!against_user_id(id, email)
      `)
      .or(`assigned_to_user_id.eq.${userId},against_user_id.eq.${userId}`);

    if (error) {
      console.error("Error fetching user complaints:", error);
    } else {
      setComplaints(data);
    }
  };

  // --- MODIFIED & FIXED: Complaint update function ---
  const handleUpdateComplaint = async () => {
    if (!editingComplaint || editingComplaint.assigned_to.id !== user.id) {
      alert("You do not have permission to edit this complaint.");
      return;
    }

    startTransition(async () => {
      const { error } = await supabase
        .from("complaints")
        .update({ status: newStatus, resolution_notes: resolutionNotes })
        .eq("id", editingComplaint.id);

      if (error) {
        alert("Error updating complaint: " + error.message);
        return;
      }
      
      // --- FIXED: Messaging logic is now active and robust ---
      if (editingComplaint.status !== newStatus && (newStatus === "Resolved" || newStatus === "Closed")) {
          const student = editingComplaint.students;
          // Ensure student data exists before trying to send a message
          if (student && student.mobilenumber) {
              // 1. Send message to the parent
              const studentCloseMsg = `*Complaint ${newStatus}* ✅\n\nDear Parent,\nYour complaint "*${editingComplaint.title}*" has been marked as *${newStatus}*.\n\n*Resolution Notes:*\n${resolutionNotes || "No additional notes."}`;
              await sendMessage(student.mobilenumber, studentCloseMsg, student.student_id, student.class_id);

              // 2. Send a notification to the campus admin
              const adminCloseMsg = `*Complaint Resolved by Staff* 👨‍🏫\n\n*Complaint:* ${editingComplaint.title}\n*Student:* ${student.name}\n*Resolved By:* ${user.email}\n*New Status:* ${newStatus}\n*Notes:* ${resolutionNotes || "N/A"}`;
              await sendMessage("923085333392", adminCloseMsg, student.student_id, student.class_id);
          }
      }

      alert("Complaint updated successfully!");
      fetchUserComplaints(user.id); // Refresh data
      setEditingComplaint(null); // Close modal
    });
  };

  const openModal = (complaint) => {
    setEditingComplaint(complaint);
    setResolutionNotes(complaint.resolution_notes || "");
    setNewStatus(complaint.status || "New");
  };

  const stats = useMemo(() => ({
    total: complaints.length,
    assignedToMe: complaints.filter(c => c.assigned_to?.id === user?.id).length,
    againstMe: complaints.filter(c => c.against_user?.id === user?.id).length,
    needsAction: complaints.filter(c => c.assigned_to?.id === user?.id && c.status !== 'Resolved' && c.status !== 'Closed').length,
  }), [complaints, user]);

  return (
    <div className="p-4 space-y-6">
      <Navbar />
      <h1 className="text-2xl font-bold">My Complaints Dashboard</h1>

      {/* User-specific Stats Dashboard */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-sky-100 border-sky-200 text-sky-900"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Relevant Complaints</CardTitle><BarChart2 className="h-4 w-4 text-sky-700" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card className="bg-green-100 border-green-200 text-green-900"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Assigned To Me</CardTitle><Pencil className="h-4 w-4 text-green-700" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.assignedToMe}</div></CardContent></Card>
        <Card className="bg-yellow-100 border-yellow-200 text-yellow-900"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Complaints Against Me</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-700" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.againstMe}</div></CardContent></Card>
        <Card className="bg-purple-100 border-purple-200 text-purple-900"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Needs My Action</CardTitle><Loader2 className="h-4 w-4 text-purple-700" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.needsAction}</div></CardContent></Card>
      </div>

      {/* User's Complaints Table */}
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-4">📋 My Complaint Inbox</h2>
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Student</TableHead><TableHead>Status</TableHead><TableHead>Your Role</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {complaints.map((c) => {
              const isAssignedToMe = c.assigned_to?.id === user?.id;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>{c.students?.name ?? "N/A"}</TableCell>
                  <TableCell><Badge variant={c.status === 'New' ? 'destructive' : 'secondary'}>{c.status}</Badge></TableCell>
                  <TableCell>
                    {isAssignedToMe ? (
                      <Badge className="bg-green-100 text-green-800">Assigned to You</Badge>
                    ) : (
                      <Badge variant="destructive">Against You</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isAssignedToMe ? (
                      <Button variant="outline" size="icon" onClick={() => openModal(c)}><Pencil className="h-4 w-4" /></Button>
                    ) : (
                      <Button variant="outline" size="icon" onClick={() => openModal(c)}><Eye className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog for Editing/Viewing */}
      <Dialog open={!!editingComplaint} onOpenChange={() => setEditingComplaint(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingComplaint?.assigned_to?.id === user?.id ? "Manage" : "View"} Complaint</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2 text-sm border p-3 rounded-md">
                <p><strong>Title:</strong> {editingComplaint?.title}</p>
                <p><strong>Student:</strong> {editingComplaint?.students?.name}</p>
                <p><strong>Details:</strong> {editingComplaint?.complaint_text}</p>
            </div>
            <div>
              <Label htmlFor="status">Complaint Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus} disabled={editingComplaint?.assigned_to?.id !== user?.id}>
                <SelectTrigger id="status"><SelectValue placeholder="Set status" /></SelectTrigger>
                <SelectContent>{complaintStatuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Resolution Notes</Label>
              <textarea id="notes" placeholder="Add resolution notes here..." value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={4} className="flex w-full rounded-md border p-2" readOnly={editingComplaint?.assigned_to?.id !== user?.id} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            {editingComplaint?.assigned_to?.id === user?.id && (
              <Button onClick={handleUpdateComplaint} disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2" />}Save Changes</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}