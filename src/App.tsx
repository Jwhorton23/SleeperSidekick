import { HashRouter, Route, Routes } from "react-router";
import { Home } from "./ui/pages/Home";
import { LeaguePicker } from "./ui/pages/LeaguePicker";
import { Dashboard } from "./ui/pages/Dashboard";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leagues/:username" element={<LeaguePicker />} />
        <Route path="/league/:leagueId" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
}
