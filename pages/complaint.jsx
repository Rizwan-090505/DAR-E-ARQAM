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
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Loader2, Plus, Pencil, Send, BarChart2, CheckCircle2, AlertTriangle } from "lucide-react";
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

export default function ComplaintsAdmin() {
  // State management
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [isPending, startTransition] = useTransition();

  // State for user management, editing, and status
  const [users, setUsers] = useState([]);
  const [againstUserId, setAgainstUserId] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newAssignedToUserId, setNewAssignedToUserId] = useState("");
  const [newAgainstUserId, setNewAgainstUserId] = useState(""); // --- NEW: State for updating 'against user'
  const complaintStatuses = ["New", "In Progress", "Resolved", "Closed"];

  // State for filtering
  const [statusFilter, setStatusFilter] = useState("All");

  // WhatsApp Messaging Helper Function
  const sendMessage = async (mobileNumber, messageText, studentId, classId) => {
    // Check if the recipient is the admin. If so, send without confirmation.
    const isAdminNumber = mobileNumber === "923085333392";

    let shouldSendMessage = true; // Default to true for admin messages

    if (!isAdminNumber) {
      // For parent messages, ask for confirmation.
      shouldSendMessage = window.confirm(
        `Do you want to send the following message to ${mobileNumber}?\n\n---\n${messageText}\n---`
      );
    }

    if (!shouldSendMessage) {
      console.log("Message sending cancelled by user.");
      return; // Stop execution if user cancels
    }
    
    try {
      const { error } = await supabase.from("messages").insert({
        number: mobileNumber,
        text: messageText,
        student_id: studentId,
        class_id: classId,
      });
      if (error) console.error("Error sending message:", error);
    } catch (e) {
      console.error("Exception in sendMessage:", e);
    }
  };

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const { data: clsData } = await supabase.from("classes").select("id, name");
      if (clsData) setClasses(clsData);
      const { data: usersData } = await supabase.from("profiles").select("id, email");
      if (usersData) setUsers(usersData);
      fetchComplaints();
    };
    fetchData();
  }, []);

  const fetchComplaints = async () => {
    const { data: cmps, error } = await supabase.from("complaints").select(
      `
          id, title, complaint_text, status, resolution_notes, created_at, student_id,
          students!left(name, mobilenumber, class_id),
          assigned_to:profiles!assigned_to_user_id(id, email),
          against_user:profiles!against_user_id(id, email)
        `
    );
    if (error) console.error("Error fetching complaints:", error);
    if (cmps) setComplaints(cmps);
  };

  // Fetch students when a class is selected
  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      return;
    }
    const fetchStudents = async () => {
      const { data } = await supabase.from("students").select("*").eq("class_id", selectedClass);
      if (data) setStudents(data);
    };
    fetchStudents();
  }, [selectedClass]);

  // Function to submit a new complaint
  const handleSubmit = async () => {
    if (!selectedStudent || !title || !text || !againstUserId || !assignedToUserId) {
      alert("Please fill all fields, including assigning users.");
      return;
    }
    startTransition(async () => {
      const student = students.find(s => s.studentid === selectedStudent);
      if (!student) {
        alert("Could not find student details.");
        return;
      }
      const { name: studentName, mobilenumber, class_id } = student;

      const { error: cErr } = await supabase.from("complaints").insert({
        parent_number: mobilenumber,
        complaint_text: text,
        title,
        student_id: selectedStudent,
        against_user_id: againstUserId,
        assigned_to_user_id: assignedToUserId,
        status: "New",
      });
      if (cErr) {
        alert("Error creating complaint: " + cErr.message);
        return;
      }

      // --- Send Messages on Creation ---
      const assignedToUser = users.find(u => u.id === assignedToUserId);
      const studentMsgReceived = `*Complaint Received* 📬\n\nDear Parent,\nYour complaint regarding "*${title}*" has been successfully lodged. We will look into it shortly.\n\nThank you,\nCampus Administration`;
      await sendMessage(mobilenumber, studentMsgReceived, selectedStudent, class_id);
      const studentMsgAssigned = `*Complaint Update* 🧑‍🏫\n\nDear Parent,\nYour complaint "*${title}*" has been assigned to a concerned staff member for review and resolution.`;
      await sendMessage(mobilenumber, studentMsgAssigned, selectedStudent, class_id);
      const adminMsg = `*New Complaint Alert* ⚠️\n\n*Student:* ${studentName}\n*Title:* ${title}\n*Details:* ${text}\n*Against:* ${users.find(u => u.id === againstUserId)?.email || 'N/A'}\n*Assigned To:* ${assignedToUser?.email || 'N/A'}`;
      await sendMessage("923085333392", adminMsg, selectedStudent, class_id);

      alert("Complaint lodged successfully and notifications sent!");
      fetchComplaints();
      setTitle("");
      setText("");
      setAgainstUserId("");
      setAssignedToUserId("");
      setSelectedStudent(null);
      setSelectedClass(null);
    });
  };

  // Function to update an existing complaint
  const handleUpdateComplaint = async () => {
    if (!editingComplaint) return;

    startTransition(async () => {
      const originalComplaint = complaints.find(c => c.id === editingComplaint.id);

      const { error } = await supabase
        .from("complaints")
        .update({
          status: newStatus,
          resolution_notes: resolutionNotes,
          assigned_to_user_id: newAssignedToUserId,
          against_user_id: newAgainstUserId, // --- MODIFIED: Update against user
        })
        .eq("id", editingComplaint.id);
      if (error) {
        alert("Error updating complaint: " + error.message);
        return;
      }

      const student = editingComplaint.students;

      // --- NEW: Message on "Against User" change (Admin Only) ---
      if (originalComplaint.against_user?.id !== newAgainstUserId) {
        const oldAgainst = originalComplaint.against_user?.email || 'N/A';
        const newAgainst = users.find(u => u.id === newAgainstUserId)?.email || 'N/A';
        const adminAgainstMsg = `*Complaint Details Updated* 📝\n\n*Title:* ${editingComplaint.title}\n*Student:* ${student.name}\n\nThis complaint's *'Against'* field has been changed.\n*From:* ${oldAgainst}\n*To:* ${newAgainst}`;
        await sendMessage("923085333392", adminAgainstMsg, student.id, student.class_id);
      }

      // Message on Re-assignment
      if (originalComplaint.assigned_to?.id !== newAssignedToUserId) {
          const oldTeacher = originalComplaint.assigned_to?.email;
          const newTeacher = users.find(u => u.id === newAssignedToUserId)?.email;
          const adminReassignMsg = `*Complaint Re-Assigned* 🔁\n\n*Title:* ${editingComplaint.title}\n*Student:* ${student.name}\n*From:* ${oldTeacher}\n*To:* ${newTeacher}`;
          await sendMessage("923085333392", adminReassignMsg, student.id, student.class_id);
          const studentReassignMsg = `*Complaint Update* 🧑‍🏫\n\nDear Parent,\nThere is an update on your complaint "*${editingComplaint.title}*". It has been forwarded to another staff member for further action.`
          await sendMessage(student.mobilenumber, studentReassignMsg, student.id, student.class_id);
      }

      // Message on Status Change to Resolved/Closed
      if (originalComplaint.status !== newStatus && (newStatus === "Resolved" || newStatus === "Closed")) {
        const studentCloseMsg = `*Complaint ${newStatus}* ✅\n\nDear Parent,\nYour complaint "*${editingComplaint.title}*" has been marked as *${newStatus}*.\n\n*Resolution Notes:*\n${resolutionNotes || "No additional notes."}`;
        await sendMessage(student.mobilenumber, studentCloseMsg, student.id, student.class_id);
        const adminCloseMsg = `*Complaint Status Update* 📋\n\n*Title:* ${editingComplaint.title}\n*Student:* ${student.name}\n*New Status:* ${newStatus}\n*Final Notes:* ${resolutionNotes || "N/A"}`;
        await sendMessage("923085333392", adminCloseMsg, student.id, student.class_id);
      }

      alert("Complaint updated successfully!");
      fetchComplaints();
      setEditingComplaint(null);
    });
  };

  // Helper to open the edit modal
  const openEditModal = (complaint) => {
    setEditingComplaint(complaint);
    setResolutionNotes(complaint.resolution_notes || "");
    setNewStatus(complaint.status || "New");
    setNewAssignedToUserId(complaint.assigned_to?.id || "");
    setNewAgainstUserId(complaint.against_user?.id || ""); // --- NEW: Initialize against user state
  };

  // Memoized values for Dashboard Stats and Filtering
  const stats = useMemo(() => ({
    total: complaints.length,
    new: complaints.filter((c) => c.status === "New").length,
    inProgress: complaints.filter((c) => c.status === "In Progress").length,
    resolved: complaints.filter((c) => c.status === "Resolved").length,
  }), [complaints]);

  const filteredComplaints = useMemo(() => (
    complaints.filter((c) => (statusFilter === "All" ? true : c.status === statusFilter))
  ), [complaints, statusFilter]);

  return (
    <div className="p-4 space-y-6">
      <Navbar />
      <h1 className="text-2xl font-bold">Complaints Admin Panel</h1>

      {/* --- MODIFIED: Color-Coded Stats Dashboard --- */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-sky-100 border-sky-200 text-sky-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
            <BarChart2 className="h-4 w-4 text-sky-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card className="bg-yellow-100 border-yellow-200 text-yellow-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.new}</div></CardContent>
        </Card>
        <Card className="bg-purple-100 border-purple-200 text-purple-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Loader2 className="h-4 w-4 text-purple-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.inProgress}</div></CardContent>
        </Card>
        <Card className="bg-green-100 border-green-200 text-green-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-700" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.resolved}</div></CardContent>
        </Card>
      </div>

      {/* Complaint Creation Form */}
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-4">Lodge a New Complaint</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label>1. Select Class</Label>
            <Select onValueChange={(value) => setSelectedClass(value)} value={selectedClass || ""}>
              <SelectTrigger><SelectValue placeholder="Select a class..." /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {selectedClass && (
            <div>
              <Label>2. Select Student</Label>
              <Select onValueChange={(value) => setSelectedStudent(value)} value={selectedStudent || ""}>
                 <SelectTrigger><SelectValue placeholder="Select a student..." /></SelectTrigger>
                 <SelectContent>{students.map((s) => <SelectItem key={s.studentid} value={s.studentid}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        {selectedStudent && (
          <div className="space-y-3 pt-4 border-t">
            <Input placeholder="Complaint Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea placeholder="Complaint Details" value={text} onChange={(e) => setText(e.target.value)} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="against-user">Complaint Against</Label>
                <Select value={againstUserId} onValueChange={setAgainstUserId}><SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>)}</SelectContent></Select>
              </div>
              <div>
                <Label htmlFor="assign-to-user">Assign To</Label>
                <Select value={assignedToUserId} onValueChange={setAssignedToUserId}><SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger><SelectContent>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={isPending}>{isPending ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4" />} Submit Complaint</Button>
          </div>
        )}
      </Card>

      {/* Existing Complaints Table */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">📋 Existing Complaints</h2>
          <div className="w-1/4"><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Filter by status..." /></SelectTrigger><SelectContent><SelectItem value="All">All Statuses</SelectItem>{complaintStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Student</TableHead><TableHead>Status</TableHead><TableHead>Assigned To</TableHead><TableHead>Against</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredComplaints.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell>{c.students?.name ?? "N/A"}</TableCell>
                <TableCell>{c.status}</TableCell>
                <TableCell>{c.assigned_to?.email ?? "N/A"}</TableCell>
                <TableCell>{c.against_user?.email ?? "N/A"}</TableCell>{/* --- MODIFIED: Show against user in table --- */}
                <TableCell><Button variant="outline" size="icon" onClick={() => openEditModal(c)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog (Modal) for Editing Complaints */}
      <Dialog open={!!editingComplaint} onOpenChange={() => setEditingComplaint(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Complaint: {editingComplaint?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
             {/* --- NEW: 'Against User' selector in Modal --- */}
            <div>
                <Label htmlFor="reassign-against">Complaint Against</Label>
                <Select value={newAgainstUserId} onValueChange={setNewAgainstUserId}>
                    <SelectTrigger id="reassign-against"><SelectValue placeholder="Select a user..." /></SelectTrigger>
                    <SelectContent>{users.map((user) => (<SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="reassign-to">Assign To</Label>
                <Select value={newAssignedToUserId} onValueChange={setNewAssignedToUserId}>
                    <SelectTrigger id="reassign-to"><SelectValue placeholder="Assign to a user..." /></SelectTrigger>
                    <SelectContent>{users.map((user) => (<SelectItem key={user.id} value={user.id}>{user.email}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            <div>
              <Label htmlFor="status">Complaint Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status"><SelectValue placeholder="Set status" /></SelectTrigger>
                <SelectContent>{complaintStatuses.map((status) => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Resolution Notes</Label>
              <textarea id="notes" placeholder="Add resolution notes here..." value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleUpdateComplaint} disabled={isPending}>{isPending && <Loader2 className="animate-spin mr-2" />}Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}