import { HashRouter, Route, Routes } from "react-router";
import { Home } from "./ui/pages/Home";
import { LeaguePicker } from "./ui/pages/LeaguePicker";
import { Dashboard } from "./ui/pages/Dashboard";
import { ManagerPage } from "./ui/pages/ManagerPage";
import { RecordBook } from "./ui/pages/RecordBook";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leagues/:username" element={<LeaguePicker />} />
        <Route path="/league/:leagueId" element={<Dashboard />} />
        <Route path="/league/:leagueId/history" element={<RecordBook />} />
        <Route path="/league/:leagueId/manager/:userId" element={<ManagerPage />} />
      </Routes>
    </HashRouter>
  );
}
