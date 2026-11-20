
import { useMemo, useState } from "react";
import TaskForm from "./TaskForm";
import "./Calendar.css";

function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function Calendar({
                      tasks = [],
                      onToggleCompleted,
                      onDeleteTask,
                      onTaskUpdated,
                  }) {
    const today = new Date();

    const [currentDate, setCurrentDate] = useState(
        new Date(today.getFullYear(), today.getMonth(), 1)
    );

    const [selectedDate, setSelectedDate] = useState(
        getDateKey(today)
    );

    const [selectedTask, setSelectedTask] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthName = currentDate.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
    });

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Monday is the first day of the week.
        const startingDay = (firstDay.getDay() + 6) % 7;

        const totalCells = Math.ceil(
            (startingDay + daysInMonth) / 7
        ) * 7;

        return Array.from({ length: totalCells }, (_, index) => {
            const dayNumber = index - startingDay + 1;

            if (dayNumber < 1 || dayNumber > daysInMonth) {
                return null;
            }

            const date = new Date(year, month, dayNumber);

            return {
                day: dayNumber,
                dateKey: getDateKey(date),
            };
        });
    }, [year, month]);

    const handleToggleSelectedTask = async () => {
        if (!selectedTask || !onToggleCompleted) return;

        const success = await onToggleCompleted(selectedTask);

        if (success) {
            setSelectedTask(null);
        }
    };

    const handleDeleteSelectedTask = async () => {
        if (!selectedTask || !onDeleteTask) return;

        const success = await onDeleteTask(selectedTask);

        if (success) {
            setSelectedTask(null);
        }
    };

    const selectedTasks = tasks.filter(
        (task) => task.taskDate === selectedDate
    );

    const goToPreviousMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const goToToday = () => {
        const now = new Date();

        setCurrentDate(
            new Date(now.getFullYear(), now.getMonth(), 1)
        );

        setSelectedDate(getDateKey(now));
    };

    const formatSelectedDate = () => {
        const date = new Date(`${selectedDate}T00:00:00`);

        return date.toLocaleDateString("en-US", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    return (
        <div className="calendar-page">

            <div className="calendar-page-header">
                <div>
                    <h1>Calendar</h1>
                    <p>Plan your schedule and manage your daily tasks.</p>
                </div>

                <button
                    type="button"
                    className="calendar-today-button"
                    onClick={goToToday}
                >
                    Today
                </button>
            </div>

            <div className="calendar-layout">

                <section className="calendar-card">

                    <div className="calendar-toolbar">
                        <h2>{monthName}</h2>

                        <div className="calendar-navigation">
                            <button
                                type="button"
                                onClick={goToPreviousMonth}
                                aria-label="Previous month"
                            >
                                &#8592;
                            </button>

                            <button
                                type="button"
                                onClick={goToNextMonth}
                                aria-label="Next month"
                            >
                                &#8594;
                            </button>
                        </div>
                    </div>

                    <div className="calendar-grid">

                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                            (day) => (
                                <div
                                    className="calendar-weekday"
                                    key={day}
                                >
                                    {day}
                                </div>
                            )
                        )}

                        {calendarDays.map((date, index) => {
                            if (!date) {
                                return (
                                    <div
                                        className="calendar-empty-day"
                                        key={`empty-${index}`}
                                    />
                                );
                            }

                            const dayTasks = tasks.filter(
                                (task) => task.taskDate === date.dateKey
                            );

                            const isToday =
                                date.dateKey === getDateKey(today);

                            const isSelected =
                                date.dateKey === selectedDate;

                            return (
                                <button
                                    type="button"
                                    key={date.dateKey}
                                    className={`calendar-day ${
                                        isToday ? "calendar-today" : ""
                                    } ${
                                        isSelected ? "calendar-selected" : ""
                                    }`}
                                    onClick={() =>
                                        setSelectedDate(date.dateKey)
                                    }
                                >
                                    <span className="calendar-day-number">
                                        {date.day}
                                    </span>

                                    <div className="calendar-task-indicators">
                                        {dayTasks.slice(0, 3).map((task) => (
                                            <span
                                                key={task.id}
                                                className={`calendar-task-dot ${
                                                    task.completed
                                                        ? "dot-completed"
                                                        : task.important
                                                            ? "dot-important"
                                                            : "dot-pending"
                                                }`}
                                            />
                                        ))}

                                        {dayTasks.length > 3 && (
                                            <span className="calendar-more">
                                                +{dayTasks.length - 3}
                                            </span>
                                        )}
                                    </div>

                                    {dayTasks.length > 0 && (
                                        <span className="calendar-task-count">
                                            {dayTasks.length} tasks
                                        </span>
                                    )}
                                </button>
                            );
                        })}

                    </div>

                    <div className="calendar-legend">
                        <span>
                            <i className="dot-pending" />
                            Pending
                        </span>

                        <span>
                            <i className="dot-completed" />
                            Completed
                        </span>

                        <span>
                            <i className="dot-important" />
                            Important
                        </span>
                    </div>

                </section>

                <section className="calendar-events-card">

                    <h2>Tasks for selected date</h2>

                    <p className="calendar-selected-date">
                        {formatSelectedDate()}
                    </p>

                    {selectedTasks.length === 0 ? (
                        <div className="calendar-no-events">
                            <p>No tasks scheduled for this date.</p>
                        </div>
                    ) : (
                        <div className="calendar-events-list">

                            {selectedTasks.map((task) => (
                                <article
                                    className="calendar-event"
                                    key={task.id}
                                    onClick={() => setSelectedTask(task)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelectedTask(task);
                                        }
                                    }}
                                >
                                    <h3>{task.title}</h3>

                                    {task.description && (
                                        <p>{task.description}</p>
                                    )}

                                    <div className="calendar-event-meta">
                                        <span>
                                            {task.startTime
                                                ? task.startTime.slice(0, 5)
                                                : "Time not set"}
                                        </span>

                                        <span
                                            className={
                                                task.completed
                                                    ? "event-completed"
                                                    : "event-pending"
                                            }
                                        >
                                            {task.completed
                                                ? "Completed"
                                                : "Pending"}
                                        </span>
                                    </div>

                                    {task.important && (
                                        <span className="calendar-important-label">
                                            ★ Important
                                        </span>
                                    )}
                                </article>
                            ))}

                        </div>
                    )}

                </section>

            </div>
            {/* Task Details Popup */}
            {selectedTask && (
                <div
                    className="task-details-overlay"
                    onClick={() => {
                        setSelectedTask(null);
                        setIsEditing(false);
                    }}
                >
                    <div
                        className="task-details-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="task-details-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="task-details-header">
                            <h2 id="task-details-title">
                                {isEditing ? "Edit Task" : "Task Details"}
                            </h2>

                            <button
                                type="button"
                                className="task-details-close"
                                onClick={() => {
                                    setSelectedTask(null);
                                    setIsEditing(false);
                                }}
                                aria-label="Close task details"
                            >
                                &times;
                            </button>
                        </div>

                        {isEditing ? (
                            <TaskForm
                                initialTask={selectedTask}
                                onTaskUpdated={async (taskId, taskPayload) => {
                                    if (!onTaskUpdated) {
                                        throw new Error(
                                            "Task update handler is unavailable."
                                        );
                                    }

                                    await onTaskUpdated(taskId, taskPayload);

                                    setSelectedTask(null);
                                    setIsEditing(false);
                                }}
                                onCancel={() => setIsEditing(false)}
                            />
                        ) : (
                            <>
                                <div className="task-details-content">

                                    <h3>{selectedTask.title}</h3>

                                    <div className="task-details-field">
                                        <label>Description</label>
                                        <p>
                                            {selectedTask.description ||
                                                "No description provided."}
                                        </p>
                                    </div>

                                    <div className="task-details-field">
                                        <label>Date</label>
                                        <p>{selectedTask.taskDate}</p>
                                    </div>

                                    <div className="task-details-field">
                                        <label>Start Time</label>
                                        <p>
                                            {selectedTask.startTime
                                                ? selectedTask.startTime.slice(0, 5)
                                                : "Not set"}
                                        </p>
                                    </div>

                                    <div className="task-details-field">
                                        <label>End Time</label>
                                        <p>
                                            {selectedTask.endTime
                                                ? selectedTask.endTime.slice(0, 5)
                                                : "Not set"}
                                        </p>
                                    </div>

                                    <div className="task-details-field">
                                        <label>Category</label>
                                        <p>{selectedTask.category || "Other"}</p>
                                    </div>

                                    <div className="task-details-field">
                                        <label>Status</label>
                                        <p>
                                            {selectedTask.completed
                                                ? "Completed"
                                                : "Pending"}
                                        </p>
                                    </div>

                                    <div className="task-details-field">
                                        <label>Priority</label>
                                        <p>
                                            {selectedTask.important
                                                ? "★ Important"
                                                : "Normal"}
                                        </p>
                                    </div>

                                </div>

                                <div className="task-details-footer">

                                    <button
                                        type="button"
                                        className="calendar-modal-action-button"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        className="calendar-modal-action-button"
                                        onClick={handleToggleSelectedTask}
                                    >
                                        {selectedTask.completed ? "Undo" : "Complete"}
                                    </button>

                                    <button
                                        type="button"
                                        className="calendar-modal-delete-button"
                                        onClick={handleDeleteSelectedTask}
                                    >
                                        Delete
                                    </button>

                                    <button
                                        type="button"
                                        className="calendar-modal-close-button"
                                        onClick={() => setSelectedTask(null)}
                                    >
                                        Close
                                    </button>

                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Calendar;
