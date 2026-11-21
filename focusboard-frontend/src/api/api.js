
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

// Delete task
export const deleteTask = (taskId) => {
    return apiRequest(`/tasks/${taskId}`, {
        method: "DELETE",
    });
};

export default apiRequest;
