
import { auth } from "../firebase";

const API_BASE_URL = "http://localhost:8080/api";

const apiRequest = async (endpoint, options = {}) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
        throw new Error("User is not authenticated.");
    }

    const idToken = await currentUser.getIdToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        const error = new Error(
            errorData.message || `Request failed: ${response.status}`
        );

        error.status = response.status;

        throw error;
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
};

// Get all tasks
export const getAllTasks = () => {
    return apiRequest("/tasks");
};

// Create a task
export const createTask = (taskData) => {
    return apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify(taskData),
    });
};

// Create recurring tasks
export const createRecurringTasks = (taskData) => {
    return apiRequest("/tasks/recurring", {
        method: "POST",
        body: JSON.stringify(taskData),
    });
};

// Get task by ID
export const getTaskById = (taskId) => {
    return apiRequest(`/tasks/${taskId}`);
};

// Update task
export const updateTask = (taskId, taskData) => {
    return apiRequest(`/tasks/${taskId}`, {
        method: "PUT",
        body: JSON.stringify(taskData),
    });
};


// Temporarily delete one task occurrence
export const deleteTask = (taskId) => {
    return apiRequest(`/tasks/${taskId}`, {
        method: "DELETE",
    });
};

// Temporarily delete an entire recurring series
export const deleteTaskSeries = (taskId) => {
    return apiRequest(`/tasks/${taskId}/series`, {
        method: "DELETE",
    });
};

// Undo a temporary task deletion
export const undoTaskDeletion = (batchId) => {
    return apiRequest(`/tasks/deletions/${batchId}/undo`, {
        method: "POST",
    });
};

// Preview old tasks before bulk deletion
export const previewOldTasksDeletion = () => {
    return apiRequest("/tasks/old-tasks/preview");
};

// Temporarily delete all eligible old tasks
export const deleteOldTasks = () => {
    return apiRequest("/tasks/old-tasks", {
        method: "DELETE",
    });
};


// ==========================================
// USER MANAGEMENT APIs (OWNER / ADMIN)
// ==========================================

// Get all registered users.
export const getAllUsers = () => {
    return apiRequest("/admin/users");
};

// Promote a USER account to ADMIN.
export const promoteUserToAdmin = (userId) => {
    return apiRequest("/admin/users/promote", {
        method: "POST",
        body: JSON.stringify({ userId }),
    });
};

// Enable or disable a user account.
export const updateUserStatus = (userId, enabled) => {
    return apiRequest(`/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
    });
};

// Request permanent account deletion.
export const requestAccountDeletion = (userId) => {
    return apiRequest(`/admin/users/${userId}/deletion`, {
        method: "POST",
    });
};

// Cancel a pending account deletion.
export const cancelAccountDeletion = (userId) => {
    return apiRequest(`/admin/users/${userId}/deletion`, {
        method: "DELETE",
    });
};


export default apiRequest;
