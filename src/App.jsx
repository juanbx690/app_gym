import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/layout/BottomNav';
import Home from './pages/Home';
import Routines from './pages/Routines';
import Calendar from './pages/Calendar';
import Exercises from './pages/Exercises';
import History from './pages/History';
import CreateRoutine from './pages/CreateRoutine';
import LiveWorkout from './pages/LiveWorkout';

function App() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-slate-100 font-sans pb-20">
      <main className="flex-1 w-full max-w-md mx-auto relative px-4 pt-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/workout" element={<LiveWorkout />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/routines/new" element={<CreateRoutine />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

export default App;
