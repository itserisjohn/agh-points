"use client";

import { useState, useEffect } from "react";
import Navigation from "../components/Navigation";
import AdminSection from "../components/AdminSection";
import Image from "next/image";

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
        <Image
          src="/agh-logo.png"
          alt="Aeros Gaming Hub Logo"
          width={180}
          height={160}
          style={{ marginBottom: "0px" }}
          priority
        />
        <h1>Aeros Gaming Hub</h1>
        <h1>Admin Portal</h1>
      </div>

      <Navigation
        activeSection={activeSection}
        setActiveSection={handleSectionChange}
      />

      <div className="content">
        <AdminSection isActive={activeSection === "admin"} />
      </div>
    </div>
  );
}
