import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { LandingPage } from "@/pages/LandingPage";
import { PricingPage } from "@/pages/PricingPage";
import { ProcessPage } from "@/pages/ProcessPage";

function App() {
  return (
    <BrowserRouter>
      <div className="dark min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/process" element={<ProcessPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
