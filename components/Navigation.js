export default function Navigation({ activeSection, setActiveSection }) {
  return (
    <div className="nav">
      <button
        className={`nav-btn ${activeSection === "customer" ? "active" : ""}`}
        onClick={() => setActiveSection("customer")}
      >
        Player
      </button>
      <button
        className={`nav-btn ${activeSection === "admin" ? "active" : ""}`}
        onClick={() => setActiveSection("admin")}
      >
        Admin
      </button>
      <button
        className={`nav-btn ${activeSection === "register" ? "active" : ""}`}
        onClick={() => setActiveSection("register")}
      >
        Register
      </button>
    </div>
  );
}
