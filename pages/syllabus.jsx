"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { supabase } from "../utils/supabaseClient";
import Navbar from "../components/Navbar";
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
import { Card } from "../components/ui/card";
import { Loader2, RefreshCw, Plus } from "lucide-react";

export default function SyllabusTracker() {
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [weekNum, setWeekNum] = useState("");
  const [description, setDescription] = useState("");

  // Small UI filters
  const [search, setSearch] = useState("");

  const SUBJECTS_ENUM = {
    group1: ["English", "Urdu", "Maths", "Meri Dilchasp Dunya", "Islamiyat", "Conversation"],
    group2: [
      "English",
      "Urdu",
      "Maths",
      "WA/SST/His-Geo",
      "Islamiat",
      "Computer",
      "Science",
      "Tarjuma tul Quran",
    ],
    group3: [
      "English",
      "Urdu",
      "Maths",
      "Physics",
      "Chemistry",
      "Biology",
      "Computer",
      "Islamiat",
      "Tarjuma tul Quran",
      "Pak Studies",
    ],
  };

  const orderPG = ["PG", "Nursery", "Prep"];
  const order12 = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];

  const getGroupName = (className) => {
    if (["PG", "Nursery", "Prep"].includes(className)) return "group1";
    if (order12.includes(className)) return "group2";
    if (["Nine", "Ten", "Pre-Nine", "Trial"].includes(className)) return "group3";
    return null;
  };

  const getOrderedClasses = (classList) => {
    const order1 = ["PG", "Nursery", "Prep"];
    const order2 = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
    const group1 = order1.map((name) => classList.find((c) => c.name === name)).filter(Boolean);
    const group2 = order2.map((name) => classList.find((c) => c.name === name)).filter(Boolean);
    const group3 = classList.filter((c) => !order1.includes(c.name) && !order2.includes(c.name));
    return [...group1, ...group2, ...group3];
  };

  useEffect(() => {
    fetchClassesAndRecords();
  }, []);

  const fetchClassesAndRecords = async () => {
    setLoading(true);
    const { data: classData, error: classError } = await supabase.from("classes").select("id, name");
    const { data: recordData, error: recError } = await supabase
      .from("syllabus_tracking")
      .select("*")
      .order("created_at", { ascending: false });

    if (!classError && classData) setClasses(getOrderedClasses(classData));
    if (!recError && recordData) setRecords(recordData);
    setLoading(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !weekNum || !description.trim()) {
      return alert("Please fill all fields");
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Not logged in");

    const payload = {
      class_id: Number(selectedClass),
      subject: selectedSubject,
      week_or_fortnight: Number(weekNum),
      description: description.trim(),
      teacher_id: user.id,
    };

    startTransition(async () => {
      const { error } = await supabase.from("syllabus_tracking").insert([payload]);
      if (error) return alert(error.message);
      setSelectedClass("");
      setSelectedSubject("");
      setWeekNum("");
      setDescription("");
      await fetchClassesAndRecords();
    });
  };

  const getLatestRecords = (classIds) => {
    const latestMap = {};
    for (const rec of records) {
      if (classIds.includes(rec.class_id)) {
        const key = rec.class_id + "|" + rec.subject;
        if (!latestMap[key] || new Date(rec.created_at) > new Date(latestMap[key].created_at)) {
          latestMap[key] = rec;
        }
      }
    }
    return latestMap;
  };

  const getColorRelativeToAvg = (value, avg) => {
    if (!value) return "text-muted-foreground";
    if (value >= avg) return "text-green-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  // Small search / filter utility
  const filteredClasses = useMemo(() => {
    if (!search.trim()) return classes;
    const q = search.toLowerCase();
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, search]);

  const renderTable = (classIds, title) => {
    const latestMap = getLatestRecords(classIds);
    const sampleClassName = classes.find((c) => c.id === classIds[0])?.name;
    const groupName = getGroupName(sampleClassName);
    const subjects = groupName ? SUBJECTS_ENUM[groupName] : [];

    const colAverages = {};
    subjects.forEach((sub) => {
      let total = 0,
        count = 0;
      classIds.forEach((cid) => {
        const rec = latestMap[cid + "|" + sub];
        if (rec?.week_or_fortnight) {
          total += rec.week_or_fortnight;
          count++;
        }
      });
      colAverages[sub] = count ? total / count : 0;
    });

    return (
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-primary">{title}</h2>
          <div className="text-sm text-muted-foreground">Showing {classIds.length} classes</div>
        </div>

        {subjects.length === 0 ? (
          <p className="text-muted-foreground italic">No syllabus entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Card className="p-4 shadow-sm rounded-2xl bg-card text-card-foreground min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-muted/50">Class</TableHead>
                    {subjects.map((sub) => (
                      <TableHead key={sub} className="bg-muted/50">
                        {sub}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classIds.map((cid) => {
                    const cls = classes.find((c) => c.id === cid);
                    return (
                      <TableRow key={cid} className="hover:bg-muted/30">
                        <TableCell className="font-semibold">{cls?.name ?? "—"}</TableCell>
                        {subjects.map((sub) => {
                          const rec = latestMap[cid + "|" + sub];
                          return (
                            <TableCell key={sub}>
                              {rec ? (
                                <div>
                                  <span className={getColorRelativeToAvg(rec.week_or_fortnight, colAverages[sub])}>
                                    {rec.week_or_fortnight}
                                  </span>
                                  <div className="text-xs text-muted-foreground">{new Date(rec.created_at).toLocaleDateString()}</div>
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const group1 = filteredClasses.filter((c) => ["PG", "Nursery", "Prep"].includes(c.name)).map((c) => c.id);
  const group2 = filteredClasses.filter((c) => ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"].includes(c.name)).map((c) => c.id);
  const group3 = filteredClasses.filter((c) => ["Nine", "Ten", "Trial", "Pre-Nine"].includes(c.name)).map((c) => c.id);

  return (
    <div className="p-6 min-h-screen bg-gradient-to-b from-background to-background/40">
      <Navbar />

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-4 mt-6 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">📚 Syllabus Tracker</h1>
            <p className="text-sm text-muted-foreground mt-1">Add weekly/fortnightly entries and view latest per class & subject.</p>
          </div>

          <div className="flex items-center gap-2">
            <Input placeholder="Search classes (e.g. One)" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="outline" onClick={fetchClassesAndRecords} className="gap-2">
              <RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Refresh
            </Button>
          </div>
        </div>

        <Card className="p-4 mb-6 bg-card rounded-2xl shadow-sm border">
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <select className="border rounded-lg p-2 bg-background text-foreground" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} required>
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select className="border rounded-lg p-2 bg-background text-foreground disabled:opacity-50" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} required disabled={!selectedClass}>
              <option value="">Select Subject</option>
              {!!selectedClass && getGroupName(classes.find((c) => c.id === Number(selectedClass))?.name) && getGroupName(classes.find((c) => c.id === Number(selectedClass))?.name) && SUBJECTS_ENUM[getGroupName(classes.find((c) => c.id === Number(selectedClass))?.name)].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <Input type="number" placeholder="Week / Fortnight No." value={weekNum} onChange={(e) => setWeekNum(e.target.value)} required />

            <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} required />

            <div className="flex gap-2">
              <Button type="submit" className="flex items-center gap-2">
                <Plus size={16} /> Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setSelectedClass(""); setSelectedSubject(""); setWeekNum(""); setDescription(""); }}>
                Clear
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <p className="text-center text-muted-foreground">Loading…</p>
        ) : (
          <>
            {group1.length > 0 && renderTable(group1, "PG, Nursery, Prep")}
            {group2.length > 0 && renderTable(group2, "One to Eight")}
            {group3.length > 0 && renderTable(group3, "Nine, Ten & Trial")}
          </>
        )}
      </div>
    </div>
  );
}
