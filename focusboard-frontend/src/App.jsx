
import { useEffect, useState } from "react";

import {
  signInWithGoogle,
  observeAuthState,
} from "./auth";

import Dashboard from "./components/Dashboard";

import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = observeAuthState((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setError("");
      await signInWithGoogle();
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setError(error.message || "Google sign-in failed.");
    }
  };

  if (loading) {
    return <div className="app-loading">Loading FocusBoard Pro...</div>;
  }

  if (user) {
    return <Dashboard />;
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
