import {useEffect, useRef, useState} from "react";
import {auth} from "../firebase";
import {signOutUser} from "../auth";
import {
    updateTask,
    deleteTask,
    deleteTaskSeries,
    undoTaskDeletion,
    previewOldTasksDeletion,
    deleteOldTasks,
    getAllTasks,
    getAllUsers,
} from "../api/api";
import TaskForm from "./TaskForm";

import "./Dashboard.css";
import Calendar from "./Calendar";
import UserManagement from "./UserManagement";

// Keep tasks ordered by date and then start time.
function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
        const dateComparison = a.taskDate.localeCompare(b.taskDate);

        if (dateComparison !== 0) {
            return dateComparison;
        }

        return (a.startTime || "23:59:59").localeCompare(
            b.startTime || "23:59:59"
        );
    });
}

// Group recurring task occurrences into one parent group.
function groupRecurringTasks(tasks) {
    const groups = new Map();

    tasks.forEach((task) => {
        const groupKey = task.recurrenceGroupId
            ? `recurring-${task.recurrenceGroupId}`
            : `single-${task.id}`;

        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                groupKey,
                isRecurring: Boolean(task.recurrenceGroupId),
                tasks: [],
            });
        }

        groups.get(groupKey).tasks.push(task);
    });

    return Array.from(groups.values()).map((group) => ({
        ...group,
        tasks: sortTasks(group.tasks),
    }));
}

// Format dates using the Indian date convention.
function formatTaskDate(dateString) {
    if (!dateString) return "Not set";

    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// Convert stored 24-hour time into 12-hour IST display.
function formatTaskTime(timeString) {
    if (!timeString) return "Not set";

    const [hours, minutes] = timeString.split(":").map(Number);

    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

// Format a task's complete time range.
function formatTaskTimeRange(task) {
    const start = task.startTime
        ? formatTaskTime(task.startTime)
        : null;

    const end = task.endTime
        ? formatTaskTime(task.endTime)
        : null;

    if (start && end) return `${start} – ${end} IST`;
    if (start) return `From ${start} IST`;
    if (end) return `Until ${end} IST`;

    return "Time not set";
}

function Dashboard({initialTasks = []}) {
    const [tasks, setTasks] = useState(() =>
        sortTasks(initialTasks)
    );
    // Maintain the current date and time for the Live Focus section.
    const [currentDateTime, setCurrentDateTime] = useState(
        () => new Date()
    );

    // Update the live clock every second.
    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 1000);

        return () => clearInterval(intervalId);
    }, []);
    const dashboardTopRef = useRef(null);
    const tasksSectionRef = useRef(null);
    const [loading] = useState(false);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [activeSection, setActiveSection] = useState("dashboard");
    const [expandedGroups, setExpandedGroups] = useState({});
    const [editingTaskId, setEditingTaskId] = useState(null);
    // Track editing independently inside the Live Focus section.
    const [liveFocusEditingTaskId, setLiveFocusEditingTaskId] = useState(null);
    // Temporary deletion dialog and Undo notifications.
    const [deletionTarget, setDeletionTarget] = useState(null);
    const [isDeletingTask, setIsDeletingTask] = useState(false);
    const [undoBatches, setUndoBatches] = useState([]);

    // Preview and confirmation state for bulk deletion of old tasks.
    const [oldTasksPreview, setOldTasksPreview] = useState(null);
    const [isLoadingOldTasksPreview, setIsLoadingOldTasksPreview] = useState(false);
    const [isDeletingOldTasks, setIsDeletingOldTasks] = useState(false);
    const [oldTasksDeletionError, setOldTasksDeletionError] = useState("");

    const user = auth.currentUser;

    const [managedUsers, setManagedUsers] = useState([]);
    const [viewerRole, setViewerRole] = useState(null);


    // Update Undo countdowns and remove expired notifications.
    useEffect(() => {
        if (undoBatches.length === 0) {
            return;
        }

        const intervalId = setInterval(() => {
            const now = Date.now();

            setUndoBatches((previousBatches) =>
                previousBatches
                    .map((batch) => ({
                        ...batch,
                        remainingSeconds: Math.max(
                            0,
                            Math.ceil((batch.expiresAtMs - now) / 1000)
                        ),
                    }))
                    .filter((batch) => batch.expiresAtMs > now)
            );
        }, 1000);

        return () => clearInterval(intervalId);
    }, [undoBatches.length]);
    // Identify whether the signed-in account can manage users.
    useEffect(() => {
        let isMounted = true;

        const loadManagementAccess = async () => {
            try {
                const userList = await getAllUsers();

                if (!Array.isArray(userList)) {
                    throw new Error("Invalid user list received.");
                }

                const currentAccount = userList.find(
                    (account) =>
                        account.email?.toLowerCase() ===
                        user?.email?.toLowerCase()
                );

                if (
                    currentAccount &&
                    (currentAccount.role === "OWNER" ||
                        currentAccount.role === "ADMIN")
                ) {
                    if (isMounted) {
                        setManagedUsers(userList);
                        setViewerRole(currentAccount.role);
                    }
                }
            } catch (error) {
                if (error.status !== 403) {
                    console.error(
                        "User management access check failed:",
                        error
                    );
                }
            }
        };

        if (user?.email) {
            loadManagementAccess();
        }

        return () => {
            isMounted = false;
        };
    }, [user?.email]);

    // Add a newly created task to the dashboard.
    const handleTaskCreated = (newTask) => {
        setTasks((previousTasks) =>
            sortTasks([...previousTasks, newTask])
        );
    };

    // Toggle a task between completed and pending.
    const handleToggleCompleted = async (task) => {
        try {
            setActionLoadingId(task.id);
            setActionError("");

            const taskPayload = {
                title: task.title,
                description: task.description,
                taskDate: task.taskDate,
                startTime: task.startTime || null,
                endTime: task.endTime || null,
                completed: !task.completed,
                important: task.important,
                category: task.category,
            };

            const updatedTask = await updateTask(
                task.id,
                taskPayload
            );

            setTasks((previousTasks) =>
                sortTasks(
                    previousTasks.map((item) =>
                        item.id === updatedTask.id
                            ? updatedTask
                            : item
                    )
                )
            );

            return true;
        } catch (error) {
            console.error("Task status update error:", error);
            setActionError(
                error.message || "Unable to update task status."
            );

            return false;
        } finally {
            setActionLoadingId(null);
        }
    };

    // Update an existing task.
    const handleUpdateTask = async (taskId, taskPayload) => {
        try {
            setActionLoadingId(taskId);
            setActionError("");

            const updatedTask = await updateTask(
                taskId,
                taskPayload
            );

            setTasks((previousTasks) =>
                sortTasks(
                    previousTasks.map((task) =>
                        task.id === updatedTask.id
                            ? updatedTask
                            : task
                    )
                )
            );

            return updatedTask;

        } catch (error) {
            console.error("Task update error:", error);

            setActionError(
                error.message || "Unable to update task."
            );

            throw error;

        } finally {
            setActionLoadingId(null);
        }
    };

