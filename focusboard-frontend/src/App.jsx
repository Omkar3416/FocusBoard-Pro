
import { useEffect, useState } from "react";

import {
  signInWithGoogle,
  signOutUser,
  observeAuthState,
} from "./auth";

import { getAllTasks } from "./api/api";
import Dashboard from "./components/Dashboard";

import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessStatus, setAccessStatus] = useState("idle");
  const [accountMessage, setAccountMessage] = useState("");
  const [initialTasks, setInitialTasks] = useState([]);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const unsubscribe = observeAuthState((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      setError("");
      setAccountMessage("");
      setInitialTasks([]);
      setAccessStatus(currentUser ? "checking" : "idle");
    });

    return () => unsubscribe();
  }, []);

  // Verify backend access before displaying the dashboard.
  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const verifyBackendAccess = async () => {
      setAccessStatus("checking");
      setAccountMessage("");
      setError("");

      try {
        const tasks = await getAllTasks();

        if (!cancelled) {
          setInitialTasks(tasks);
          setAccessStatus("allowed");
        }

      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Account access verification failed:", error);

        setInitialTasks([]);

        if (error.status === 403) {
          setAccountMessage(error.message);
          setAccessStatus("blocked");
        } else {
          setError(
              error.message || "Unable to connect to the server."
          );
          setAccessStatus("error");
        }
      }
    };

    verifyBackendAccess();

    return () => {
      cancelled = true;
    };
  }, [user, retryCount]);

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      await signInWithGoogle();
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setError(error.message || "Google sign-in failed.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setAccountMessage("");
      setError("");
      setAccessStatus("idle");
    } catch (error) {
      console.error("Sign-out error:", error);
      setError("Unable to sign out. Please try again.");
    }
  };

  if (loading) {
    return <div className="app-loading">Loading FocusBoard Pro...</div>;
  }

  if (user && accessStatus === "checking") {
    return (
        <div className="app-loading">
          Verifying your account...
        </div>
    );
  }

  if (user && accessStatus === "blocked") {
    const isDeletionPending =
        accountMessage.toLowerCase().includes("deletion");

    return (
        <div className="app-container">
          <main className="auth-container">
            <div className="login-card">
              <h2>
                {isDeletionPending
                    ? "Account Scheduled for Deletion"
                    : "Account Access Restricted"}
              </h2>

              <p className="error-message">
                {accountMessage}
              </p>

              <button
                  className="google-button"
                  onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </main>
        </div>
    );
  }

  if (user && accessStatus === "error") {
    return (
        <div className="app-container">
          <main className="auth-container">
            <div className="login-card">
              <h2>Unable to Verify Your Account</h2>

              <p className="error-message">{error}</p>

              <button
                  className="google-button"
                  onClick={() => setRetryCount((count) => count + 1)}
              >
                Retry
              </button>

              <button
                  className="google-button"
                  onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </main>
        </div>
    );
  }

  if (user && accessStatus === "allowed") {
    return <Dashboard initialTasks={initialTasks} />;
  }

  return (
      <div className="app-container">
        <header className="app-header">
          <h1>FocusBoard Pro</h1>
          <p>Your personal productivity dashboard</p>
        </header>

        <main className="auth-container">
          <div className="login-card">
            <h2>Welcome Back</h2>
            <p>Sign in to manage your tasks and schedule.</p>

            <button
                className="google-button"
                onClick={handleGoogleSignIn}
            >
              Continue with Google
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}
        </main>
      </div>
  );
}

export default App;
