import { HashRouter, Route, Routes } from "react-router";
import { Home } from "./ui/pages/Home";
import { LeaguePicker } from "./ui/pages/LeaguePicker";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/leagues/:username" element={<LeaguePicker />} />
      </Routes>
    </HashRouter>
  );
}
