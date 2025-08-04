import Link from 'next/link';
import Navbar from '../components/Navbar';
import Hero from '../components/home/Hero';
import Functionalities from '../components/home/Functionalities';
import FAQ from '../components/home/FAQ';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';

const Home = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar className="absolute top-0 left-0 right-0 z-10" />
      
      {/* Hero Section with School Branding */}
      <section className="relative flex flex-col items-center justify-center text-center py-20 bg-gradient-to-b from-blue-600 to-blue-800 text-white">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          DAR-E-ARQAM SCHOOL<br />Q BLOCK MODEL TOWN
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mb-8">
          Attendance Management System for Smart, Efficient & Accurate Record Keeping
        </p>
        <Link href="/login">
          <Button size="lg" className="bg-white text-blue-700 hover:bg-gray-100">
            Login to Manage Attendance
          </Button>
        </Link>
      </section>

      <main>
        
        <FAQ />
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;
