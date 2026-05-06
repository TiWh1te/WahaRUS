import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Tournament from "./pages/Tournament";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:id" element={<Tournament />} />
      </Routes>
    </BrowserRouter>
  );
}