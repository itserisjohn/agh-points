"use client";

import { useState, useEffect } from "react";
import Navigation from "../components/Navigation";
import CustomerSection from "../components/CustomerSection";
import AdminSection from "../components/AdminSection";
import RegisterSection from "../components/RegisterSection";

export default function Home() {
  const [activeSection, setActiveSection] = useState("admin");

  // Prevent page refresh warning
  // useEffect(() => {
  //   const handleBeforeUnload = (event) => {
  //     const message =
  //       "Are you sure you want to leave? Your changes may not be saved.";
  //     event.preventDefault();
  //     event.returnValue = message;
  //     return message;
  //   };

  //   window.addEventListener("beforeunload", handleBeforeUnload);

  //   return () => {
  //     window.removeEventListener("beforeunload", handleBeforeUnload);
  //   };
  // }, []);

  const handleSectionChange = (section) => {
    setActiveSection(section);
  };

  return (
    <div className="container">
      <div className="header">
        <img
          src="/agh-logo.png"
          alt="Aeros Gaming Hub Logo"
          style={{ height: "160px", marginBottom: "0px" }}
        />
        <h1>Aeros Gaming Hub</h1>
        <h1>Points Rewards</h1>
      </div>

      <Navigation
        activeSection={activeSection}
        setActiveSection={handleSectionChange}
      />

      <div className="content">
        <CustomerSection isActive={activeSection === "customer"} />
        <AdminSection isActive={activeSection === "admin"} />
        <RegisterSection isActive={activeSection === "register"} />
      </div>
    </div>
  );
}