// Open the in-app deletion dialog and close Calendar's task-details popup.
    const handleDeleteTask = (task) => {
        setActionError("");
        setDeletionTarget(task);

        return true;
    };

// Confirm deletion of one occurrence or an entire recurring series.
    const confirmDeleteTask = async (scope) => {
        if (!deletionTarget || isDeletingTask) {
            return;
        }

        const task = deletionTarget;

        const isSeriesDeletion =
            scope === "series" && Boolean(task.recurrenceGroupId);

        const tasksToDelete = isSeriesDeletion
            ? tasks.filter(
                (item) =>
                    item.recurrenceGroupId === task.recurrenceGroupId
            )
            : tasks.filter((item) => item.id === task.id);

        try {
            setIsDeletingTask(true);
            setActionLoadingId(task.id);
            setActionError("");

            const response = isSeriesDeletion
                ? await deleteTaskSeries(task.id)
                : await deleteTask(task.id);

            if (!response?.batchId || !response?.expiresAt) {
                throw new Error("Invalid deletion response received.");
            }

            const expiresAtMs = new Date(response.expiresAt).getTime();

            if (Number.isNaN(expiresAtMs)) {
                throw new Error("Invalid deletion expiry time received.");
            }

            // Remove the deleted task or recurring series from the UI.
            setTasks((previousTasks) =>
                previousTasks.filter((item) =>
                    isSeriesDeletion
                        ? item.recurrenceGroupId !== task.recurrenceGroupId
                        : item.id !== task.id
                )
            );

            // Preserve the original task data for Undo.
            setUndoBatches((previousBatches) => [
                ...previousBatches,
                {
                    batchId: response.batchId,
                    deletedTasks: tasksToDelete,
                    expiresAtMs,
                    remainingSeconds: Math.max(
                        0,
                        Math.ceil((expiresAtMs - Date.now()) / 1000)
                    ),
                },
            ]);

            setDeletionTarget(null);
            setEditingTaskId(null);

        } catch (error) {
            console.error("Task deletion error:", error);

            setActionError(
                error.message || "Unable to delete task."
            );

        } finally {
            setIsDeletingTask(false);
            setActionLoadingId(null);
        }
    };

// Restore tasks from a temporary deletion batch.
    const handleUndoDeletion = async (batch) => {
        if (
            !batch ||
            batch.expiresAtMs <= Date.now()
        ) {
            return;
        }

        try {
            setActionError("");

            // Restore the complete deletion batch in the backend.
            await undoTaskDeletion(batch.batchId);

            // Remove the Undo notification after successful restoration.
            setUndoBatches((previousBatches) =>
                previousBatches.filter(
                    (item) => item.batchId !== batch.batchId
                )
            );

            // Reload the authoritative task list from the backend.
            try {
                const restoredTasks = await getAllTasks();

                if (!Array.isArray(restoredTasks)) {
                    throw new Error("Invalid task list received.");
                }

                setTasks(sortTasks(restoredTasks));

            } catch (refreshError) {
                console.error(
                    "Task list refresh after Undo failed:",
                    refreshError
                );

                // Preserve the existing local restoration as a fallback.
                setTasks((previousTasks) =>
                    sortTasks([
                        ...previousTasks,
                        ...batch.deletedTasks.filter(
                            (deletedTask) =>
                                !previousTasks.some(
                                    (task) => task.id === deletedTask.id
                                )
                        ),
                    ])
                );

                setActionError(
                    "Tasks were restored, but the task list could not be refreshed. Please refresh the page."
                );
            }

        } catch (error) {
            console.error("Task restoration error:", error);

            setActionError(
                error.message || "Unable to restore deleted tasks."
            );
        }
    };

    // Load a preview of all eligible old tasks for the signed-in user.
    const handlePreviewOldTasksDeletion = async () => {
        try {
            setIsLoadingOldTasksPreview(true);
            setOldTasksDeletionError("");
            setOldTasksPreview(null);
            setActionError("");

            const response = await previewOldTasksDeletion();

            if (
                !response ||
                typeof response.taskCount !== "number" ||
                !response.cutoffDate
            ) {
                throw new Error("Invalid old-tasks preview received.");
            }

            setOldTasksPreview(response);

        } catch (error) {
            console.error("Old tasks preview error:", error);

            setOldTasksDeletionError(
                error.message || "Unable to load old tasks preview."
            );

        } finally {
            setIsLoadingOldTasksPreview(false);
        }
    };


