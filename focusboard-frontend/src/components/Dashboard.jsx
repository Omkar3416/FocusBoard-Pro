
import { useEffect, useRef, useState } from "react";
import { auth } from "../firebase";
import { signOutUser } from "../auth";
import {
    updateTask,
    deleteTask,
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
function Dashboard({ initialTasks = [] }) {
    const [tasks, setTasks] = useState(() =>
        sortTasks(initialTasks)
    );
    const dashboardTopRef = useRef(null);
    const tasksSectionRef = useRef(null);
    const [loading] = useState(false);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [activeSection, setActiveSection] = useState("dashboard");
    const [expandedGroups, setExpandedGroups] = useState({});
    const [editingTaskId, setEditingTaskId] = useState(null);

    const user = auth.currentUser;

    const [managedUsers, setManagedUsers] = useState([]);
    const [viewerRole, setViewerRole] = useState(null);

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

    // Delete a task after user confirmation.
    const handleDeleteTask = async (task) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${task.title}"?`
        );

        if (!confirmed) {
            return false;
        }

        try {
            setActionLoadingId(task.id);
            setActionError("");

            await deleteTask(task.id);

            setTasks((previousTasks) =>
                previousTasks.filter(
                    (item) => item.id !== task.id
                )
            );

            return true;
        } catch (error) {
            console.error("Task deletion error:", error);
            setActionError(
                error.message || "Unable to delete task."
            );

            return false;
        } finally {
            setActionLoadingId(null);
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

    return (
        <div className="dashboard-container">
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
                    <TaskForm onTaskCreated={handleTaskCreated} />

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

                                                        <div className="task-meta">


                                    <span>
                                        <strong>Date range:</strong>{" "}
                                        {parentTask.scheduleStartDate ||
                                            parentTask.taskDate}
                                        {" - "}
                                        {parentTask.scheduleEndDate ||
                                            parentTask.taskDate}
                                    </span>

                                                            <span>
                                        <strong>Schedule:</strong>{" "}
                                                                {recurrenceLabel}
                                    </span>

                                                            <span>
                                        <strong>Time:</strong>{" "}
                                                                {parentTask.startTime
                                                                    ? parentTask.startTime.slice(0, 5)
                                                                    : "Not set"}
                                                                {" - "}
                                                                {parentTask.endTime
                                                                    ? parentTask.endTime.slice(0, 5)
                                                                    : "Not set"}
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

                                                            <div className="recurring-daily-tracker">
                                                                {allGroupTasks.map((dailyTask) => (
                                                                    <div
                                                                        key={dailyTask.id}
                                                                        className={`recurring-day-indicator ${
                                                                            dailyTask.completed
                                                                                ? "day-completed"
                                                                                : "day-pending"
                                                                        }`}
                                                                        title={`${dailyTask.taskDate}: ${
                                                                            dailyTask.completed ? "Completed" : "Pending"
                                                                        }`}
                                                                    >
                <span>
                    {dailyTask.completed ? "✓" : "○"}
                </span>

                                                                        <small>
                                                                            {new Date(
                                                                                `${dailyTask.taskDate}T00:00:00`
                                                                            ).getDate()}
                                                                        </small>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Individual task occurrences */}
                                            {(!group.isRecurring || isExpanded) && (
                                                <div className="recurring-occurrences">
                                                    {group.tasks.map((task) => {
                                                        const isBusy =
                                                            actionLoadingId === task.id;

                                                        return (
                                                            <article
                                                                className={`task-card ${
                                                                    task.completed
                                                                        ? "task-card-completed"
                                                                        : ""
                                                                }`}
                                                                key={task.id}
                                                            >
                                                                <div className="task-card-main">
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

                                                                    {group.isRecurring && (
                                                                        <h4 className="occurrence-date">
                                                                            {task.taskDate}
                                                                        </h4>
                                                                    )}

                                                                    {!group.isRecurring && (
                                                                        <p className="task-description">
                                                                            {task.description ||
                                                                                "No description provided."}
                                                                        </p>
                                                                    )}

                                                                    <div className="task-meta">


                                                <span>
                                                    <strong>Date:</strong>{" "}
                                                    {task.taskDate}
                                                </span>

                                                                        <span>
                                                    <strong>Time:</strong>{" "}
                                                                            {task.startTime
                                                                                ? task.startTime.slice(0, 5)
                                                                                : "Not set"}
                                                                            {" - "}
                                                                            {task.endTime
                                                                                ? task.endTime.slice(0, 5)
                                                                                : "Not set"}
                                                </span>

                                                                        <span>
                                                    <strong>Category:</strong>{" "}
                                                                            {task.category || "Other"}
                                                </span>
                                                                    </div>

                                                                    <div className="task-card-footer">
                                                <span
                                                    className={`task-status ${
                                                        task.completed
                                                            ? "status-completed"
                                                            : "status-pending"
                                                    }`}
                                                >
                                                    {task.completed
                                                        ? "Completed"
                                                        : "Pending"}
                                                </span>

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
                                                                            onTaskUpdated={async (
                                                                                taskId,
                                                                                payload
                                                                            ) => {
                                                                                await handleUpdateTask(
                                                                                    taskId,
                                                                                    payload
                                                                                );
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
