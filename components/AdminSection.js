import { useState, useEffect } from "react";
import { ref, get, child, update, push, remove } from "firebase/database";
import { database, isDemoMode } from "../lib/firebase";

export default function AdminSection({ isActive }) {
  const [password, setPassword] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [customers, setCustomers] = useState({});
  const [activeSessions, setActiveSessions] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [points, setPoints] = useState("");
  const [action, setAction] = useState("add");
  const [description, setDescription] = useState("");
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");

  const ADMIN_PASSWORD = "Admin!2345";

  // Demo data for offline mode
  const [demoData, setDemoData] = useState({
    customers: {},
    transactions: {},
    activeSessions: {},
  });

  const showAlert = (message, type) => {
    // Create a modern toast notification
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  };

  const getAllCustomers = async () => {
    if (isDemoMode) {
      return demoData.customers;
    }

    try {
      const snapshot = await get(child(ref(database), "customers"));
      return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
      return {};
    }
  };

  const getActiveSessions = async () => {
    if (isDemoMode) {
      return demoData.activeSessions;
    }

    try {
      const snapshot = await get(child(ref(database), "activeSessions"));
      return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
      return {};
    }
  };

  const getCustomer = async (username) => {
    if (isDemoMode) {
      return demoData.customers[username] || null;
    }

    try {
      const snapshot = await get(child(ref(database), `customers/${username}`));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      return null;
    }
  };

  const updateCustomerPoints = async (username, points) => {
    if (isDemoMode) {
      setDemoData((prev) => ({
        ...prev,
        customers: {
          ...prev.customers,
          [username]: {
            ...prev.customers[username],
            points,
          },
        },
      }));
      return;
    }

    await update(ref(database, `customers/${username}`), { points });
  };

  const addTransaction = async (transaction) => {
    if (isDemoMode) {
      const id = Date.now().toString();
      setDemoData((prev) => ({
        ...prev,
        transactions: {
          ...prev.transactions,
          [transaction.customerUsername]: {
            ...prev.transactions[transaction.customerUsername],
            [id]: transaction,
          },
        },
      }));
      return;
    }

    await push(
      ref(database, `transactions/${transaction.customerUsername}`),
      transaction
    );
  };

  const stopSession = async (username) => {
    if (isDemoMode) {
      setDemoData((prev) => ({
        ...prev,
        activeSessions: {
          ...prev.activeSessions,
          [username]: undefined,
        },
      }));
      return;
    }

    try {
      await remove(ref(database, `activeSessions/${username}`));
      showAlert(`Session stopped for ${username}`, "success");
      await loadActiveSessions();
    } catch (error) {
      showAlert("Error stopping session: " + error.message, "error");
    }
  };

  const adminLogin = () => {
    if (password !== ADMIN_PASSWORD) {
      showAlert("Invalid admin password", "error");
      return;
    }

    sessionStorage.setItem("isAdminLoggedIn", "true");
    setIsAdminLoggedIn(true);
    loadAdminData();
  };

  const loadAdminData = async () => {
    try {
      const customersData = await getAllCustomers();
      setCustomers(customersData);

      // Update stats
      const customerCount = Object.keys(customersData).length;
      setTotalCustomers(customerCount);

      let pointsSum = 0;
      Object.values(customersData).forEach((customer) => {
        pointsSum += customer.points || 0;
      });
      setTotalPoints(pointsSum);

      await loadActiveSessions();
    } catch (error) {
      showAlert("Error loading admin data: " + error.message, "error");
    }
  };

  const loadActiveSessions = async () => {
    try {
      const sessionsData = await getActiveSessions();
      setActiveSessions(sessionsData);
    } catch (error) {
      showAlert("Error loading active sessions: " + error.message, "error");
    }
  };

  const adminUpdatePoints = async () => {
    if (!selectedCustomer || !points || parseInt(points) <= 0) {
      showAlert(
        "Please select a customer and enter valid points amount",
        "error"
      );
      return;
    }

    if (!description.trim()) {
      showAlert("Please enter a description", "error");
      return;
    }

    try {
      const customer = await getCustomer(selectedCustomer);
      if (!customer) {
        showAlert("Customer not found", "error");
        return;
      }

      let newPoints = customer.points || 0;
      const pointsAmount = parseInt(points);

      if (action === "add") {
        newPoints += pointsAmount;
      } else {
        // redeem
        if (newPoints < pointsAmount) {
          showAlert("Customer doesn't have enough points", "error");
          return;
        }
        newPoints -= pointsAmount;
      }

      // Update customer points
      await updateCustomerPoints(selectedCustomer, newPoints);

      // Add transaction record
      await addTransaction({
        customerUsername: selectedCustomer,
        points: pointsAmount,
        type: action,
        description: description.trim(),
        timestamp: new Date().toISOString(),
      });

      showAlert(
        `Points ${action === "add" ? "added" : "redeemed"} successfully!`,
        "success"
      );

      // Clear form
      setPoints("");
      setDescription("");

      // Reload admin data
      await loadAdminData();
    } catch (error) {
      showAlert("Error updating points: " + error.message, "error");
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem("isAdminLoggedIn") === "true") {
      setIsAdminLoggedIn(true);
      loadAdminData();
    }
  }, []);

  // Auto-refresh sessions every 30 seconds
  useEffect(() => {
    if (isAdminLoggedIn) {
      const interval = setInterval(loadActiveSessions, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdminLoggedIn]);

  // Filter customers based on search term
  const filteredCustomers = Object.values(customers).filter((customer) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.username.toLowerCase().includes(searchLower) ||
      (customer.phone && customer.phone.toLowerCase().includes(searchLower)) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower))
    );
  });

  // Filter active sessions
  const filteredSessions = Object.entries(activeSessions).filter(
    ([username, session]) => {
      const searchLower = sessionSearchTerm.toLowerCase();
      const customer = customers[username];
      return (
        username.toLowerCase().includes(searchLower) ||
        (customer && customer.name.toLowerCase().includes(searchLower))
      );
    }
  );

  const formatDuration = (startTime) => {
    const duration = Date.now() - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isSessionActive = (lastHeartbeat) => {
    return Date.now() - lastHeartbeat < 60000; // Active if heartbeat within last minute
  };

  if (!isActive) return null;

  return (
    <>
      <style jsx>{`
        .admin-container {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
          min-height: 100vh;
          padding: 10px;
        }

        .admin-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          overflow: hidden;
          max-width: 1200px;
          margin: 0 auto;
          border-radius: 20px;
        }

        .admin-header {
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          padding: 20px;
          color: white;
          text-align: center;
        }

        .admin-title {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .admin-subtitle {
          font-size: 1rem;
          opacity: 0.9;
          margin: 8px 0 0 0;
        }

        .login-section {
          padding: 30px 20px;
          text-align: center;
        }

        .form-group {
          margin-bottom: 20px;
          text-align: left;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2d3748;
          font-size: 14px;
        }

        .form-input,
        .form-select {
          width: 100%;
          padding: 14px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: white;
          box-sizing: border-box;
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        }

        .form-input:focus,
        .form-select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          transform: translateY(-1px);
        }

        .btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          width: 100%;
          text-align: center;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        }

        .btn-danger {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
          box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        }

        .btn-danger:hover {
          box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
        }

        .btn-small {
          padding: 10px 16px;
          font-size: 14px;
          width: auto;
          min-width: 80px;
        }

        .tab-navigation {
          display: flex;
          background: #f7fafc;
          border-bottom: 2px solid #e2e8f0;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }

        .tab-button {
          flex: 1;
          min-width: 120px;
          padding: 15px 10px;
          background: none;
          border: none;
          font-size: 14px;
          font-weight: 600;
          color: #718096;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          white-space: nowrap;
          text-align: center;
        }

        .tab-button.active {
          color: #667eea;
          background: white;
        }

        .tab-button.active::after {
          content: "";
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: #667eea;
        }

        .tab-content {
          padding: 20px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px 15px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
          position: relative;
          overflow: hidden;
          min-height: 100px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .stat-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.1) 0%,
            transparent 50%
          );
          pointer-events: none;
        }

        .stat-value {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 8px;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          position: relative;
          z-index: 1;
        }

        .stat-label {
          font-size: 1rem;
          opacity: 0.9;
          position: relative;
          z-index: 1;
        }

        .customer-card,
        .session-card {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 20px;
          border-radius: 16px;
          margin-bottom: 16px;
          border: 1px solid #e2e8f0;
          transition: all 0.3s ease;
        }

        .customer-card:hover,
        .session-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }

        .session-card {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .session-info h4 {
          margin: 0 0 12px 0;
          color: #2d3748;
          font-size: 16px;
          word-break: break-word;
        }

        .session-details {
          font-size: 14px;
          color: #718096;
        }

        .session-details p {
          margin: 4px 0;
          word-break: break-all;
        }

        .session-status {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          text-align: center;
          display: inline-block;
          min-width: 70px;
        }

        .session-active {
          background: #48bb78;
          color: white;
        }

        .session-inactive {
          background: #fed7d7;
          color: #c53030;
        }

        .session-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .search-box {
          position: relative;
          margin-bottom: 20px;
        }

        .search-box input {
          padding-left: 40px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #a0aec0;
          z-index: 2;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #718096;
        }

        .empty-state-icon {
          font-size: 3rem;
          margin-bottom: 15px;
          opacity: 0.5;
        }

        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          left: 20px;
          padding: 16px 20px;
          border-radius: 12px;
          color: white;
          font-weight: 600;
          z-index: 1000;
          transform: translateY(-100px);
          transition: transform 0.3s ease;
          text-align: center;
          font-size: 14px;
        }

        .toast.show {
          transform: translateY(0);
        }

        .toast-success {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        }

        .toast-error {
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 10px;
        }

        .section-header h3 {
          margin: 0;
          color: #2d3748;
          font-size: 18px;
        }

        .customer-details {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          font-size: 14px;
          color: #718096;
        }

        .customer-details p {
          margin: 0;
          padding: 4px 0;
          word-break: break-word;
        }

        .results-count {
          margin-bottom: 15px;
          color: #718096;
          font-size: 13px;
          padding: 0 2px;
        }

        /* Tablet Styles */
        @media (min-width: 768px) {
          .admin-container {
            padding: 20px;
          }

          .admin-title {
            font-size: 2.5rem;
          }

          .admin-subtitle {
            font-size: 1.1rem;
          }

          .login-section {
            padding: 40px;
          }

          .tab-content {
            padding: 30px;
          }

          .form-row {
            grid-template-columns: 1fr 1fr;
          }

          .btn {
            width: auto;
            display: inline-block;
            padding: 14px 28px;
          }

          .tab-button {
            padding: 20px;
            font-size: 16px;
            min-width: 150px;
          }

          .stats-grid {
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }

          .stat-card {
            padding: 25px;
            min-height: 120px;
          }

          .stat-value {
            font-size: 3rem;
          }

          .stat-label {
            font-size: 1.1rem;
          }

          .session-card {
            flex-direction: row;
            align-items: center;
            gap: 20px;
          }

          .session-actions {
            justify-content: flex-end;
            flex-wrap: nowrap;
          }

          .customer-details {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* Desktop Styles */
        @media (min-width: 1024px) {
          .toast {
            right: 20px;
            left: auto;
            max-width: 400px;
          }

          .customer-details {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
        }

        /* Small Mobile Styles */
        @media (max-width: 480px) {
          .admin-container {
            padding: 5px;
          }

          .admin-card {
            border-radius: 15px;
          }

          .admin-header {
            padding: 15px;
          }

          .admin-title {
            font-size: 1.5rem;
          }

          .admin-subtitle {
            font-size: 0.9rem;
          }

          .login-section {
            padding: 20px 15px;
          }

          .tab-content {
            padding: 15px;
          }

          .tab-button {
            min-width: 100px;
            padding: 12px 8px;
            font-size: 13px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .stat-card {
            padding: 15px;
            min-height: 80px;
          }

          .stat-value {
            font-size: 2rem;
          }

          .stat-label {
            font-size: 0.9rem;
          }

          .customer-card,
          .session-card {
            padding: 15px;
            margin-bottom: 12px;
          }

          .form-input,
          .form-select {
            padding: 12px 14px;
            font-size: 16px; /* Prevent zoom on iOS */
          }

          .btn {
            padding: 12px 16px;
            font-size: 14px;
          }

          .btn-small {
            padding: 8px 12px;
            font-size: 12px;
          }

          .empty-state {
            padding: 30px 15px;
          }

          .empty-state-icon {
            font-size: 2.5rem;
          }

          .section-header {
            flex-direction: column;
            align-items: stretch;
          }

          .section-header h3 {
            font-size: 16px;
            text-align: center;
          }

          .results-count {
            text-align: center;
          }
        }

        /* Extra Small Mobile */
        @media (max-width: 320px) {
          .tab-button {
            min-width: 80px;
            font-size: 12px;
          }

          .stat-value {
            font-size: 1.8rem;
          }

          .customer-card,
          .session-card {
            padding: 12px;
          }
        }

        /* Landscape Mobile */
        @media (max-width: 768px) and (orientation: landscape) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>

      <div className="admin-container">
        <div className="admin-card">
          {!isAdminLoggedIn ? (
            <div className="login-section">
              <div className="form-group">
                <label>Admin Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  onKeyPress={(e) => e.key === "Enter" && adminLogin()}
                />
              </div>
              <button className="btn" onClick={adminLogin}>
                🔓 Login to Admin Panel
              </button>
            </div>
          ) : (
            <>
              <div className="tab-navigation">
                <button
                  className={`tab-button ${
                    activeTab === "dashboard" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("dashboard")}
                >
                  Dashboard
                </button>
                <button
                  className={`tab-button ${
                    activeTab === "points" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("points")}
                >
                  Points
                </button>
                <button
                  className={`tab-button ${
                    activeTab === "customers" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("customers")}
                >
                  Players
                </button>
                <button
                  className={`tab-button ${
                    activeTab === "sessions" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("sessions")}
                >
                  Sessions
                </button>
              </div>

              <div className="tab-content">
                {activeTab === "dashboard" && (
                  <>
                    <div className="stats-grid">
                      <div className="stat-card">
                        <div className="stat-value">{totalCustomers}</div>
                        <div className="stat-label">Total Players</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">{totalPoints}</div>
                        <div className="stat-label">Total Points Issued</div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-value">
                          {Object.keys(activeSessions).length}
                        </div>
                        <div className="stat-label">Active Sessions</div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === "points" && (
                  <>
                    <div className="section-header">
                      <h3>Manage Points</h3>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Select Player</label>
                        <select
                          className="form-input form-select"
                          value={selectedCustomer}
                          onChange={(e) => setSelectedCustomer(e.target.value)}
                        >
                          <option value="">Choose player...</option>
                          {Object.values(customers).map((customer) => (
                            <option
                              key={customer.username}
                              value={customer.username}
                            >
                              {customer.name} (@{customer.username})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Action</label>
                        <select
                          className="form-input form-select"
                          value={action}
                          onChange={(e) => setAction(e.target.value)}
                        >
                          <option value="add">Add Points</option>
                          <option value="redeem">Redeem Points</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Points</label>
                      <input
                        type="number"
                        className="form-input"
                        value={points}
                        onChange={(e) => setPoints(e.target.value)}
                        placeholder="Enter points amount"
                      />
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., Internet usage, Free time reward"
                      />
                    </div>

                    <button className="btn" onClick={adminUpdatePoints}>
                      + Update Points
                    </button>
                  </>
                )}

                {activeTab === "customers" && (
                  <>
                    <div className="section-header">
                      <h3>All Players</h3>
                    </div>

                    <div className="search-box">
                      <span className="search-icon">🔍</span>
                      <input
                        type="text"
                        className="form-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name, username, phone, or email..."
                      />
                    </div>

                    <div className="results-count">
                      Showing {filteredCustomers.length} of{" "}
                      {Object.keys(customers).length} customers
                    </div>

                    {filteredCustomers.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">👤</div>
                        <p>
                          {searchTerm
                            ? "No customers found matching your search."
                            : "No customers registered yet."}
                        </p>
                      </div>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <div key={customer.username} className="customer-card">
                          <h4
                            style={{ margin: "0 0 12px 0", color: "#2d3748" }}
                          >
                            {customer.name}{" "}
                            <span style={{ color: "#667eea" }}>
                              (@{customer.username})
                            </span>
                          </h4>
                          <div className="customer-details">
                            <p>📱 {customer.phone || "Not provided"}</p>
                            <p>✉️ {customer.email || "Not provided"}</p>
                            <p>
                              🎯 Points:{" "}
                              <strong style={{ color: "#667eea" }}>
                                {customer.points || 0}
                              </strong>
                            </p>
                            <p>
                              📅 Member since:{" "}
                              {new Date(
                                customer.createdAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {activeTab === "sessions" && (
                  <>
                    <div className="section-header">
                      <h3>Active Sessions</h3>
                      <button
                        className="btn btn-small"
                        onClick={loadActiveSessions}
                      >
                        Refresh
                      </button>
                    </div>

                    <div className="search-box">
                      <span className="search-icon">🔍</span>
                      <input
                        type="text"
                        className="form-input"
                        value={sessionSearchTerm}
                        onChange={(e) => setSessionSearchTerm(e.target.value)}
                        placeholder="Search sessions by username..."
                      />
                    </div>

                    <div className="results-count">
                      Showing {filteredSessions.length} active sessions
                    </div>

                    {filteredSessions.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state-icon">💻</div>
                        <p>No active sessions found.</p>
                      </div>
                    ) : (
                      filteredSessions.map(([username, session]) => {
                        const customer = customers[username];
                        const isActive = isSessionActive(session.lastHeartbeat);

                        return (
                          <div key={username} className="session-card">
                            <div className="session-info">
                              <h4>
                                {customer ? customer.name : username}{" "}
                                <span style={{ color: "#667eea" }}>
                                  (@{username})
                                </span>
                              </h4>
                              <div className="session-details">
                                <p>
                                  🕒 Duration:{" "}
                                  {formatDuration(session.startTime)}
                                </p>
                                <p>📱 Session: {session.sessionId}</p>
                                <p>🔗 Tab: {session.tabId}</p>
                                <p>
                                  💓 Last heartbeat:{" "}
                                  {new Date(
                                    session.lastHeartbeat
                                  ).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <div className="session-actions">
                              <span
                                className={`session-status ${
                                  isActive
                                    ? "session-active"
                                    : "session-inactive"
                                }`}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>
                              <button
                                className="btn btn-danger btn-small"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Are you sure you want to stop the session for ${username}?`
                                    )
                                  ) {
                                    stopSession(username);
                                  }
                                }}
                              >
                                Stop
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
