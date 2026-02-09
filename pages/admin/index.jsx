import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import Navbar from '../../components/Navbar'
import Loader from '../../components/Loader'
import Breadcrumbs from '../../components/Breadcrumbs'
import { 
  Users, 
  Layers, 
  FileText, 
  CreditCard, 
  Banknote, 
  MessageSquareWarning, 
  Database, 
  FilePlus, 
  Wallet, 
  HelpCircle, 
  ArrowRight,
  AlertCircle,
  TrendingUp,
  ChevronRight
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from "../../hooks/use-toast"

export default function AdminDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  
  const [stats, setStats] = useState({
    studentCount: 0,
    classCount: 0,
    monthlyInvoices: 0,
    monthlyPayingStudents: 0,
    monthlyComplaints: 0
  })

  useEffect(() => {
    fetchAdminStats()
  }, [])

  const fetchAdminStats = async () => {
    setIsLoading(true)
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

    try {
      const { count: studentCount } = await supabase.from('students').select('*', { count: 'exact', head: true })
      const { count: classCount } = await supabase.from('classes').select('*', { count: 'exact', head: true })
      const { count: monthlyInvoices } = await supabase.from('fee_invoices').select('*', { count: 'exact', head: true }).gte('invoice_date', firstDay).lte('invoice_date', lastDay)
      
      const { data: payments } = await supabase.from('fee_payments').select('invoice_id').gte('paid_at', firstDay).lte('paid_at', lastDay)
      let uniquePayingStudents = 0
      if (payments && payments.length > 0) {
        const invoiceIds = payments.map(p => p.invoice_id)
        const { data: paidInvoices } = await supabase.from('fee_invoices').select('student_id').in('id', invoiceIds)
        uniquePayingStudents = new Set(paidInvoices?.map(i => i.student_id)).size
      }

      const { count: monthlyComplaints } = await supabase.from('complaints').select('*', { count: 'exact', head: true }).gte('created_at', firstDay).lte('created_at', lastDay)

      setStats({ studentCount: studentCount || 0, classCount: classCount || 0, monthlyInvoices: monthlyInvoices || 0, monthlyPayingStudents: uniquePayingStudents, monthlyComplaints: monthlyComplaints || 0 })

    } catch (error) {
      console.error('Error fetching admin stats:', error)
      toast({ variant: "destructive", title: "Data Error", description: "Failed to load stats." })
    } finally {
      setIsLoading(false)
    }
  }

  // Configuration for Navigation Links
  const adminLinks = [
    { 
      title: "Fee Management", 
      description: "Billing & Collections",
      links: [
        { label: "Generate Fee", icon: FilePlus, href: "/admin/fee/generate", color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
        { label: "Fee Receipts", icon: Wallet, href: "/admin/receipts", color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20" },
        { label: "All Invoices", icon: FileText, href: "/admin/invoices", color: "text-teal-600", bg: "bg-teal-500/10", border: "border-teal-200 dark:border-teal-500/20" },
      ]
    },
    { 
      title: "Students", 
      description: "Records & Admissions",
      links: [
        { label: "Admissions", icon: FileText, href: "/admin/managestudent", color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-200 dark:border-blue-500/20" },
        { label: "Student Records", icon: Database, href: "/admin/crud", color: "text-indigo-600", bg: "bg-indigo-500/10", border: "border-indigo-200 dark:border-indigo-500/20" },
        { label: "Inquiries", icon: HelpCircle, href: "/admin/inquiries", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/20" },
      ]
    },
    { 
      title: "Operations", 
      description: "Staff & HR",
      links: [
        { label: "Staff Advances", icon: Banknote, href: "/admin/advances", color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-200 dark:border-purple-500/20" },
        { label: "Complaints", icon: MessageSquareWarning, href: "/admin/complaint", color: "text-rose-600", bg: "bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/20" },
      ]
    }
  ]

  if (isLoading) return <Loader />

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-8 pb-20">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/admin' }]} />

        {/* HEADER: Compact & Clean */}
        <div className="flex flex-row justify-between items-end border-b border-slate-200 dark:border-white/5 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
               Admin Overview
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} 
            </p>
          </div>
        </div>

        {/* STATS: High Density Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
           <StatsCard icon={Users} label="Total Students" value={stats.studentCount} color="blue" />
           <StatsCard icon={Layers} label="Active Classes" value={stats.classCount} color="indigo" />
           <StatsCard icon={FileText} label="Invoices Generated" value={stats.monthlyInvoices} color="orange" />
           <StatsCard icon={Banknote} label="Paid This Month" value={stats.monthlyPayingStudents} color="emerald" />
           <StatsCard icon={AlertCircle} label="Pending Complaints" value={stats.monthlyComplaints} color="rose" />
        </div>

        {/* NAVIGATION: Compact Grid */}
        <div className="space-y-8">
          {adminLinks.map((section, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="flex items-center gap-2 mb-3">
                 <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{section.title}</h2>
                 <div className="h-px bg-slate-200 dark:bg-white/5 flex-1"></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {section.links.map((link, lIdx) => (
                  <div
                    key={lIdx}
                    onClick={() => router.push(link.href)}
                    className={`
                        group relative cursor-pointer
                        flex items-center gap-3
                        rounded-xl border border-slate-200 dark:border-white/10
                        bg-white dark:bg-white/5 
                        p-3 hover:border-slate-300 dark:hover:border-white/20
                        shadow-sm hover:shadow-md
                        transition-all duration-200
                    `}
                  >
                    {/* Icon */}
                    <div className={`
                      p-2 rounded-lg shrink-0
                      ${link.bg} ${link.color} 
                      border ${link.border}
                    `}>
                      <link.icon className="w-4 h-4" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate transition-colors">
                        {link.label}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400" />
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  )
}

// --- SUB-COMPONENT: Compact Stats Card ---
function StatsCard({ icon: Icon, label, value, color }) {
  const styles = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
    indigo: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
    orange: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    rose: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10",
  }[color]

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate mr-2">
          {label}
        </p>
        <div className={`p-1.5 rounded-md ${styles}`}>
           <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            {value}
        </h3>
      </div>
    </div>
  )
}
