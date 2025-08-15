import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { useTheme } from "next-themes";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from "../components/ui/table";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import Navbar from "../components/Navbar";

export default function SyllabusTracker() {
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [weekNum, setWeekNum] = useState("");
  const [description, setDescription] = useState("");

  const { theme } = useTheme();

  const SUBJECTS_ENUM = {
    group1: ["English", "Urdu", "Maths","Meri Dilchasp Dunya","Islamiyat","Conversation"],
    group2: [
      "English",
      "Urdu",
      "Maths",
      "WA/SST/His-Geo",
      "Islamiat",
      "Computer",
      "Science",
      "Tarjuma tul Quran"
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
      "Pak Studies"
    ]
  };

  const getGroupName = (className) => {
    if (["PG", "Nursery", "Prep"].includes(className)) return "group1";
    if (
      [
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight"
      ].includes(className)
    )
      return "group2";
    if (["Nine", "Ten", "Pre-Nine","Trial"].includes(className)) return "group3";
    return null;
  };

  const getOrderedClasses = (classList) => {
    const order1 = ["PG", "Nursery", "Prep"];
    const order2 = [
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight"
    ];
    const group1 = order1
      .map((name) => classList.find((c) => c.name === name))
      .filter(Boolean);
    const group2 = order2
      .map((name) => classList.find((c) => c.name === name))
      .filter(Boolean);
    const group3 = classList.filter(
      (c) => !order1.includes(c.name) && !order2.includes(c.name)
    );
    return [...group1, ...group2, ...group3];
  };

  useEffect(() => {
    fetchClassesAndRecords();
  }, []);

  const fetchClassesAndRecords = async () => {
    setLoading(true);
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("id, name");

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
    if (!selectedClass || !selectedSubject || !weekNum || !description) {
      return alert("Please fill all fields");
    }

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return alert("Not logged in");

    const { error } = await supabase.from("syllabus_tracking").insert([
      {
        class_id: selectedClass,
        subject: selectedSubject,
        week_or_fortnight: Number(weekNum),
        description,
        teacher_id: user.id
      }
    ]);

    if (error) {
      alert(error.message);
    } else {
      setSelectedClass("");
      setSelectedSubject("");
      setWeekNum("");
      setDescription("");
      fetchClassesAndRecords();
    }
  };

  const getLatestRecords = (classIds) => {
    const latestMap = {};
    for (let rec of records) {
      if (classIds.includes(rec.class_id)) {
        const key = rec.class_id + "|" + rec.subject;
        if (
          !latestMap[key] ||
          new Date(rec.created_at) > new Date(latestMap[key].created_at)
        ) {
          latestMap[key] = rec;
        }
      }
    }
    return latestMap;
  };

  const getColorRelativeToAvg = (value, avg) => {
    if (!value) return "text-gray-400";
    if (value >= avg) return "text-green-500 font-semibold";
    return "text-red-500 font-semibold";
  };

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
        <h2 className="text-2xl font-bold mb-4 text-blue-700 dark:text-blue-300">
          {title}
        </h2>
        {subjects.length === 0 ? (
          <p className="text-gray-500 italic dark:text-gray-400">
            No syllabus entries yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Card className="p-4 shadow-lg border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 hover:shadow-xl transition-shadow min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-gray-100 dark:bg-gray-700">
                      Class
                    </TableHead>
                    {subjects.map((sub) => (
                      <TableHead
                        key={sub}
                        className="bg-gray-100 dark:bg-gray-700"
                      >
                        {sub}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classIds.map((cid) => {
                    const cls = classes.find((c) => c.id === cid);
                    return (
                      <TableRow
                        key={cid}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <TableCell className="font-bold">
                          {cls?.name || "Unknown"}
                        </TableCell>
                        {subjects.map((sub) => {
                          const rec = latestMap[cid + "|" + sub];
                          return (
                            <TableCell key={sub}>
                              {rec ? (
                                <span
                                  className={getColorRelativeToAvg(
                                    rec.week_or_fortnight,
                                    colAverages[sub]
                                  )}
                                >
                                  {rec.week_or_fortnight}
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
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const group1 = classes
    .filter((c) => ["PG", "Nursery", "Prep"].includes(c.name))
    .map((c) => c.id);
  const group2 = classes
    .filter((c) =>
      ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"].includes(
        c.name
      )
    )
    .map((c) => c.id);
  const group3 = classes
    .filter((c) => ["Nine", "Ten", "Trial"].includes(c.name))
    .map((c) => c.id);

  return (
    <div className="p-6 min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <Navbar />
      <h1 className="text-3xl font-extrabold mb-6 text-center text-blue-800 dark:text-blue-200 drop-shadow-sm">
        📚 Syllabus Tracker
      </h1>

      <form
        onSubmit={handleAdd}
        className="mb-8 grid grid-cols-1 md:grid-cols-5 gap-4 items-end bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700"
      >
        <select
          className="border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
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
          className="border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          required
          disabled={!selectedClass}
        >
          <option value="">Select Subject</option>
          {selectedClass &&
            (() => {
              const className = classes.find(
                (c) => c.id === Number(selectedClass)
              )?.name;
              const groupName = getGroupName(className);
              const subjects = groupName ? SUBJECTS_ENUM[groupName] : [];
              return subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ));
            })()}
        </select>

        <Input
          type="number"
          placeholder="Week No."
          value={weekNum}
          onChange={(e) => setWeekNum(e.target.value)}
          required
          className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <Input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        <Button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-center dark:text-gray-300">Loading...</p>
      ) : (
        <>
          {renderTable(group1, "PG, Nursery, Prep")}
          {renderTable(group2, "One to Eight")}
          {renderTable(group3, "Nine, Ten & Trial")}
        </>
      )}
    </div>
  );
}
