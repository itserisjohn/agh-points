import { useState, useEffect } from "react";
import { ref, get, child, update, push } from "firebase/database";
import { database, isDemoMode } from "../lib/firebase";

export default function AdminSection({ isActive }) {
  const [password, setPassword] = useState("");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [customers, setCustomers] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [points, setPoints] = useState("");
  const [action, setAction] = useState("add");
  const [description, setDescription] = useState("");
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const ADMIN_PASSWORD = "Admin!2345";

  // Demo data for offline mode
  const [demoData, setDemoData] = useState({
    customers: {},
    transactions: {},
  });

  const showAlert = (message, type) => {
    alert(message);
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

  const adminLogin = () => {
    if (password !== ADMIN_PASSWORD) {
      showAlert("Invalid admin password", "error");
      return;
    }

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
    } catch (error) {
      showAlert("Error loading admin data: " + error.message, "error");
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

  if (!isActive) return null;

  return (
    <div className="section active">
      <h2>Admin Panel</h2>

      {!isAdminLoggedIn ? (
        <>
          <div className="form-group">
            <label>Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
            />
          </div>
          <button className="btn" onClick={adminLogin}>
            Login
          </button>
        </>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{totalCustomers}</div>
              <div>Total Players</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalPoints}</div>
              <div>Total Points Issued</div>
            </div>
          </div>

          <h3>Manage Points</h3>
          <div className="form-group">
            <label>Select Player</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="">Choose player...</option>
              {Object.values(customers).map((customer) => (
                <option key={customer.username} value={customer.username}>
                  {customer.name} (@{customer.username})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Points</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Enter points amount"
            />
          </div>

          <div className="form-group">
            <label>Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="add">Add Points</option>
              <option value="redeem">Redeem Points</option>
            </select>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Internet usage, Free time reward"
            />
          </div>

          <button className="btn" onClick={adminUpdatePoints}>
            Update Points
          </button>

          <h3 style={{ marginTop: "1rem" }}>All Players</h3>

          <div className="form-group">
            <label>Search Player</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, username, phone, or email..."
            />
          </div>

          <div
            style={{ marginBottom: "1rem", color: "#666", fontSize: "14px" }}
          >
            Showing {filteredCustomers.length} of{" "}
            {Object.keys(customers).length} customers
          </div>

          <div>
            {filteredCustomers.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "2rem", color: "#666" }}
              >
                {searchTerm
                  ? "No customers found matching your search."
                  : "No customers registered yet."}
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div key={customer.username} className="customer-card">
                  <h4>
                    {customer.name} (@{customer.username})
                  </h4>
                  <p>Phone: {customer.phone || "Not provided"}</p>
                  <p>Email: {customer.email || "Not provided"}</p>
                  <p>
                    Points: <strong>{customer.points || 0}</strong>
                  </p>
                  <p>
                    Member since:{" "}
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