// Confirm bulk deletion of all eligible old tasks.
    const confirmDeleteOldTasks = async () => {
        if (
            !oldTasksPreview ||
            oldTasksPreview.taskCount === 0 ||
            isDeletingOldTasks
        ) {
            return;
        }

        try {
            setIsDeletingOldTasks(true);
            setOldTasksDeletionError("");

            // Keep a local snapshot as a fallback for Undo.
            const eligibleTasks = tasks.filter(
                (task) => task.taskDate < oldTasksPreview.cutoffDate
            );

            const response = await deleteOldTasks();

            if (!response?.batchId || !response?.expiresAt) {
                throw new Error("Invalid bulk deletion response received.");
            }

            const expiresAtMs = new Date(response.expiresAt).getTime();

            if (Number.isNaN(expiresAtMs)) {
                throw new Error("Invalid deletion expiry time received.");
            }

            // Immediately remove tasks covered by the preview cutoff.
            setTasks((previousTasks) =>
                previousTasks.filter(
                    (task) => task.taskDate >= oldTasksPreview.cutoffDate
                )
            );

            // Register the batch in the existing five-minute Undo system.
            setUndoBatches((previousBatches) => [
                ...previousBatches,
                {
                    batchId: response.batchId,
                    deletedTasks: eligibleTasks,
                    deletedCount: response.deletedCount ?? eligibleTasks.length,
                    expiresAtMs,
                    remainingSeconds: Math.max(
                        0,
                        Math.ceil((expiresAtMs - Date.now()) / 1000)
                    ),
                },
            ]);

            setOldTasksPreview(null);

            // Refresh the task list using the backend's actual state.
            try {
                const refreshedTasks = await getAllTasks();

                if (!Array.isArray(refreshedTasks)) {
                    throw new Error("Invalid task list received.");
                }

                setTasks(sortTasks(refreshedTasks));

            } catch (refreshError) {
                console.error(
                    "Task list refresh after bulk deletion failed:",
                    refreshError
                );

                setOldTasksDeletionError(
                    "Old tasks were deleted, but the task list could not be refreshed. Please refresh the page."
                );
            }

        } catch (error) {
            console.error("Old tasks bulk deletion error:", error);

            setOldTasksDeletionError(
                error.message || "Unable to delete old tasks."
            );

        } finally {
            setIsDeletingOldTasks(false);
        }
    };

// Handle sidebar navigation and task filtering.
    const handleNavigation = (section) => {
        setActiveSection(section);

        const sectionRefs = {
            dashboard: dashboardTopRef,
            tasks: tasksSectionRef,
            important: tasksSectionRef,
            completed: tasksSectionRef,
        };

        const targetRef = sectionRefs[section];
        const mainContainer = document.querySelector(".dashboard-main");

        if (!targetRef?.current || !mainContainer) {
            return;
        }

        const containerTop =
            mainContainer.getBoundingClientRect().top;

        const targetTop =
            targetRef.current.getBoundingClientRect().top;

        const scrollPosition =
            mainContainer.scrollTop + targetTop - containerTop;

        mainContainer.scrollTo({
            top: scrollPosition,
            behavior: "smooth",
        });
    };

    const handleSignOut = async () => {
        try {
            await signOutUser();
        } catch (error) {
            console.error("Sign-out error:", error);
            setActionError("Unable to sign out.");
        }
    };

    const completedCount = tasks.filter(
        (task) => task.completed
    ).length;

    const pendingCount = tasks.length - completedCount;

    const importantCount = tasks.filter(
        (task) => task.important
    ).length;

    // Filter tasks according to the selected sidebar section.
    const filteredTasks = tasks.filter((task) => {
        if (activeSection === "important") {
            return task.important;
        }

        if (activeSection === "completed") {
            return task.completed;
        }

        return true;
    });

    // Group recurring occurrences for the My Tasks display.
    const groupedTasks = groupRecurringTasks(filteredTasks);

    // Get today's date and current time using the device's local timezone.
    const today = [
        currentDateTime.getFullYear(),
        String(currentDateTime.getMonth() + 1).padStart(2, "0"),
        String(currentDateTime.getDate()).padStart(2, "0"),
    ].join("-");

    const currentTime = [
        String(currentDateTime.getHours()).padStart(2, "0"),
        String(currentDateTime.getMinutes()).padStart(2, "0"),
    ].join(":");

// Find every task currently scheduled on today's date.
    const currentTasks = sortTasks(
        tasks.filter((task) => {
            if (
                task.taskDate !== today ||
                !task.startTime ||
                !task.endTime
            ) {
                return false;
            }

            const startTime = task.startTime.slice(0, 5);
            const endTime = task.endTime.slice(0, 5);

            return (
                startTime <= currentTime &&
                currentTime < endTime
            );
        })
    );

// Find pending tasks scheduled later today.
    const upcomingTasks = sortTasks(
        tasks.filter((task) => {
            if (
                task.taskDate !== today ||
                task.completed ||
                !task.startTime
            ) {
                return false;
            }

            return task.startTime.slice(0, 5) > currentTime;
        })
    );

