import { useState, useEffect } from "react";
import { ref, get, child, update, push, remove } from "firebase/database";
import { signInAnonymously, onAuthStateChanged, getAuth } from "firebase/auth";
import { database, isDemoMode } from "../lib/firebase";
import "./styles.css";

export default function AdminSection({ isActive }) {
  const [password, setPassword] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [customers, setCustomers] = useState({});
  const [activeSessions, setActiveSessions] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [points, setPoints] = useState("");
  const [action, setAction] = useState("add");
  const [description, setDescription] = useState("");
  const [isDescriptionManuallyEdited, setIsDescriptionManuallyEdited] =
    useState(false);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sessionSearchTerm, setSessionSearchTerm] = useState("");
  const [errorLogs, setErrorLogs] = useState({});
  const [errorSearchTerm, setErrorSearchTerm] = useState("");
  const [errorTypeFilter, setErrorTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const ADMIN_PASSWORD = "Admin!2345";

  // Demo data for offline mode
  const [demoData, setDemoData] = useState({
    customers: {},
    transactions: {},
    activeSessions: {},
    errorLogs: {},
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

  // Admin login function
  const adminLogin = async () => {
    if (password !== ADMIN_PASSWORD) {
      showAlert("Invalid admin password", "error");
      return;
    }

    console.log("Admin login successful, initializing Firebase auth...");
    setIsAuthLoading(true);
    sessionStorage.setItem("isAdminLoggedIn", "true");
    setIsAdminLoggedIn(true);

    // Initialize Firebase Anonymous Authentication after successful login
    await initializeFirebaseAuth();
  };

  // Admin logout function
  const adminLogout = () => {
    sessionStorage.removeItem("isAdminLoggedIn");
    setIsAdminLoggedIn(false);
    setUser(null);
    setIsAuthLoading(false);
    setPassword("");
    showAlert("Logged out successfully", "success");
  };

  // Initialize Firebase Anonymous Authentication
  const initializeFirebaseAuth = async () => {
    try {
      if (isDemoMode) {
        setUser({ uid: "demo-user", isAnonymous: true });
        setIsAuthLoading(false);
        await loadAdminData();
        return;
      }

      // Get auth instance
      const auth = getAuth();

      // Set up auth state listener
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUser(user);
          setIsAuthLoading(false);
          await loadAdminData();
        } else {
          // Sign in anonymously if no user
          try {
            const result = await signInAnonymously(auth);
            setUser(result.user);
            setIsAuthLoading(false);
            await loadAdminData();
          } catch (error) {
            console.error("Error signing in anonymously:", error);
            showAlert("Failed to initialize authentication", "error");
            setIsAuthLoading(false);
          }
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error initializing Firebase auth:", error);
      showAlert("Failed to initialize authentication", "error");
      setIsAuthLoading(false);
    }
  };

  const getAllCustomers = async () => {
    if (isDemoMode) {
      return demoData.customers;
    }

    try {
      const snapshot = await get(child(ref(database), "customers"));
      return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
      console.error("Error getting customers:", error);
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
      console.error("Error getting active sessions:", error);
      return {};
    }
  };

  const getErrorLogs = async () => {
    if (isDemoMode) {
      return demoData.errorLogs || {};
    }

    try {
      const snapshot = await get(child(ref(database), "errorLogs"));
      return snapshot.exists() ? snapshot.val() : {};
    } catch (error) {
      console.error("Error getting error logs:", error);
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
      console.error("Error getting customer:", error);
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
      await loadErrorLogs();
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

  const loadErrorLogs = async () => {
    try {
      const logsData = await getErrorLogs();
      setErrorLogs(logsData);
    } catch (error) {
      showAlert("Error loading error logs: " + error.message, "error");
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
        adminUserId: user?.uid, // Track which admin made the change
      });

      showAlert(
        `Points ${action === "add" ? "added" : "redeemed"} successfully!`,
        "success"
      );

      // Clear form
      setPoints("");
      setDescription("");
      setIsDescriptionManuallyEdited(false);

      // Reload admin data
      await loadAdminData();
    } catch (error) {
      showAlert("Error updating points: " + error.message, "error");
    }
  };

  // Auto-populate description based on points value
  useEffect(() => {
    if (!isDescriptionManuallyEdited && points && parseInt(points) > 0) {
      const pointsAmount = parseInt(points);
      let autoDescription = "";

      if (action === "redeem") {
        // For redeem action with points divisible by 10
        if (pointsAmount % 10 === 0) {
          const hours = pointsAmount / 10;
          autoDescription = `Minus ${pointsAmount} points (${hours} hour${
            hours > 1 ? "s" : ""
          } free redeemed)`;
        } else {
          // For non-10s values
          autoDescription = `Minus ${pointsAmount} points (earned points during free hour)`;
        }
      }

      setDescription(autoDescription);
    }
  }, [points, action, isDescriptionManuallyEdited]);

  // Check for existing admin session on mount
  useEffect(() => {
    const savedLoginState = sessionStorage.getItem("isAdminLoggedIn");
    console.log("Checking saved login state:", savedLoginState);

    if (savedLoginState === "true") {
      console.log("Found saved login state, auto-logging in...");
      setIsAdminLoggedIn(true);
      setIsAuthLoading(true);
      initializeFirebaseAuth();
    } else {
      console.log("No saved login state found, showing login form");
    }
  }, []);

  // Auto-refresh sessions every 30 seconds when user is authenticated
  useEffect(() => {
    if (user && !isAuthLoading && isAdminLoggedIn) {
      const interval = setInterval(loadActiveSessions, 30000);
      return () => clearInterval(interval);
    }
  }, [user, isAuthLoading, isAdminLoggedIn]);

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

  // Get unique error types and severities for filters
  const errorTypes = [
    ...new Set(Object.values(errorLogs).map((log) => log.errorType)),
  ];
  const severities = [
    ...new Set(Object.values(errorLogs).map((log) => log.severity)),
  ];

  // Filter error logs
  const filteredErrorLogs = Object.entries(errorLogs)
    .filter(([id, log]) => {
      const searchLower = errorSearchTerm.toLowerCase();
      const matchesSearch =
        log.username?.toLowerCase().includes(searchLower) ||
        log.errorType?.toLowerCase().includes(searchLower) ||
        log.message?.toLowerCase().includes(searchLower) ||
        id.toLowerCase().includes(searchLower);

      const matchesType =
        errorTypeFilter === "all" || log.errorType === errorTypeFilter;
      const matchesSeverity =
        severityFilter === "all" || log.severity === severityFilter;

      return matchesSearch && matchesType && matchesSeverity;
    })
    .sort((a, b) => {
      // Sort by timestamp, newest first
      return new Date(b[1].timestamp) - new Date(a[1].timestamp);
    });

  const formatDuration = (startTime) => {
    const duration = Date.now() - startTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isSessionActive = (lastHeartbeat) => {
    return Date.now() - lastHeartbeat < 720000; // Active if heartbeat within last 12 minutes
  };

  if (!isActive) return null;

  // Show login form if not logged in
  if (!isAdminLoggedIn) {
    return (
      <div className="admin-container">
        <div className="admin-card">
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
            <button className="btn update" onClick={adminLogin}>
              🔓 Login to Admin Panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while Firebase auth is initializing
  if (isAuthLoading) {
    return (
      <div className="admin-container">
        <div className="admin-card">
          <div className="auth-loading-section">
            <div className="auth-loading-spinner"></div>
            <p>Initializing admin panel...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if Firebase auth failed
  if (!user) {
    return (
      <div className="admin-container">
        <div className="admin-card">
          <div className="auth-error-section">
            <div className="auth-error-icon">⚠️</div>
            <p>Failed to initialize admin panel. Please refresh the page.</p>
            <button className="btn" onClick={() => window.location.reload()}>
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show main admin panel
  return (
    <>
      <style jsx>{``}</style>

      <div className="admin-container">
        <div className="admin-card">
          {/* Admin Panel Header */}
          <div className="admin-header">
            <h2>Admin Panel</h2>
            <div style={{ position: "absolute", top: 17, right: 12 }}>
              <span
                onClick={adminLogout}
                style={{ marginLeft: "10px", cursor: "pointer", fontSize: 12 }}
              >
                Logout
              </span>
            </div>
            <div className="admin-user-info">
              {/* <span className="user-badge">
                🔐 Anonymous Admin ({user.uid.substring(0, 8)}...)
              </span> */}
            </div>
          </div>

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
              className={`tab-button ${activeTab === "points" ? "active" : ""}`}
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
            <button
              className={`tab-button ${activeTab === "errors" ? "active" : ""}`}
              onClick={() => setActiveTab("errors")}
            >
              Error Logs
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
                  <div className="stat-card">
                    <div className="stat-value">
                      {Object.keys(errorLogs).length}
                    </div>
                    <div className="stat-label">Error Logs</div>
                  </div>
                </div>
              </>
            )}

            {activeTab === "points" && (
              <>
                <div className="section-header update">
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
                    onChange={(e) => {
                      setPoints(e.target.value);
                      setIsDescriptionManuallyEdited(false);
                    }}
                    placeholder="Enter points amount"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    className="form-input"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setIsDescriptionManuallyEdited(true);
                    }}
                    placeholder="e.g., Internet usage, Free time reward"
                  />
                </div>

                <button className="btn update" onClick={adminUpdatePoints}>
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
                      <h4 style={{ margin: "0 0 12px 0", color: "#2d3748" }}>
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
                          {new Date(customer.createdAt).toLocaleDateString()}
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
                              🕒 Duration: {formatDuration(session.startTime)}
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
                              isActive ? "session-active" : "session-inactive"
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

            {activeTab === "errors" && (
              <>
                <div className="section-header">
                  <h3>Error Logs</h3>
                  <button className="btn btn-small" onClick={loadErrorLogs}>
                    Refresh
                  </button>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Error Type</label>
                    <select
                      className="form-input form-select"
                      value={errorTypeFilter}
                      onChange={(e) => setErrorTypeFilter(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      {errorTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Severity</label>
                    <select
                      className="form-input form-select"
                      value={severityFilter}
                      onChange={(e) => setSeverityFilter(e.target.value)}
                    >
                      <option value="all">All Severities</option>
                      {severities.map((severity) => (
                        <option key={severity} value={severity}>
                          {severity}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="search-box" style={{ paddingTop: 15 }}>
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="form-input"
                    value={errorSearchTerm}
                    onChange={(e) => setErrorSearchTerm(e.target.value)}
                    placeholder="Search by username, error type, message, or ID..."
                  />
                </div>

                <div className="results-count">
                  Showing {filteredErrorLogs.length} of{" "}
                  {Object.keys(errorLogs).length} error logs
                </div>

                {filteredErrorLogs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p>
                      {errorSearchTerm ||
                      errorTypeFilter !== "all" ||
                      severityFilter !== "all"
                        ? "No error logs found matching your filters."
                        : "No error logs recorded yet."}
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: "2px solid #e2e8f0",
                            textAlign: "left",
                          }}
                        >
                          <th style={{ padding: "12px 8px", fontWeight: 600 }}>
                            Timestamp
                          </th>
                          <th style={{ padding: "12px 8px", fontWeight: 600 }}>
                            Username
                          </th>
                          <th style={{ padding: "12px 8px", fontWeight: 600 }}>
                            Error Type
                          </th>
                          <th style={{ padding: "12px 8px", fontWeight: 600 }}>
                            Severity
                          </th>
                          <th style={{ padding: "12px 8px", fontWeight: 600 }}>
                            Message
                          </th>
                          <th style={{ padding: "12px 8px", fontWeight: 600 }}>
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredErrorLogs.map(([id, log]) => {
                          const severityColor =
                            log.severity === "error"
                              ? "#e53e3e"
                              : log.severity === "warning"
                              ? "#d69e2e"
                              : "#38a169";

                          return (
                            <tr
                              key={id}
                              style={{
                                borderBottom: "1px solid #e2e8f0",
                              }}
                            >
                              <td
                                style={{
                                  padding: "12px 8px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td style={{ padding: "12px 8px" }}>
                                <span style={{ color: "#667eea" }}>
                                  {log.username || "N/A"}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: "12px 8px",
                                  fontFamily: "monospace",
                                  fontSize: "12px",
                                }}
                              >
                                {log.errorType}
                              </td>
                              <td style={{ padding: "12px 8px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    backgroundColor: `${severityColor}20`,
                                    color: severityColor,
                                  }}
                                >
                                  {log.severity?.toUpperCase()}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: "12px 8px",
                                  maxWidth: "300px",
                                }}
                              >
                                {log.message || "No message"}
                              </td>
                              <td style={{ padding: "12px 8px" }}>
                                <details>
                                  <summary
                                    style={{
                                      cursor: "pointer",
                                      color: "#667eea",
                                      fontSize: "12px",
                                    }}
                                  >
                                    View Details
                                  </summary>
                                  <div
                                    style={{
                                      marginTop: "8px",
                                      padding: "8px",
                                      backgroundColor: "#f7fafc",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      fontFamily: "monospace",
                                      maxWidth: "400px",
                                      wordBreak: "break-all",
                                    }}
                                  >
                                    <div>
                                      <strong>ID:</strong> {id}
                                    </div>
                                    {log.sessionId && (
                                      <div>
                                        <strong>Session ID:</strong>{" "}
                                        {log.sessionId}
                                      </div>
                                    )}
                                    {log.tabId && (
                                      <div>
                                        <strong>Tab ID:</strong> {log.tabId}
                                      </div>
                                    )}
                                    {log.calculatedPoints !== undefined && (
                                      <div>
                                        <strong>Calculated Points:</strong>{" "}
                                        {log.calculatedPoints}
                                      </div>
                                    )}
                                    {log.storedPoints !== undefined && (
                                      <div>
                                        <strong>Stored Points:</strong>{" "}
                                        {log.storedPoints}
                                      </div>
                                    )}
                                    {log.sessionAge !== undefined && (
                                      <div>
                                        <strong>Session Age:</strong>{" "}
                                        {log.sessionAge}h
                                      </div>
                                    )}
                                    {log.attempt && (
                                      <div>
                                        <strong>Attempt:</strong> {log.attempt}
                                        {log.maxRetries &&
                                          ` / ${log.maxRetries}`}
                                      </div>
                                    )}
                                    {log.actualPoints !== undefined && (
                                      <div>
                                        <strong>Actual Points:</strong>{" "}
                                        {log.actualPoints}
                                      </div>
                                    )}
                                    {log.expectedPoints !== undefined && (
                                      <div>
                                        <strong>Expected Points:</strong>{" "}
                                        {log.expectedPoints}
                                      </div>
                                    )}
                                    {log.pointsAdded !== undefined && (
                                      <div>
                                        <strong>Points Added:</strong>{" "}
                                        {log.pointsAdded}
                                      </div>
                                    )}
                                    {log.timeSinceHeartbeat !== undefined && (
                                      <div>
                                        <strong>Time Since Heartbeat:</strong>{" "}
                                        {log.timeSinceHeartbeat}s
                                      </div>
                                    )}
                                    {log.userAgent && (
                                      <div>
                                        <strong>User Agent:</strong>{" "}
                                        {log.userAgent.substring(0, 100)}...
                                      </div>
                                    )}
                                    {log.url && (
                                      <div>
                                        <strong>URL:</strong> {log.url}
                                      </div>
                                    )}
                                    {log.stack && (
                                      <div style={{ marginTop: "8px" }}>
                                        <strong>Stack Trace:</strong>
                                        <pre
                                          style={{
                                            fontSize: "10px",
                                            whiteSpace: "pre-wrap",
                                            marginTop: "4px",
                                          }}
                                        >
                                          {log.stack}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
