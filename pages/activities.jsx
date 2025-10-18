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
import { Loader2, RefreshCw } from "lucide-react";

export default function ActivitiesTracker() {
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");

  // Date range filter
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Subjects mapping
  const SUBJECTS_ENUM = {
    group1: [
      "English",
      "Urdu",
      "Maths",
      "Meri Dilchasp Dunya",
      "Islamiyat",
      "Conversation",
    ],
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
  };

  const orderPG = ["PG", "Nursery", "Prep"];
  const order12 = [
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
  ];

  const getGroupName = (className) => {
    if (!className) return null;
    if (orderPG.includes(className)) return "group1";
    if (order12.includes(className)) return "group2";
    return null;
  };

  const getOrderedClasses = (list) => {
    const g1 = orderPG
      .map((n) => list.find((c) => c.name === n))
      .filter(Boolean);
    const g2 = order12
      .map((n) => list.find((c) => c.name === n))
      .filter(Boolean);
    return [...g1, ...g2];
  };

  // Initial load
  useEffect(() => {
    fetchClasses();
  }, []);

  // Refetch activities when date range changes
  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  async function fetchClasses() {
    setLoading(true);
    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      .order("id", { ascending: true });
    if (error) {
      console.error(error);
    } else if (data) {
      setClasses(getOrderedClasses(data));
    }
    setLoading(false);
  }

  async function fetchActivities() {
    setLoading(true);
    let query = supabase
      .from("activities")
      .select("id, class_id, subject, description, date, created_at")
      .order("date", { ascending: false });

    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);

    const { data, error } = await query;
    if (error) console.error(error);
    else setRecords(data || []);
    setLoading(false);
  }

  // Insert a single activity row (no counts in DB)
  async function handleAdd(e) {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !description.trim()) {
      alert("Please fill all fields");
      return;
    }

    const payload = {
      class_id: Number(selectedClass),
      subject: selectedSubject,
      description: description.trim(),
      date: date || new Date().toISOString().split("T")[0],
    };

    startTransition(async () => {
      const { error } = await supabase.from("activities").insert(payload);
      if (error) {
        alert(error.message);
      } else {
        setSelectedClass("");
        setSelectedSubject("");
        setDescription("");
        setDate("");
        await fetchActivities();
      }
    });
  }

  // UPDATED: Calculate the total count of activities for each class and subject
  const activityCountsByKey = useMemo(() => {
    const counts = {};
    for (const rec of records) {
      const key = `${rec.class_id}|${rec.subject}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [records]);


  const group1Ids = useMemo(
    () => classes.filter((c) => orderPG.includes(c.name)).map((c) => c.id),
    [classes]
  );
  const group2Ids = useMemo(
    () => classes.filter((c) => order12.includes(c.name)).map((c) => c.id),
    [classes]
  );

  function getSubjectsForClassId(classId) {
    const name = classes.find((c) => c.id === classId)?.name;
    const group = getGroupName(name);
    return group ? SUBJECTS_ENUM[group] : [];
    
  }

  function getColorRelativeToAvg(value, avg) {
    if (value === undefined || value === null || avg === undefined)
      return "text-muted-foreground";
    if (value >= avg) return "text-green-600 dark:text-green-400 font-semibold";
    return "text-red-600 dark:text-red-400 font-semibold";
  }

  function renderTable(classIds, title) {
    const firstName = classes.find((c) => c.id === classIds[0])?.name;
    const group = getGroupName(firstName);
    const subjects = group ? SUBJECTS_ENUM[group] : [];

    // Column averages
    const colAvg = {};
    for (const s of subjects) {
      let total = 0;
      let count = 0;
      for (const cid of classIds) {
        const key = `${cid}|${s}`;
        const v = activityCountsByKey[key]; // UPDATED
        if (typeof v === "number") {
          total += v;
          count++;
        }
      }
      colAvg[s] = count ? total / count : 0;
    }

    return (
      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-4 text-primary">{title}</h2>
        {subjects.length === 0 ? (
          <p className="text-muted-foreground italic">No activity entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Card className="p-4 shadow-sm rounded-2xl bg-card text-card-foreground min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-muted/50">Class</TableHead>
                    {subjects.map((s) => (
                      <TableHead key={s} className="bg-muted/50">
                        {s}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classIds.map((cid) => {
                    const cls = classes.find((c) => c.id === cid);
                    return (
                      <TableRow key={cid} className="hover:bg-muted/30">
                        <TableCell className="font-semibold">
                          {cls?.name ?? "—"}
                        </TableCell>
                        {subjects.map((s) => {
                          const key = `${cid}|${s}`;
                          const value = activityCountsByKey[key]; // UPDATED
                          return (
                            <TableCell key={s}>
                              {value !== undefined ? (
                                // UPDATED: Removed the date display
                                <span className={getColorRelativeToAvg(value, colAvg[s])}>
                                  {value}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Average</TableCell>
                    {subjects.map((s) => (
                      <TableCell key={s}>
                        {colAvg[s] ? colAvg[s].toFixed(1) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gradient-to-b from-background to-background/40">
      <Navbar />

      <div className="flex items-center justify-between gap-4 mt-4 mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">📝 Activities Tracker</h1>
        <Button
          variant="outline"
          onClick={() => fetchActivities()}
          disabled={loading || isPending}
          className="gap-2"
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Refresh
        </Button>
      </div>

      {/* Form */}
      <form
        onSubmit={handleAdd}
        className="mb-8 grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-card p-4 rounded-2xl shadow border"
      >
        <select
          className="border rounded-lg p-2 bg-background text-foreground"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value ? Number(e.target.value) : "")}
          required
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="border rounded-lg p-2 bg-background text-foreground disabled:opacity-50"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          required
          disabled={!selectedClass}
        >
          <option value="">Select Subject</option>
          {!!selectedClass &&
            getSubjectsForClassId(Number(selectedClass)).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
        </select>

        <Input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="bg-background"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-background"
        />
        <Button type="submit" disabled={isPending} className="gap-2">
          {isPending && <Loader2 className="animate-spin" size={16} />} Add Activity
        </Button>
      </form>

      {/* Date Range */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-3 items-end bg-card p-4 rounded-2xl shadow border">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-background"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            Clear
          </Button>
          <Button type="button" onClick={() => fetchActivities()}>
            Apply
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-center opacity-80">Loading…</p>
      ) : (
        <>
          {renderTable(group1Ids, "PG, Nursery, Prep")}
          {renderTable(group2Ids, "One to Eight")}
        </>
      )}
    </div>
  );
}