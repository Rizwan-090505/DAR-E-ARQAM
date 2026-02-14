import React from 'react';
import { 
  BookOpen, 
  MessageCircle, 
  Book,
  Download,
  FileText,
  ArrowRight,
  ShieldCheck,
  Heart,
  Globe,
  HelpCircle
} from 'lucide-react';

const syllabusData = [
  { id: '01', grade: 'Play Group', category: 'Preschool', description: 'Basic Concepts, Phonics & General Assessment', link: 'https://drive.google.com/file/d/15WVrQJ5vSqmhr8el68JP_Q4aF4aRpKdN/view?usp=sharing' },
  { id: '02', grade: 'Nursery', category: 'Preschool', description: 'Early Childhood Education & Activity Based Learning', link: 'https://drive.google.com/file/d/1qTuOQ-rJ3wdNFeuCb46O0anrB2-c-_vr/view?usp=sharing' },
  { id: '03', grade: 'Prep', category: 'Preschool', description: 'School Readiness & Foundational Phonics', link: 'https://drive.google.com/file/d/11IPtJmhCU4ousXVVR8SfogdlyskAMlQr/view?usp=sharing' },
  { id: '04', grade: 'Class 1', category: 'Primary', description: 'English, Urdu, Mathematics Basics & Nazra', link: 'https://drive.google.com/file/d/1gNwazxKXzyQ9V4b6wq7hMEtLFZ7XTBZI/view?usp=sharing' },
  { id: '05', grade: 'Class 2', category: 'Primary', description: 'Reading Fluency & Foundational Learning', link: 'https://drive.google.com/file/d/1cf_rBAk7foX2yNGxkmyV-4LAsmdnvPQf/view?usp=sharing' },
  { id: '06', grade: 'Class 3', category: 'Primary', description: 'Core Subjects Development & Science Intro', link: 'https://drive.google.com/file/d/1miGFuBjyNGF3xOe5imfy0X_Ou2Vxh5qq/view?usp=sharing' },
  { id: '07', grade: 'Class 4', category: 'Primary', description: 'Advanced Primary Concepts & Comprehension', link: 'https://drive.google.com/file/d/1YTm6ZmLuTys8IYhibZlf2SZpAupSOJWt/view?usp=sharing' },
  { id: '08', grade: 'Class 5', category: 'Primary', description: 'Primary Board Preparation Syllabus', link: 'https://drive.google.com/file/d/1uUHUf1ptmvB1r9fmNkep4Zd2TCp-F9fP/view?usp=sharing' },
  { id: '09', grade: 'Class 6', category: 'Middle School', description: 'Middle School Transition & Core Sciences', link: 'https://drive.google.com/file/d/1wDQePi8GqEXZvE3EsMlL9WLsl0kyViR2/view?usp=sharing' },
  { id: '10', grade: 'Class 7', category: 'Middle School', description: 'Standardized Middle School Curriculum', link: 'https://drive.google.com/file/d/1_4dJJB6-E0uKDyo4sWRajbS6SZ1boaBe/view?usp=sharing' },
  { id: '11', grade: 'Class 8', category: 'Middle School', description: 'Middle School Board Exam Preparation', link: 'https://drive.google.com/file/d/1jKB65pOIvRu4yTJXKgRiDU1s4Ql9dbyV/view?usp=sharing' },
];

