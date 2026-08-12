import { HashRouter, Route, Routes } from "react-router";
import { Home } from "./ui/pages/Home";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </HashRouter>
  );
}
