import { useState } from "react";
import { ref, get, child, set } from "firebase/database";
import { database, isDemoMode } from "../lib/firebase";

export default function RegisterSection({ isActive }) {
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    phone: "",
    email: "",
  });

  // Demo data for offline mode
  const [demoData, setDemoData] = useState({
    customers: {},
    transactions: {},
  });

  const showAlert = (message, type) => {
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
      return null;
    }
  };

  const saveCustomer = async (username, customer) => {
    if (isDemoMode) {
      setDemoData((prev) => ({
        ...prev,
        customers: {
          ...prev.customers,
          [username]: customer,
        },
      }));
      return;
    }

    await set(ref(database, `customers/${username}`), customer);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const registerCustomer = async () => {
    const { username, name, phone, email } = formData;

    if (!username.trim() || !name.trim()) {
      showAlert("Username and full name are required", "error");
      return;
    }

    // Username validation
    if (username.length < 3) {
      showAlert("Username must be at least 3 characters long", "error");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showAlert(
        "Username can only contain letters, numbers, and underscores",
        "error"
      );
      return;
    }

    try {
      // Check if username already exists
      const existingCustomer = await getCustomer(username.trim());
      if (existingCustomer) {
        showAlert(
          "Username already taken. Please choose a different one.",
          "error"
        );
        return;
      }

      const customer = {
        username: username.trim(),
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        points: 0,
        createdAt: new Date().toISOString(),
      };

      await saveCustomer(username.trim(), customer);
      showAlert(
        "Customer registered successfully! You can now login with: " +
          username.trim(),
        "success"
      );

      // Clear form
      setFormData({
        username: "",
        name: "",
        phone: "",
        email: "",
      });
    } catch (error) {
      showAlert("Error registering customer: " + error.message, "error");
    }
  };

  if (!isActive) return null;

  return (
    <div className="section active">
      <h2>Register New Customer</h2>

      <div className="form-group">
        <label>Username *</label>
        <input
          type="text"
          value={formData.username}
          onChange={(e) => handleInputChange("username", e.target.value)}
          placeholder="Choose a username (e.g., john123, maria_cruz)"
        />
        <div className="username-help">
          Must be at least 3 characters. Letters, numbers, and underscores only.
        </div>
      </div>

      <div className="form-group">
        <label>Full Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleInputChange("name", e.target.value)}
          placeholder="Enter full name"
        />
      </div>

      <div className="form-group">
        <label>Phone Number (Optional)</label>
        <input
          type="text"
          value={formData.phone}
          onChange={(e) => handleInputChange("phone", e.target.value)}
          placeholder="Enter phone number (optional)"
        />
      </div>

      <div className="form-group">
        <label>Email (Optional)</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          placeholder="Enter email address (optional)"
        />
      </div>

      <button className="btn" onClick={registerCustomer}>
        Register Player
      </button>

      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#e3f2fd",
          borderRadius: "8px",
          fontSize: "14px",
        }}
      >
        <strong>Note:</strong> Only username and full name are required. Phone
        and email are completely optional.
      </div>
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#e88787",
          borderRadius: "8px",
          fontSize: "14px",
          color: "#fff",
        }}
      >
        <strong>Note:</strong> Players who will create many accounts without
        permission from the owner will be BANNED!
      </div>
      <div
        style={{
          marginTop: "1rem",
          padding: "1rem",
          background: "#e88787",
          borderRadius: "8px",
          fontSize: "14px",
          color: "#fff",
        }}
      >
        <strong>Note:</strong> Players who will use FOUL NAMES will be BANNED!
      </div>
    </div>
  );
}