export default function AdmissionSyllabusPage() {
  const whatsappNumber = "923234447292"; 
  const whatsappMessage = encodeURIComponent("Hello! I am looking at the admission test syllabus. Can you provide more details about the admission process?");
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <>
      <style>{`
        /* Core Backgrounds */
        .c-bg-main { background-color: #FDFDFE; color: #0F172A; }
        .c-bg-grid {
          background-image: radial-gradient(#E2E8F0 1.5px, transparent 1.5px);
          background-size: 36px 36px;
        }
        
        /* Navigation */
        .c-nav { 
          background-color: rgba(255, 255, 255, 0.9); 
          border-bottom: 1px solid #F1F5F9; 
          box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.05); 
        }
        .c-logo-box { background: linear-gradient(135deg, #047857, #059669); }
        
        /* Buttons */
        .c-btn-whatsapp { 
          background-color: #25D366; 
          color: #FFFFFF; 
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25); 
        }
        .c-btn-whatsapp:hover { 
          background-color: #1EBE5D; 
          box-shadow: 0 6px 16px rgba(37, 211, 102, 0.35); 
          transform: translateY(-2px);
        }
        
        /* Text Gradients */
        .c-text-grad-1 { background: linear-gradient(to right, #047857, #10B981); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        
        /* Syllabus Cards (Now the main focus) */
        .c-card-outline { 
          background-color: #FFFFFF; 
          border: 1px solid #E2E8F0; 
          box-shadow: 0 4px 15px -3px rgba(0,0,0,0.02); 
        }
        .c-card-outline:hover { 
          border-color: #34D399; 
          box-shadow: 0 15px 30px -5px rgba(4, 120, 87, 0.1); 
          transform: translateY(-4px); 
        }
        .c-id-box { background-color: #F1F5F9; color: #64748B; }
        .c-card-outline:hover .c-id-box { background-color: #047857; color: #FFFFFF; }
        
        .c-btn-download { background-color: #F8FAFC; color: #475569; border: 1px solid #E2E8F0; }
        .c-btn-download:hover { background-color: #047857; color: #FFFFFF; border-color: #047857; }

        /* Subtle Marketing Section */
        .c-marketing-bg {
          background: linear-gradient(to bottom, #FDFDFE, #F8FAFC);
          border-top: 1px solid #F1F5F9;
        }

        /* Ambient Animations */
        @keyframes custom-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.05); opacity: 0.5; }
        }
        .c-blob-1 { background-color: #A7F3D0; animation: custom-float 12s infinite ease-in-out; }
      `}</style>

      {/* Main Wrapper */}
      <div className="c-bg-main c-bg-grid min-h-screen relative font-sans overflow-x-hidden selection:bg-emerald-100 selection:text-emerald-900">
        
        {/* Subtle Ambient Background Blob */}
        <div className="c-blob-1 absolute rounded-full mix-blend-multiply blur-[120px] z-0 top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] pointer-events-none"></div>

        {/* Navigation */}
        <nav className="c-nav sticky top-0 z-[100] backdrop-blur-md">
          <div className="flex justify-between items-center py-4 px-4 sm:px-8 max-w-7xl mx-auto">
            
            {/* Logo */}
            <a href="/" className="flex items-center gap-3 cursor-pointer no-underline group">
              <div className="c-logo-box w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3">
                <BookOpen size={22} color="#FFFFFF" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-slate-900 text-base sm:text-xl font-black leading-none mb-1 tracking-tight">DAR-E-ARQAM</span>
                <span className="text-emerald-700 text-[0.6rem] sm:text-xs font-bold uppercase tracking-[0.15em] leading-none">School System</span>
              </div>
            </a>

            {/* Nav CTA */}
            <a 
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="c-btn-whatsapp inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300"
            >
              <MessageCircle size={18} />
              <span className="hidden sm:inline"></span>
              <span className="sm:hidden">Contact Us</span>
            </a>
          </div>
        </nav>

        <main className="relative z-10">
          
          {/* FOCUSED HERO SECTION */}
          <section className="pt-16 pb-12 px-4 sm:px-6 max-w-7xl mx-auto text-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white shadow-sm mb-6">
              <FileText size={16} className="text-emerald-400" />
              <span className="text-xs sm:text-sm font-semibold tracking-wide">Academic Year 2026</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-5 tracking-tight text-slate-900">
              Admission Test <span className="c-text-grad-1">Syllabus</span>
            </h1>
            
            <p className="text-slate-600 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
              Download the official class-wise preparation outlines to help your child confidently prepare for the Dar-e-Arqam entrance exams.
            </p>
          </section>

          {/* MAIN CONTENT: SYLLABUS GRID */}
          <section className="px-4 sm:px-6 max-w-7xl mx-auto mb-24">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 xl:gap-6">
              {syllabusData.map((item) => (
                <div key={item.id} className="c-card-outline p-5 sm:p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 group bg-white">
                  
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="c-id-box w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300">
                        {item.id}
                      </div>
                      <span className="bg-slate-100 text-slate-500 text-[0.65rem] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md">
                        {item.category}
                      </span>
                    </div>
                    
                    <h3 className="text-slate-900 text-xl font-bold mb-2 group-hover:text-emerald-700 transition-colors duration-300">
                      {item.grade}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="c-btn-download w-full py-3 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all duration-300"
                  >
                    <Download size={18} />
                    <span>Download PDF</span>
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* SUBTLE MARKETING SECTION */}
          <section className="c-marketing-bg py-20 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
              
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Why to choose DAR-E-ARQAM</h2>
                <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
                  A balanced approach combining modern academic excellence with deep-rooted Islamic values.
                </p>
              </div>

              {/* Compact Feature Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                <div className="flex flex-col sm:flex-row md:flex-col items-center sm:items-start md:items-center text-center sm:text-left md:text-center gap-4">
                  <div className="bg-emerald-50 text-emerald-700 p-4 rounded-full shrink-0">
                    <Globe size={28} />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-lg mb-2">SNC Approved</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Single National Curriculum tailored for modern, competitive academic excellence.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-center sm:items-start md:items-center text-center sm:text-left md:text-center gap-4">
                  <div className="bg-sky-50 text-sky-600 p-4 rounded-full shrink-0">
                    <Book size={28} />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-lg mb-2">Quranic Studies</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Compulsory Nazra & dedicated optional Hifz-e-Quran programs led by expert scholars.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-center sm:items-start md:items-center text-center sm:text-left md:text-center gap-4">
                  <div className="bg-amber-50 text-amber-600 p-4 rounded-full shrink-0">
                    <Heart size={28} />
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-lg mb-2">Character Building</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      Deep focus on Tarbiyah, ethics, and moral values aligned with Islamic teachings.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* BOTTOM CTA (Subtle reminder to contact) */}
          <section className="py-16 px-4 sm:px-6 max-w-4xl mx-auto text-center">
            <div className="bg-emerald-700 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
              {/* Background Decor */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
              
              <div className="relative z-10">
                <HelpCircle size={40} className="text-emerald-100 mx-auto mb-4" />
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Have Questions About Admissions?</h2>
                <p className="text-emerald-100 text-base sm:text-lg mb-8 max-w-xl mx-auto">
                  Our admissions team is ready to guide you through the process, test dates, and fee structures.
                </p>
                <a 
                  href={whatsappLink} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-white text-emerald-800 font-bold text-sm sm:text-base hover:bg-slate-50 hover:scale-105 transition-all duration-300"
                >
                  <MessageCircle size={20} className="text-emerald-600" />
                  Chat on WhatsApp
                </a>
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
