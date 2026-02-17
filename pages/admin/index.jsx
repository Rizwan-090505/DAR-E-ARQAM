import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import Navbar from '../../components/Navbar'
import Loader from '../../components/Loader'
import Breadcrumbs from '../../components/Breadcrumbs'
import { 
  Users, 
  UserPlus,
  FileText, 
  Banknote, 
  MessageSquareWarning, 
  Database, 
  FilePlus, 
  Wallet, 
  HelpCircle, 
  AlertCircle,
  ChevronRight,
  BarChart3
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from "../../hooks/use-toast"

export default function AdminDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    newAdmissions: 0,
    recentInquiries: 0,
    unresolvedComplaints: 0,
    recentInvoices: 0,
    uniquePayments: 0
  })

  useEffect(() => {
    fetchAdminStats()
  }, [])

  const fetchAdminStats = async () => {
    setIsLoading(true)
    
    // Calculate 30 days ago from exactly right now
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()

    try {
      // 1. Total number of students
      // Using { count: 'exact', head: true } bypasses the 1000 row download limit, returning just the count integer
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })

      // 2. Admissions in the last 30 days (joining_date)
      const { count: newAdmissions } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .gte('joining_date', thirtyDaysAgoStr)

      // 3. Inquiries in the last 30 days
      const { count: recentInquiries } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgoStr)

      // 4. Unresolved complaints in last 30 days (status != Resolved AND status != Closed)
      const { count: unresolvedComplaints } = await supabase
        .from('complaints')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgoStr)
        .neq('status', 'Resolved')
        .neq('status', 'Closed')

      // 5. Total invoices generated in the last 30 days
      // Note: Assumed table is fee_invoices based on existing code, filtered by created_at
      const { count: recentInvoices } = await supabase
        .from('fee_invoices')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgoStr)

      // 6. Distinct invoice payments in the last 30 days
      // Implemented a pagination loop to safely fetch data if payments exceed the 1000 row Supabase limit
      let allPayments = []
      let hasMore = true
      let page = 0
      const limit = 1000

      while (hasMore) {
        const { data, error } = await supabase
          .from('fee_payments')
          .select('invoice_id')
          .gte('paid_at', thirtyDaysAgoStr)
          .range(page * limit, (page + 1) * limit - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allPayments.push(...data)
          page++
          if (data.length < limit) hasMore = false // We've reached the end
        } else {
          hasMore = false
        }
      }
      
      // Filter distinct invoice_ids using a Set
      const uniquePayments = new Set(allPayments.map(p => p.invoice_id)).size

      // Update state with all fetched values
      setStats({ 
        totalStudents: totalStudents || 0, 
        newAdmissions: newAdmissions || 0, 
        recentInquiries: recentInquiries || 0, 
        unresolvedComplaints: unresolvedComplaints || 0, 
        recentInvoices: recentInvoices || 0,
        uniquePayments: uniquePayments || 0
      })

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
        { label: "Fee Reports", icon: BarChart3, href: "/admin/report", color: "text-cyan-600", bg: "bg-cyan-500/10", border: "border-cyan-200 dark:border-cyan-500/20" },
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
      
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8 pb-20">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/admin' }]} />

        {/* HEADER */}
        <div className="flex flex-row justify-between items-end border-b border-slate-200 dark:border-white/5 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
               Admin Overview
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Last 30 Days Snapshot
            </p>
          </div>
        </div>

        {/* STATS: High Density Row updated to fit 6 cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
           <StatsCard icon={Users} label="Total Students" value={stats.totalStudents} color="blue" />
           <StatsCard icon={UserPlus} label="New Admissions" value={stats.newAdmissions} color="indigo" />
           <StatsCard icon={HelpCircle} label="New Inquiries" value={stats.recentInquiries} color="amber" />
           <StatsCard icon={AlertCircle} label="Active Complaints" value={stats.unresolvedComplaints} color="rose" />
           <StatsCard icon={FileText} label="Invoices Generated" value={stats.recentInvoices} color="orange" />
           <StatsCard icon={Banknote} label="Invoices Paid" value={stats.uniquePayments} color="emerald" />
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
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
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
