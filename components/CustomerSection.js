import { useState, useEffect } from "react";
import { ref, get, child, update, push } from "firebase/database";
import { database, isDemoMode } from "../lib/firebase";

export default function CustomerSection({ isActive }) {
  const [username, setUsername] = useState("");
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [timerDisplay, setTimerDisplay] = useState("00:00");
  const [nextPointTimer, setNextPointTimer] = useState("30:00");
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(null);
  const [pointTimer, setPointTimer] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  const POINT_INTERVAL = 30 * 60; // 30 minutes in seconds
  const ADMIN_PASSWORD = "Admin!2345";

  // Demo data for offline mode
  const [demoData, setDemoData] = useState({
    customers: {},
    transactions: {},
  });

  const showAlert = (message, type) => {
    // In a real implementation, you'd use a toast library or state management
    alert(message);
  };

  const getCustomer = async (username) => {
    if (isDemoMode) {
      return demoData.customers[username] || null;
    }

    try {
      const snapshot = await get(child(ref(database), `customers/${username}`));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      throw error;
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

  const getCustomerTransactions = async (username) => {
    if (isDemoMode) {
      const transactions = demoData.transactions[username] || {};
      return Object.values(transactions).sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    }

    try {
      const snapshot = await get(
        child(ref(database), `transactions/${username}`)
      );
      if (!snapshot.exists()) return [];

      const transactions = Object.values(snapshot.val());
      return transactions.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      return [];
    }
  };

  const customerLogin = async () => {
    if (!username.trim()) {
      showAlert("Please enter your username", "error");
      return;
    }

    try {
      const customer = await getCustomer(username.trim());
      if (customer) {
        setCurrentCustomer(customer);
        await loadCustomerHistory(username.trim());
      } else {
        showAlert("Username not found. Please register first.", "error");
      }
    } catch (error) {
      showAlert("Error logging in: " + error.message, "error");
    }
  };

  const loadCustomerHistory = async (
    customerUsername = currentCustomer?.username
  ) => {
    if (!customerUsername) return;

    try {
      const transactions = await getCustomerTransactions(customerUsername);
      setCustomerHistory(transactions);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const updateTimerDisplay = () => {
    if (!sessionStartTime) return;

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);

    // Update session time display
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    setTimerDisplay(
      `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`
    );

    // Update next point countdown
    const secondsInCurrentInterval = elapsedSeconds % POINT_INTERVAL;
    const secondsUntilNextPoint = POINT_INTERVAL - secondsInCurrentInterval;

    const nextMinutes = Math.floor(secondsUntilNextPoint / 60);
    const nextSeconds = secondsUntilNextPoint % 60;
    setNextPointTimer(
      `${nextMinutes.toString().padStart(2, "0")}:${nextSeconds
        .toString()
        .padStart(2, "0")}`
    );
  };

  const awardPoint = async () => {
    if (!currentCustomer) return;

    try {
      const newPoints = (currentCustomer.points || 0) + 1;
      await updateCustomerPoints(currentCustomer.username, newPoints);

      // Update local state
      setCurrentCustomer((prev) => ({ ...prev, points: newPoints }));

      // Add transaction record
      await addTransaction({
        customerUsername: currentCustomer.username,
        points: 1,
        type: "add",
        description: "Auto-earned from 30min session",
        timestamp: new Date().toISOString(),
      });

      // Refresh history
      await loadCustomerHistory();

      showAlert("🎉 You earned 1 point! (30 minutes completed)", "success");
    } catch (error) {
      console.error("Error awarding point:", error);
      showAlert("Error awarding point: " + error.message, "error");
    }
  };

  const startTimer = () => {
    if (!currentCustomer) {
      showAlert("Please login first", "error");
      return;
    }

    if (sessionTimer) {
      showAlert("Session already active", "error");
      return;
    }

    const startTime = Date.now();
    setSessionStartTime(startTime);
    setSessionActive(true);

    // Start session timer (updates every second)
    const sTimer = setInterval(updateTimerDisplay, 1000);
    setSessionTimer(sTimer);

    // Start point timer (gives points every 30 minutes)
    const pTimer = setInterval(awardPoint, POINT_INTERVAL * 1000);
    setPointTimer(pTimer);

    showAlert(
      "Session started! You'll earn 1 point every 30 minutes.",
      "success"
    );
  };

  const stopTimer = () => {
    if (sessionTimer) {
      clearInterval(sessionTimer);
      setSessionTimer(null);
    }

    if (pointTimer) {
      clearInterval(pointTimer);
      setPointTimer(null);
    }

    setSessionActive(false);
    setTimerDisplay("00:00");
    setNextPointTimer("30:00");

    showAlert("Session stopped.", "success");
  };

  // Cleanup timers on component unmount
  useEffect(() => {
    return () => {
      if (sessionTimer) clearInterval(sessionTimer);
      if (pointTimer) clearInterval(pointTimer);
    };
  }, [sessionTimer, pointTimer]);

  if (!isActive) return null;

  return (
    <div className="section active">
      <h2>Player Login</h2>
      <div className="form-group">
        <label>Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
        />
      </div>
      <button className="btn" onClick={customerLogin}>
        Login
      </button>

      {currentCustomer && (
        <div style={{ paddingTop: "1rem" }}>
          <h4>Welcome back!</h4>
          <div style={{ marginTop: "7px" }} className="name-display">
            {currentCustomer.name},
          </div>
          <div className="points-display">
            {currentCustomer.points || 0} Points
          </div>

          <div
            className="customer-card"
            style={{ textAlign: "center", margin: "1rem 0" }}
          >
            <h4>🕒 Active Session Timer</h4>
            <div
              style={{
                fontSize: "1.5rem",
                color: "#667eea",
                margin: "0.5rem 0",
              }}
            >
              <span>{timerDisplay}</span>
            </div>
            <div style={{ color: "#666", fontSize: "0.9rem" }}>
              Next point in: <span>{nextPointTimer}</span>
            </div>
            <div style={{ margin: "1rem 0" }}>
              {!sessionActive ? (
                <button className="btn" onClick={startTimer}>
                  Start Session
                </button>
              ) : (
                <button className="btn btn-danger" onClick={stopTimer}>
                  Stop Session
                </button>
              )}
            </div>
            <div style={{ color: "#28a745", fontSize: "0.9rem" }}>
              <strong>Earn 1 point every 30 minutes!</strong>
            </div>
          </div>

          <h4>Recent Activity</h4>
          <div>
            {customerHistory.length === 0 ? (
              <p>No transaction history yet.</p>
            ) : (
              customerHistory.map((trans, index) => {
                let icon = "";
                let className = trans.type;

                if (trans.type === "add") {
                  icon = trans.description.includes("Auto-earned")
                    ? "🕒"
                    : "➕";
                } else if (trans.type === "redeem") {
                  icon = "➖";
                } else if (trans.type === "session") {
                  icon = "📊";
                  className = "session";
                }

                return (
                  <div key={index} className={`history-item ${className}`}>
                    <strong>
                      {icon}{" "}
                      {trans.type === "session"
                        ? ""
                        : trans.type === "add"
                        ? "+"
                        : "-"}
                      {trans.points > 0 ? trans.points + " points" : ""}
                    </strong>
                    <br />
                    <small>{trans.description}</small>
                    <br />
                    <small>{new Date(trans.timestamp).toLocaleString()}</small>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
