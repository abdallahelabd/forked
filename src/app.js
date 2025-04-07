import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import BioSite from "./BioSite";
import AdminChatPage from "./AdminChatPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BioSite />} />
        <Route path="/admin-chat" element={<AdminChatPage />} />
      </Routes>
    </Router>
  );
}

export default App;