// Find the next scheduled time and all tasks starting then.
    const nextUpcomingTime = upcomingTasks.length > 0
        ? upcomingTasks[0].startTime.slice(0, 5)
        : null;

    const nextUpcomingTasks = nextUpcomingTime
        ? upcomingTasks.filter(
            (task) => task.startTime.slice(0, 5) === nextUpcomingTime
        )
        : [];

    return (
        <div className="dashboard-container">

            {/* Bulk deletion preview and confirmation dialog */}
            {oldTasksPreview && (
                <div
                    className="task-deletion-overlay"
                    onClick={() => {
                        if (!isDeletingOldTasks) {
                            setOldTasksPreview(null);
                            setOldTasksDeletionError("");
                        }
                    }}
                >
                    <div
                        className="task-deletion-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="old-tasks-deletion-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="task-deletion-icon">
                            !
                        </div>

                        <h2 id="old-tasks-deletion-title">
                            Delete old tasks?
                        </h2>

                        {oldTasksPreview.taskCount > 0 ? (
                            <>
                                <p>
                                    The following tasks will be temporarily deleted:
                                </p>

                                <div className="old-tasks-preview-details">
                                    <p>
                                        <strong>Tasks:</strong>{" "}
                                        {oldTasksPreview.taskCount}
                                    </p>

                                    <p>
                                        <strong>Oldest task:</strong>{" "}
                                        {formatTaskDate(oldTasksPreview.oldestTaskDate)}
                                    </p>

                                    <p>
                                        <strong>Newest task:</strong>{" "}
                                        {formatTaskDate(oldTasksPreview.newestTaskDate)}
                                    </p>

                                    <p>
                                        <strong>Cutoff date:</strong>{" "}
                                        {formatTaskDate(oldTasksPreview.cutoffDate)}
                                    </p>

                                    <p>
                                        Only tasks dated before the cutoff date will be deleted.
                                        Both completed and pending tasks are included.
                                    </p>

                                    <p>
                                        You can undo this deletion within five minutes.
                                    </p>
                                </div>

                                <div className="task-deletion-actions">
                                    <button
                                        type="button"
                                        className="deletion-button deletion-button-series"
                                        onClick={confirmDeleteOldTasks}
                                        disabled={isDeletingOldTasks}
                                    >
                                        {isDeletingOldTasks
                                            ? "Deleting..."

                                            : `Delete ${oldTasksPreview.taskCount} ${
                                                oldTasksPreview.taskCount === 1 ? "task" : "tasks"
                                            }`}
                                    </button>

                                    <button
                                        type="button"
                                        className="deletion-button deletion-button-cancel"
                                        onClick={() => {
                                            setOldTasksPreview(null);
                                            setOldTasksDeletionError("");
                                        }}
                                        disabled={isDeletingOldTasks}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p>
                                    No eligible old tasks were found.
                                </p>

                                <div className="task-deletion-actions">
                                    <button
                                        type="button"
                                        className="deletion-button deletion-button-cancel"
                                        onClick={() => setOldTasksPreview(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </>
                        )}

                        {oldTasksDeletionError && (
                            <p className="dashboard-error">
                                {oldTasksDeletionError}
                            </p>
                        )}
                    </div>
                </div>
            )}
            {/* Task deletion confirmation dialog */}
            {deletionTarget && (
                <div
                    className="task-deletion-overlay"
                    onClick={() => {
                        if (!isDeletingTask) {
                            setDeletionTarget(null);
                        }
                    }}
                >
                    <div
                        className="task-deletion-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="task-deletion-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="task-deletion-icon">
                            !
                        </div>

                        <h2 id="task-deletion-title">
                            {deletionTarget.recurrenceGroupId
                                ? "Delete recurring task?"
                                : "Delete task?"}
                        </h2>

                        <p>
                            {deletionTarget.recurrenceGroupId
                                ? `Choose whether to delete only "${deletionTarget.title}" on this date or every occurrence in this recurring series.`
                                : `Are you sure you want to delete "${deletionTarget.title}"?`}
                        </p>

                        <div className="task-deletion-actions">
                            {deletionTarget.recurrenceGroupId ? (
                                <>
                                    <button
                                        type="button"
                                        className="deletion-button deletion-button-occurrence"
                                        onClick={() =>
                                            confirmDeleteTask("occurrence")
                                        }
                                        disabled={isDeletingTask}
                                    >
                                        Delete this occurrence
                                    </button>

                                    <button
                                        type="button"
                                        className="deletion-button deletion-button-series"
                                        onClick={() =>
                                            confirmDeleteTask("series")
                                        }
                                        disabled={isDeletingTask}
                                    >
                                        Delete entire series
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="deletion-button deletion-button-series"
                                    onClick={() =>
                                        confirmDeleteTask("occurrence")
                                    }
                                    disabled={isDeletingTask}
                                >
                                    {isDeletingTask
                                        ? "Deleting..."
                                        : "Delete task"}
                                </button>
                            )}

                            <button
                                type="button"
                                className="deletion-button deletion-button-cancel"
                                onClick={() =>
                                    setDeletionTarget(null)
                                }
                                disabled={isDeletingTask}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Temporary deletion Undo notifications */}
            {undoBatches.length > 0 && (
                <div
                    className="task-undo-container"
                    aria-live="polite"
                >
                    {undoBatches.map((batch) => (
                        <div
                            className="task-undo-notification"
                            key={batch.batchId}
                        >
                            <div className="task-undo-message">
                                <strong>
                                    {(batch.deletedCount ?? batch.deletedTasks.length) === 1
                                        ? "Task deleted"
                                        : `${batch.deletedCount ?? batch.deletedTasks.length} tasks deleted`}
                                </strong>

                                <span>
                                    Undo available for{" "}
                                    {Math.floor(
                                        batch.remainingSeconds / 60
                                    )}
                                    :
                                    {String(
                                        batch.remainingSeconds % 60
                                    ).padStart(2, "0")}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="task-undo-button"
                                onClick={() =>
                                    handleUndoDeletion(batch)
                                }
                                disabled={
                                    batch.expiresAtMs <= Date.now()
                                }
                            >
                                Undo
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <aside className="sidebar">
                <h2 className="sidebar-logo">FocusBoard Pro</h2>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${
                            activeSection === "dashboard" ? "active" : ""
                        }`}
                        onClick={() => handleNavigation("dashboard")}
                    >
                        Dashboard
                    </button>

                    <button
                        className={`nav-item ${
                            activeSection === "tasks" ? "active" : ""
                        }`}
                        onClick={() => handleNavigation("tasks")}
                    >
                        My Tasks
                    </button>

                    <button
                        className={`nav-item ${
                            activeSection === "calendar" ? "active" : ""
                        }`}
                        onClick={() => setActiveSection("calendar")}
                    >
                        Calendar
                    </button>

                    <button
                        className={`nav-item ${
                            activeSection === "important" ? "active" : ""
                        }`}
                        onClick={() => handleNavigation("important")}
                    >
                        Important
                    </button>

                    <button
                        className={`nav-item ${
                            activeSection === "completed" ? "active" : ""
                        }`}
                        onClick={() => handleNavigation("completed")}
                    >
                        Completed
                    </button>
                    {(viewerRole === "OWNER" || viewerRole === "ADMIN") && (
                        <button
                            className={`nav-item ${
                                activeSection === "user-management" ? "active" : ""
                            }`}
                            onClick={() => setActiveSection("user-management")}
                        >
                            User Management
                        </button>
                    )}
                </nav>

                {/* Bulk delete old tasks */}
                <button
                    type="button"
                    className="sidebar-action-button"
                    onClick={handlePreviewOldTasksDeletion}
                    disabled={isLoadingOldTasksPreview || isDeletingOldTasks}
                >
                    {isLoadingOldTasksPreview
                        ? "Checking old tasks..."
                        : "Delete Old Tasks"}
                </button>

                {oldTasksDeletionError && !oldTasksPreview && (
                    <p className="dashboard-error sidebar-deletion-error">
                        {oldTasksDeletionError}
                    </p>
                )}

                {/* Sign Out */}
                <button
                    className="sign-out-button"
                    onClick={handleSignOut}
                >
                    Sign Out
                </button>
            </aside>

            <main className="dashboard-main">
                <header
                    className="dashboard-header"
                    ref={dashboardTopRef}
                >
                    <div>
                        <h1>Dashboard</h1>
                        <p>
                            Welcome back, {user?.displayName || "User"}!
                        </p>
                    </div>
                    <div className="profile-section">
                        <span>{user?.email}</span>
                    </div>
                </header>

                {activeSection === "user-management" && viewerRole ? (
                    <UserManagement
                        users={managedUsers}
                        viewerRole={viewerRole}
                        onUsersChange={setManagedUsers}
                    />
                ) : activeSection === "calendar" ? (
                    <Calendar
                        tasks={tasks}
                        onToggleCompleted={handleToggleCompleted}
                        onDeleteTask={handleDeleteTask}
                        onTaskUpdated={handleUpdateTask}
                    />
                ) : (
                    <section className="dashboard-content">

                        <div className="welcome-card">
                            <h2>Stay focused. Get things done.</h2>

                            <p>
                                Organize your schedule, manage your tasks,
                                and make every day productive.
                            </p>
                        </div>

                        {/* Live Focus Section */}
                        <section className="live-focus-section">
                            <div className="live-focus-header">
                                <div>
                                    <h2>Live Focus</h2>
                                    <p>
                                        Your current schedule and active tasks.
                                    </p>
                                </div>

                                <div className="live-focus-clock">
                                    <strong>
                                        {currentDateTime.toLocaleTimeString("en-IN", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                            hour12: true,
                                        })}
                                    </strong>

                                    <span>
                {currentDateTime.toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                })}
            </span>
                                </div>
                            </div>

                            {currentTasks.length > 0 ? (
                                <>
                                    <div className="live-focus-summary">
                                        <span className="live-focus-status-dot" />
                                        <strong>
                                            {currentTasks.length} task
                                            {currentTasks.length !== 1 ? "s" : ""} currently active
                                        </strong>
                                    </div>

                                    <div className="live-focus-task-list">
                                        {currentTasks.map((task) => {
                                            const isBusy = actionLoadingId === task.id;

                                            return (
                                                <article
                                                    className="live-focus-task-card"
                                                    key={task.id}
                                                >
                                                    <div className="live-focus-task-details">
                                                        <div className="live-focus-task-title">
                                                            <h3>{task.title}</h3>

                                                            {task.important && (
                                                                <span className="important-badge">
                                            ★ Important
                                        </span>
                                                            )}
                                                        </div>

                                                        <p>
                                                            {task.description ||
                                                                "No description provided."}
                                                        </p>

                                                        <div className="live-focus-task-meta">
                                    <span>
                                        <strong>Date:</strong>{" "}
                                        {formatTaskDate(task.taskDate)}
                                    </span>

                                                            <span>
                                        <strong>Time:</strong>{" "}
                                                                {formatTaskTimeRange(task)}
                                    </span>

                                                            <span>
                                        <strong>Category:</strong>{" "}
                                                                {task.category || "Other"}
                                    </span>

                                                            <span>
                                        <strong>Status:</strong>{" "}
                                                                {task.completed
                                                                    ? "Completed"
                                                                    : "In progress"}
                                    </span>
                                                        </div>
                                                    </div>

                                                    <div className="live-focus-task-actions">
                                                        <button
                                                            type="button"
                                                            className="task-action-button"
                                                            onClick={() =>
                                                                setLiveFocusEditingTaskId(
                                                                    liveFocusEditingTaskId === task.id
                                                                        ? null
                                                                        : task.id
                                                                )
                                                            }
                                                            disabled={isBusy}
                                                        >
                                                            {liveFocusEditingTaskId === task.id
                                                                ? "Close Edit"
                                                                : "Edit"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="task-action-button"
                                                            onClick={() =>
                                                                handleToggleCompleted(task)
                                                            }
                                                            disabled={isBusy}
                                                        >
                                                            {isBusy
                                                                ? "Updating..."
                                                                : task.completed
                                                                    ? "Undo Complete"
                                                                    : "Complete"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="task-action-button"
                                                            onClick={() => handleDeleteTask(task)}
                                                            disabled={isBusy}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>

                                                    {liveFocusEditingTaskId === task.id && (
                                                        <TaskForm
                                                            key={`live-focus-${task.id}`}
                                                            initialTask={task}
                                                            onTaskUpdated={async (taskId, payload) => {
                                                                await handleUpdateTask(taskId, payload);
                                                                setLiveFocusEditingTaskId(null);
                                                            }}
                                                            onCancel={() =>
                                                                setLiveFocusEditingTaskId(null)
                                                            }
                                                        />
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : nextUpcomingTasks.length > 0 ? (
                                <>
                                    <div className="live-focus-upcoming-heading">
                                        <span>Upcoming</span>

                                        <strong>
                                            Next task{nextUpcomingTasks.length !== 1 ? "s" : ""} at{" "}
                                            {formatTaskTime(nextUpcomingTime)}
                                        </strong>
                                    </div>

                                    <div className="live-focus-task-list">
                                        {nextUpcomingTasks.map((task) => {
                                            const isBusy = actionLoadingId === task.id;

                                            return (
                                                <article
                                                    className="live-focus-task-card upcoming"
                                                    key={task.id}
                                                >
                                                    <div className="live-focus-task-details">
                                                        <h3>{task.title}</h3>

                                                        <p>
                                                            {task.description ||
                                                                "No description provided."}
                                                        </p>

                                                        <div className="live-focus-task-meta">
                                    <span>
                                        <strong>Date:</strong>{" "}
                                        {formatTaskDate(task.taskDate)}
                                    </span>

                                                            <span>
                                        <strong>Time:</strong>{" "}
                                                                {formatTaskTimeRange(task)}
                                    </span>

                                                            <span>
                                        <strong>Category:</strong>{" "}
                                                                {task.category || "Other"}
                                    </span>

                                                            <span>
                                        <strong>Status:</strong> Pending
                                    </span>
                                                        </div>
                                                    </div>

                                                    <div className="live-focus-task-actions">
                                                        <button
                                                            type="button"
                                                            className="task-action-button"
                                                            onClick={() =>
                                                                setLiveFocusEditingTaskId(
                                                                    liveFocusEditingTaskId === task.id
                                                                        ? null
                                                                        : task.id
                                                                )
                                                            }
                                                            disabled={isBusy}
                                                        >
                                                            {liveFocusEditingTaskId === task.id
                                                                ? "Close Edit"
                                                                : "Edit"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="task-action-button"
                                                            onClick={() => handleDeleteTask(task)}
                                                            disabled={isBusy}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>

                                                    {liveFocusEditingTaskId === task.id && (
                                                        <TaskForm
                                                            key={`live-focus-${task.id}`}
                                                            initialTask={task}
                                                            onTaskUpdated={async (taskId, payload) => {
                                                                await handleUpdateTask(taskId, payload);
                                                                setLiveFocusEditingTaskId(null);
                                                            }}
                                                            onCancel={() =>
                                                                setLiveFocusEditingTaskId(null)
                                                            }
                                                        />
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="live-focus-empty">
                                    <h3>No active tasks right now</h3>
                                    <p>
                                        You have no more pending scheduled tasks for today.
                                        Enjoy your free time!
                                    </p>
                                </div>
                            )}
                        </section>

                        {/* Dashboard Statistics */}
                        <div className="stats-grid">

                        <div className="stat-card">
                                <h3>Total Tasks</h3>
                                <p>{tasks.length}</p>
                            </div>

                            <div className="stat-card">
                                <h3>Completed</h3>
                                <p>{completedCount}</p>
                            </div>

                            <div className="stat-card">
                                <h3>Pending</h3>
                                <p>{pendingCount}</p>
                            </div>

                            <div className="stat-card">
                                <h3>Important</h3>
                                <p>{importantCount}</p>
                            </div>
                        </div>

                        {/* Create Task Form */}
                        <TaskForm onTaskCreated={handleTaskCreated}/>

                        {/* Task List */}
                        <section
                            className="tasks-section"
                            ref={tasksSectionRef}
                        >
                            <div className="tasks-section-heading">
                                <div>
                                    <h2>My Tasks</h2>
                                    <p>
                                        Manage your daily activities and progress.
                                    </p>
                                </div>

                                <span className="task-count">
                                {filteredTasks.length} tasks
                            </span>
                            </div>

                            {loading && (
                                <p className="task-message">
                                    Loading your tasks...
                                </p>
                            )}

                            {error && (
                                <p className="dashboard-error">
                                    {error}
                                </p>
                            )}

                            {actionError && (
                                <p className="dashboard-error">
                                    {actionError}
                                </p>
                            )}

                            {!loading && !error && filteredTasks.length === 0 && (
                                <p className="empty-tasks">
                                    {activeSection === "important"
                                        ? "No important tasks found."
                                        : activeSection === "completed"
                                            ? "No completed tasks found."
                                            : "No tasks yet. Your productivity journey starts here!"}
                                </p>
                            )}

                            {!loading && !error && filteredTasks.length > 0 && (
                                <div className="task-list">
                                    {groupedTasks.map((group) => {
                                        const parentTask = group.tasks[0];
                                        const isExpanded = expandedGroups[group.groupKey];

                                        // Calculate progress across the complete recurrence series.
                                        const allGroupTasks = group.isRecurring
                                            ? tasks.filter(
                                                (task) =>
                                                    task.recurrenceGroupId === parentTask.recurrenceGroupId
                                            )
                                            : group.tasks;

                                        const totalCount = allGroupTasks.length;

                                        const completedCount = allGroupTasks.filter(
                                            (task) => task.completed
                                        ).length;

                                        const remainingCount = totalCount - completedCount;

                                        const progressPercentage = totalCount > 0
                                            ? Math.round((completedCount / totalCount) * 100)
                                            : 0;
                                        // Show every occurrence in the horizontal daily tracker.
                                        const trackerTasks = allGroupTasks;

                                        const recurrenceLabel =
                                            parentTask.scheduleType === "DAILY"
                                                ? "Every day"
                                                : parentTask.scheduleType === "WEEKDAYS"
                                                    ? "Monday - Friday"
                                                    : parentTask.scheduleType === "CUSTOM"
                                                        ? `Custom: ${(parentTask.selectedWeekdays || []).join(", ")}`
                                                        : "Single task";

                                        return (
                                            <div
                                                className={`task-card ${
                                                    group.isRecurring ? "recurring-parent-card" : ""
                                                }`}
                                                key={group.groupKey}
                                            >
                                                {/* Parent card for recurring tasks */}
                                                {group.isRecurring && (
                                                    <div className="recurring-group-header">
                                                        <div className="task-card-main">
                                                            <div className="task-card-title-row">
                                                                <h3>{parentTask.title}</h3>

                                                                {parentTask.important && (
                                                                    <span className="important-badge">
                                            ★ Important
                                        </span>
                                                                )}
                                                            </div>

                                                            <p className="task-description">
                                                                {parentTask.description ||
                                                                    "No description provided."}
                                                            </p>

                                                            <div className="task-meta recurring-task-meta">
    <span>
        <strong>Start date:</strong>{" "}
        {formatTaskDate(
            parentTask.scheduleStartDate || parentTask.taskDate
        )}
    </span>

                                                                <span>
        <strong>End date:</strong>{" "}
                                                                    {formatTaskDate(
                                                                        parentTask.scheduleEndDate || parentTask.taskDate
                                                                    )}
    </span>

                                                                <span>
        <strong>Schedule:</strong>{" "}
                                                                    {recurrenceLabel}
    </span>

                                                                <span>
        <strong>Start time:</strong>{" "}
                                                                    {formatTaskTime(parentTask.startTime)}
                                                                    {parentTask.startTime ? " IST" : ""}
    </span>

                                                                <span>
        <strong>End time:</strong>{" "}
                                                                    {formatTaskTime(parentTask.endTime)}
                                                                    {parentTask.endTime ? " IST" : ""}
    </span>

                                                                <span>
        <strong>Category:</strong>{" "}
                                                                    {parentTask.category || "Other"}
    </span>

                                                                <span>
        <strong>Occurrences:</strong>{" "}
                                                                    {group.tasks.length}
    </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                className="task-action-button"
                                                                onClick={() =>
                                                                    setExpandedGroups((previous) => ({
                                                                        ...previous,
                                                                        [group.groupKey]: !previous[
                                                                            group.groupKey
                                                                            ],
                                                                    }))
                                                                }
                                                            >
                                                                {isExpanded
                                                                    ? "Hide occurrences"
                                                                    : "Show occurrences"}
                                                            </button>
                                                            {/* Recurring task progress */}
                                                            <div className="recurring-progress-section">

                                                                <div className="recurring-progress-heading">
                                                                    <strong>Daily Progress</strong>

                                                                    <span>
            {completedCount} / {totalCount} completed
        </span>
                                                                </div>

                                                                <div className="recurring-progress-bar">
                                                                    <div
                                                                        className="recurring-progress-fill"
                                                                        style={{
                                                                            width: `${progressPercentage}%`,
                                                                        }}
                                                                    />
                                                                </div>

                                                                <div className="recurring-progress-summary">
                                                                    <span>{progressPercentage}% completed</span>
                                                                    <span>{remainingCount} remaining</span>
                                                                </div>

                                                                <div className="recurring-tracker-heading">
                                                                    <strong>Quick daily tracker</strong>

                                                                    <span>
        {totalCount} occurrences · Scroll horizontally to view all
    </span>
                                                                </div>

                                                                <div className="recurring-daily-tracker">
                                                                    {trackerTasks.map((dailyTask) => {
                                                                        const isBusy = actionLoadingId === dailyTask.id;

                                                                        return (
                                                                            <button
                                                                                type="button"
                                                                                key={dailyTask.id}
                                                                                className={`recurring-day-indicator ${
                                                                                    dailyTask.completed
                                                                                        ? "day-completed"
                                                                                        : "day-pending"
                                                                                }`}
                                                                                onClick={() => handleToggleCompleted(dailyTask)}
                                                                                disabled={isBusy}
                                                                                aria-label={`${
                                                                                    dailyTask.completed
                                                                                        ? "Mark as pending"
                                                                                        : "Mark as completed"
                                                                                }: ${formatTaskDate(dailyTask.taskDate)}`}
                                                                                aria-pressed={dailyTask.completed}
                                                                                title={`${formatTaskDate(dailyTask.taskDate)} - ${
                                                                                    dailyTask.completed ? "Completed" : "Pending"
                                                                                }. Click to change status.`}
                                                                            >
                <span>
                    {isBusy
                        ? "..."
                        : dailyTask.completed
                            ? "✓"
                            : "○"}
                </span>

                                                                                <small>
                                                                                    {new Date(
                                                                                        `${dailyTask.taskDate}T00:00:00`
                                                                                    ).toLocaleDateString("en-IN", {
                                                                                        weekday: "short",
                                                                                    })}
                                                                                </small>

                                                                                <small>
                                                                                    {new Date(
                                                                                        `${dailyTask.taskDate}T00:00:00`
                                                                                    ).getDate()}
                                                                                </small>

                                                                                <small>
                                                                                    {dailyTask.completed ? "Done" : "Pending"}
                                                                                </small>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>

                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Individual task occurrences */}
                                                {(!group.isRecurring || isExpanded) && (
                                                    <div className="recurring-occurrences recurring-occurrences-grid">
                                                        {group.tasks.map((task) => {
                                                            const isBusy =
                                                                actionLoadingId === task.id;

                                                            return (
                                                                <article
                                                                    className={`task-card ${
                                                                        group.isRecurring ? "recurring-occurrence-card" : ""
                                                                    } ${
                                                                        task.completed ? "task-card-completed" : ""
                                                                    }`}
                                                                    key={task.id}
                                                                >
                                                                    <div className="task-card-main">

                                                                        {/* Normal task title */}
                                                                        {!group.isRecurring && (
                                                                            <div className="task-card-title-row">
                                                                                <h3>{task.title}</h3>

                                                                                {task.important && (
                                                                                    <span className="important-badge">
                            ★ Important
                        </span>
                                                                                )}
                                                                            </div>
                                                                        )}

                                                                        {/* Recurring occurrence date and status */}
                                                                        {group.isRecurring && (
                                                                            <div className="occurrence-card-header">
                                                                                <h4 className="occurrence-date">
                                                                                    {formatTaskDate(task.taskDate)}
                                                                                </h4>

                                                                                <span
                                                                                    className={`task-status ${
                                                                                        task.completed
                                                                                            ? "status-completed"
                                                                                            : "status-pending"
                                                                                    }`}
                                                                                >
                        {task.completed ? "Completed" : "Pending"}
                    </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Description for normal tasks */}
                                                                        {!group.isRecurring && (
                                                                            <p className="task-description">
                                                                                {task.description ||
                                                                                    "No description provided."}
                                                                            </p>
                                                                        )}

                                                                        {/* Task information */}
                                                                        <div className="task-meta">

                                                                            {!group.isRecurring && (
                                                                                <span>
                        <strong>Date:</strong>{" "}
                                                                                    {formatTaskDate(task.taskDate)}
                    </span>
                                                                            )}

                                                                            <span>
                    <strong>Time:</strong>{" "}
                                                                                {formatTaskTimeRange(task)}
                </span>

                                                                            <span>
                    <strong>Category:</strong>{" "}
                                                                                {task.category || "Other"}
                </span>

                                                                        </div>

                                                                        {/* Task status and actions */}
                                                                        <div className="task-card-footer">

                                                                            {!group.isRecurring && (
                                                                                <span
                                                                                    className={`task-status ${
                                                                                        task.completed
                                                                                            ? "status-completed"
                                                                                            : "status-pending"
                                                                                    }`}
                                                                                >
                        {task.completed ? "Completed" : "Pending"}
                    </span>
                                                                            )}

                                                                            <div className="task-actions">

                                                                                <button
                                                                                    type="button"
                                                                                    className="task-action-button"
                                                                                    onClick={() =>
                                                                                        setEditingTaskId(
                                                                                            editingTaskId === task.id
                                                                                                ? null
                                                                                                : task.id
                                                                                        )
                                                                                    }
                                                                                    disabled={isBusy}
                                                                                >
                                                                                    {editingTaskId === task.id
                                                                                        ? "Close Edit"
                                                                                        : "Edit"}
                                                                                </button>

                                                                                <button
                                                                                    type="button"
                                                                                    className={`task-action-button ${
                                                                                        task.completed
                                                                                            ? "undo-task-button"
                                                                                            : "complete-task-button"
                                                                                    }`}
                                                                                    onClick={() =>
                                                                                        handleToggleCompleted(task)
                                                                                    }
                                                                                    disabled={isBusy}
                                                                                >
                                                                                    {isBusy
                                                                                        ? "Please wait..."
                                                                                        : task.completed
                                                                                            ? "Undo"
                                                                                            : "Complete"}
                                                                                </button>

                                                                                <button
                                                                                    type="button"
                                                                                    className="task-action-button delete-task-button"
                                                                                    onClick={() =>
                                                                                        handleDeleteTask(task)
                                                                                    }
                                                                                    disabled={isBusy}
                                                                                >
                                                                                    Delete
                                                                                </button>

                                                                            </div>
                                                                        </div>

                                                                        {/* Edit only this occurrence */}
                                                                        {editingTaskId === task.id && (
                                                                            <TaskForm
                                                                                initialTask={task}
                                                                                onTaskUpdated={async (taskId, payload) => {
                                                                                    await handleUpdateTask(taskId, payload);
                                                                                    setEditingTaskId(null);
                                                                                }}
                                                                                onCancel={() =>
                                                                                    setEditingTaskId(null)
                                                                                }
                                                                            />
                                                                        )}

                                                                    </div>
                                                                </article>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </section>
                )}
            </main>
        </div>
    );
}

export default Dashboard;
