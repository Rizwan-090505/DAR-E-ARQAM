"use client";

import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { format } from "date-fns";

const InquiryForm = () => {
  const [form, setForm] = useState({
    name: "",
    class: "PG",
    fathername: "",
    address: "",
    previous_school: "",
    mobilenumber: "",
    date: format(new Date(), "yyyy-MM-dd"),
    session: "Fall",
    year: new Date().getFullYear(),
    quoted_fee: "",
    number_of_children: 1,
  });

  const [inquiries, setInquiries] = useState([]);

  const fetchInquiries = async () => {
    const { data, error } = await supabase.from("inquiries").select("*").order("id", { ascending: false });
    if (error) console.error("Error fetching inquiries:", error);
    else setInquiries(data);
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleSubmit = async () => {
    // Optional: Trim fields
    const trimmedForm = {
      ...form,
      name: form.name.trim(),
      fathername: form.fathername.trim(),
      mobilenumber: form.mobilenumber.trim(),
    };

    const { data, error } = await supabase.from("inquiries").insert([trimmedForm]).select();

    if (error) {
      console.error("Error saving inquiry:", error);
      return;
    }

    const newInquiry = data?.[0];
    if (newInquiry) {
      const messageText = `*Mr./Mrs. ${trimmedForm.fathername}*,\n\nThank you for visiting *DAR-E-ARQAM School* for the admission inquiry of your child *${trimmedForm.name}* on *${trimmedForm.date}*.\n\nWe truly appreciate your time and interest in our school.\n\nIf you have any further questions or need assistance, please don't hesitate to contact us.\n\nWe look forward to the possibility of welcoming your child to our *DAR-E-ARQAM* family.\n\n*Warm regards,*\nAdmissions Office\n📞 0323-4447292`;

      const { error: messageError } = await supabase.from("messages").insert([
        {
          
          number: trimmedForm.mobilenumber, // ✅ Corrected syntax
          text: messageText,
        },
      ]);

      if (messageError) {
        console.error("Error inserting message:", messageError);
      }
    }

    // Reset relevant fields only
    setForm({
      ...form,
      name: "",
      fathername: "",
      address: "",
      mobilenumber: "",
      previous_school: "",
      quoted_fee: "",
    });

    fetchInquiries();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-xl rounded-xl space-y-6">
      <h1 className="text-3xl font-bold text-center text-gray-800">Admission Inquiry Form</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="Child's Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Class (e.g. PG, One, Hifz)" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} />
        <Input placeholder="Father's Name" value={form.fathername} onChange={(e) => setForm({ ...form, fathername: e.target.value })} />
        <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

        <div>
          <label className="block text-sm font-medium mb-1">Previous School</label>
          <Input
            list="school-options"
            placeholder="Enter or select school"
            value={form.previous_school}
            onChange={(e) => setForm({ ...form, previous_school: e.target.value })}
          />
          <datalist id="school-options">
            <option value="WISSEN Grammar" />
            <option value="Unique Ravian" />
            <option value="American Lyceum" />
            <option value="Other" />
          </datalist>
        </div>

        <Input placeholder="Mobile Number" value={form.mobilenumber} onChange={(e) => setForm({ ...form, mobilenumber: e.target.value })} />
        <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <Input placeholder="Session (Fall/Spring)" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} />
        <Input type="number" placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
        <Input type="text" placeholder="Quoted Fee" value={form.quoted_fee} onChange={(e) => setForm({ ...form, quoted_fee: e.target.value })} />
        <Input type="number" placeholder="Number of Children" value={form.number_of_children} onChange={(e) => setForm({ ...form, number_of_children: Number(e.target.value) })} />
      </div>

      <div className="flex justify-center">
        <Button className="px-8 py-2 text-lg" onClick={handleSubmit}>Submit Inquiry</Button>
      </div>

      <hr className="my-6" />

      <h2 className="text-2xl font-semibold text-gray-700">Recent Inquiries</h2>
      <ul className="space-y-3 max-h-80 overflow-y-auto">
        {inquiries.map((inq) => (
          <li key={inq.id} className="p-4 bg-gray-50 rounded-md border">
            <p className="text-lg font-semibold">{inq.name} <span className="text-sm text-gray-500">({inq.class})</span></p>
            <p className="text-sm text-gray-600">Father: {inq.fathername} | Mobile: {inq.mobilenumber}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InquiryForm;
