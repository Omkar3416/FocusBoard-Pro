
import { useState } from "react";

import {
    promoteUserToAdmin,
    updateUserStatus,
    requestAccountDeletion,
    cancelAccountDeletion,
} from "../api/api";

import "./UserManagement.css";

function formatDate(dateValue) {
    if (!dateValue) {
        return "Not available";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function getDeletionState(user) {
    if (user.deletionProcessingStartedAt) {
        return "processing";
    }

    if (!user.deletionRequestedAt && !user.deletionScheduledAt) {
        return "none";
    }

    const scheduledDate = user.deletionScheduledAt
        ? new Date(user.deletionScheduledAt)
        : null;

    if (
        scheduledDate &&
        !Number.isNaN(scheduledDate.getTime()) &&
        scheduledDate > new Date()
    ) {
        return "scheduled";
    }

    return "awaiting";
}

function isDeletionPending(user) {
    return getDeletionState(user) !== "none";
}

function UserManagement({ users, viewerRole, onUsersChange }) {
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [actionLoadingId, setActionLoadingId] = useState(null);



// Merge updated backend data into the existing user.
// This preserves fields such as createdAt that are not returned
// by the account deletion response.
    const replaceUser = (updatedUser) => {
        onUsersChange((previousUsers) =>
            previousUsers.map((user) =>
                user.id === updatedUser.id
                    ? { ...user, ...updatedUser }
                    : user
            )
        );
    };

    // Promote a regular USER to ADMIN.
    const handlePromote = async (user) => {
        const confirmed = window.confirm(
            `Promote ${user.name || user.email} to ADMIN?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setActionLoadingId(user.id);
            setError("");
            setSuccessMessage("");

            const updatedUser = await promoteUserToAdmin(user.id);

            replaceUser(updatedUser);

            setSuccessMessage(
                `${user.name || user.email} has been promoted to ADMIN.`
            );
        } catch (actionError) {
            console.error("User promotion error:", actionError);

            setError(
                actionError.message || "Unable to promote this user."
            );
        } finally {
            setActionLoadingId(null);
        }
    };

    // Enable or disable an account according to administrator permissions.
    const handleStatusChange = async (user) => {
        const nextStatus = !user.enabled;
        const action = nextStatus ? "enable" : "disable";

        const confirmed = window.confirm(
            `Are you sure you want to ${action} ${user.name || user.email}'s account?`
        );

        if (!confirmed) {
            return;
        }

        try {
            setActionLoadingId(user.id);
            setError("");
            setSuccessMessage("");

            const updatedUser = await updateUserStatus(
                user.id,
                nextStatus
            );

            replaceUser(updatedUser);

            setSuccessMessage(
                `${user.name || user.email}'s account has been ${nextStatus ? "enabled" : "disabled"}.`
            );
        } catch (actionError) {
            console.error("User status update error:", actionError);

            setError(
                actionError.message || "Unable to update account status."
            );
        } finally {
            setActionLoadingId(null);
        }
    };

    // Request permanent account deletion with a 90-day grace period.
    const handleRequestDeletion = async (user) => {
        const confirmed = window.confirm(
            `Are you sure you want to request permanent deletion of ${user.name || user.email}?\n\n` +
            "The account will be disabled immediately. Permanent deletion of the account and its associated tasks will be scheduled after 90 days."
        );

        if (!confirmed) {
            return;
        }

        try {
            setActionLoadingId(user.id);
            setError("");
            setSuccessMessage("");

            const updatedUser = await requestAccountDeletion(user.id);

            replaceUser({
                ...updatedUser,
                deletionProcessingStartedAt: null,
            });

            setSuccessMessage(
                `Deletion requested for ${user.name || user.email}. Scheduled date: ${formatDate(updatedUser.deletionScheduledAt)}.`
            );
        } catch (actionError) {
            console.error("Account deletion request error:", actionError);

            setError(
                actionError.message || "Unable to request account deletion."
            );
        } finally {
            setActionLoadingId(null);
        }
    };

// Cancel a pending account deletion.
    const handleCancelDeletion = async (user) => {
        const confirmed = window.confirm(
            `Cancel the scheduled deletion of ${user.name || user.email}?\n\nThe account's previous enabled or disabled status will be restored.`
        );

        if (!confirmed) {
            return;
        }

        try {
            setActionLoadingId(user.id);
            setError("");
            setSuccessMessage("");

            const updatedUser = await cancelAccountDeletion(user.id);

            replaceUser({
                ...updatedUser,
                deletionProcessingStartedAt: null,
            });

            setSuccessMessage(
                `Scheduled deletion cancelled for ${user.name || user.email}.`
            );
        } catch (actionError) {
            console.error("Account deletion cancellation error:", actionError);

            setError(
                actionError.message || "Unable to cancel account deletion."
            );
        } finally {
            setActionLoadingId(null);
        }
    };

    // Check permissions before displaying management actions.
    const canPromote = (user) =>
        (viewerRole === "OWNER" || viewerRole === "ADMIN") &&
        user.role === "USER" &&
        user.enabled &&
        !isDeletionPending(user);

    const canChangeStatus = (user) => {
        if (user.role === "OWNER" || isDeletionPending(user)) {
            return false;
        }

        if (viewerRole === "OWNER") {
            return user.role === "USER" || user.role === "ADMIN";
        }

        if (viewerRole === "ADMIN") {
            return user.role === "USER";
        }

        return false;
    };

// Only OWNER can request permanent deletion.
    const canRequestDeletion = (user) =>
        viewerRole === "OWNER" &&
        (user.role === "USER" || user.role === "ADMIN") &&
        !isDeletionPending(user);

// Only OWNER can cancel deletion during the grace period.
    const canCancelDeletion = (user) =>
        viewerRole === "OWNER" &&
        user.role !== "OWNER" &&
        getDeletionState(user) === "scheduled";



    if (!viewerRole) {
        return (
            <section className="user-management">
                <div className="user-management-error">
                    {error || "Unable to verify management permissions."}
                </div>
            </section>
        );
    }

    return (
        <section className="user-management">
            <div className="user-management-header">
                <div>
                    <h2>User Management</h2>
                    <p>
                        Manage registered accounts, roles and access permissions.
                    </p>
                </div>

                <div className="user-management-role">
                    Your role: <strong>{viewerRole}</strong>
                </div>
            </div>

            <div className="user-management-summary">
                <div className="user-summary-card">
                    <span>Total Users</span>
                    <strong>{users.length}</strong>
                </div>

                <div className="user-summary-card">
                    <span>Active Accounts</span>
                    <strong>
                        {users.filter(
                            (user) => user.enabled && !isDeletionPending(user)
                        ).length}
                    </strong>
                </div>

                <div className="user-summary-card">
                    <span>Disabled Accounts</span>
                    <strong>
                        {users.filter(
                            (user) => !user.enabled && !isDeletionPending(user)
                        ).length}
                    </strong>
                </div>

                <div className="user-summary-card">
                    <span>Deletion Pending</span>
                    <strong>
                        {users.filter((user) => isDeletionPending(user)).length}
                    </strong>
                </div>

                <div className="user-summary-card">
                    <span>Administrators</span>
                    <strong>
                        {users.filter(
                            (user) =>
                                user.role === "OWNER" ||
                                user.role === "ADMIN"
                        ).length}
                    </strong>
                </div>
            </div>

            {error && (
                <div className="user-management-error" role="alert">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="user-management-success" role="status">
                    {successMessage}
                </div>
            )}

            <div className="user-management-table-container">
                <table className="user-management-table">
                    <thead>
                    <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Account Status</th>
                        <th>Registered</th>
                        <th>Actions</th>
                    </tr>
                    </thead>

                    <tbody>
                    {users.map((user) => {
                        const isBusy = actionLoadingId === user.id;

                        return (
                            <tr key={user.id}>
                                <td>
                                    <div className="managed-user-name">
                                        {user.name || "Unnamed User"}
                                    </div>

                                    <div className="managed-user-email">
                                        {user.email}
                                    </div>
                                </td>

                                <td>
                                        <span
                                            className={`managed-user-role role-${user.role?.toLowerCase()}`}
                                        >
                                            {user.role}
                                        </span>
                                </td>

                                <td>
                                    {getDeletionState(user) === "processing" ? (
                                        <span className="managed-user-status account-deletion-processing">
            Deletion processing
        </span>
                                    ) : getDeletionState(user) === "awaiting" ? (
                                        <span className="managed-user-status account-deletion-awaiting">
            Deletion awaiting processing
        </span>
                                    ) : getDeletionState(user) === "scheduled" ? (
                                        <div className="managed-user-deletion-status">
            <span className="managed-user-status account-deletion-scheduled">
                Deletion scheduled
            </span>
                                            <small>
                                                Scheduled: {formatDate(user.deletionScheduledAt)}
                                            </small>
                                        </div>
                                    ) : (
                                        <span
                                            className={`managed-user-status ${
                                                user.enabled ? "account-enabled" : "account-disabled"
                                            }`}
                                        >
            {user.enabled ? "Enabled" : "Disabled"}
        </span>
                                    )}
                                </td>

                                <td>{formatDate(user.createdAt)}</td>

                                <td>
                                    <div className="managed-user-actions">
                                        {user.role === "OWNER" ? (
                                            <span className="protected-account">
                Protected
            </span>
                                        ) : getDeletionState(user) === "scheduled" ? (
                                            canCancelDeletion(user) ? (
                                                <button
                                                    type="button"
                                                    className="user-action-button cancel-deletion-button"
                                                    onClick={() => handleCancelDeletion(user)}
                                                    disabled={isBusy}
                                                >
                                                    {isBusy ? "Please wait..." : "Cancel Deletion"}
                                                </button>
                                            ) : (
                                                <span className="no-user-actions">No actions</span>
                                            )
                                        ) : getDeletionState(user) === "processing" ? (
                                            <span className="no-user-actions">
                Deletion processing
            </span>
                                        ) : getDeletionState(user) === "awaiting" ? (
                                            <span className="no-user-actions">
                Awaiting processing
            </span>
                                        ) : (
                                            <>
                                                {canPromote(user) && (
                                                    <button
                                                        type="button"
                                                        className="user-action-button promote-user-button"
                                                        onClick={() => handlePromote(user)}
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy ? "Please wait..." : "Promote"}
                                                    </button>
                                                )}

                                                {canChangeStatus(user) && (
                                                    <button
                                                        type="button"
                                                        className={`user-action-button ${
                                                            user.enabled
                                                                ? "disable-user-button"
                                                                : "enable-user-button"
                                                        }`}
                                                        onClick={() => handleStatusChange(user)}
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy
                                                            ? "Please wait..."
                                                            : user.enabled
                                                                ? "Disable"
                                                                : "Enable"}
                                                    </button>
                                                )}

                                                {canRequestDeletion(user) && (
                                                    <button
                                                        type="button"
                                                        className="user-action-button request-deletion-button"
                                                        onClick={() => handleRequestDeletion(user)}
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy ? "Please wait..." : "Request Deletion"}
                                                    </button>
                                                )}

                                                {!canPromote(user) &&
                                                    !canChangeStatus(user) &&
                                                    !canRequestDeletion(user) && (
                                                        <span className="no-user-actions">
                            No actions
                        </span>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>

                {users.length === 0 && (
                    <div className="user-management-empty">
                        No registered users found.
                    </div>
                )}
            </div>
        </section>
    );
}

export default UserManagement;
