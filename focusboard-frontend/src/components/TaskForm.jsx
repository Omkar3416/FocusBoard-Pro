import { useEffect, useRef, useState } from "react";
import { createTask, createRecurringTasks } from "../api/api";
import "./TaskForm.css";

const WEEKDAYS = [
    { label: "Mon", value: "MONDAY" },
    { label: "Tue", value: "TUESDAY" },
    { label: "Wed", value: "WEDNESDAY" },
    { label: "Thu", value: "THURSDAY" },
    { label: "Fri", value: "FRIDAY" },
    { label: "Sat", value: "SATURDAY" },
    { label: "Sun", value: "SUNDAY" },
];

function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString) {
    if (!dateString) return null;

    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDateLabel(dateString) {
    if (!dateString) return "Select date";

    return parseLocalDate(dateString).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function getInitialFormData(task) {
    if (!task) {
        return {
            title: "",
            description: "",
            taskDate: getTodayDate(),
            startDate: getTodayDate(),
            endDate: getTodayDate(),
            startTime: "",
            endTime: "",
            completed: false,
            important: false,
            category: "Personal",
        };
    }

    return {
        title: task.title || "",
        description: task.description || "",
        taskDate: task.taskDate || getTodayDate(),
        startDate: task.taskDate || getTodayDate(),
        endDate: task.taskDate || getTodayDate(),
        startTime: task.startTime ? task.startTime.slice(0, 5) : "",
        endTime: task.endTime ? task.endTime.slice(0, 5) : "",
        completed: Boolean(task.completed),
        important: Boolean(task.important),
        category: task.category || "Personal",
    };
}

/* ---------------- CUSTOM DATE PICKER ---------------- */

function CalendarDatePicker({ label, value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [pickerView, setPickerView] = useState("days");

    const popupRef = useRef(null);

    const [visibleMonth, setVisibleMonth] = useState(() => {
        return value
            ? parseLocalDate(value)
            : parseLocalDate(getTodayDate());
    });

    // Close popup when clicking outside.
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (event) => {
            if (
                popupRef.current &&
                !popupRef.current.contains(event.target)
            ) {
                setIsOpen(false);
                setPickerView("days");
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener(
                "mousedown",
                handleOutsideClick
            );
        };
    }, [isOpen]);

    useEffect(() => {
        if (value) {
            setVisibleMonth(parseLocalDate(value));
        }
    }, [value]);

    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday-first calendar.
    const startingOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const calendarCells = [
        ...Array(startingOffset).fill(null),
        ...Array.from({ length: totalDays }, (_, index) => index + 1),
    ];

    const today = getTodayDate();

    // Open the calendar.
    const openPicker = () => {
        if (value) {
            setVisibleMonth(parseLocalDate(value));
        } else {
            setVisibleMonth(parseLocalDate(getTodayDate()));
        }

        setPickerView("days");
        setIsOpen(true);
    };

    const changeMonth = (amount) => {
        setVisibleMonth(
            new Date(year, month + amount, 1)
        );
    };

    // Select a year.
    const selectYear = (selectedYear) => {
        setVisibleMonth(
            new Date(selectedYear, month, 1)
        );

        setPickerView("months");
    };

    // Select a month.
    const selectMonth = (selectedMonth) => {
        setVisibleMonth(
            new Date(year, selectedMonth, 1)
        );

        setPickerView("days");
    };

    // Select a date.
    const selectDate = (dateString) => {
        onChange(dateString);
        setIsOpen(false);
        setPickerView("days");
    };

    const clearDate = () => {
        onChange("");
        setIsOpen(false);
        setPickerView("days");
    };

    const years = Array.from(
        { length: 131 },
        (_, index) => 1970 + index
    );

    const months = Array.from(
        { length: 12 },
        (_, index) => ({
            value: index,
            label: new Date(2000, index, 1).toLocaleDateString(
                "en-IN",
                { month: "long" }
            ),
        })
    );

    return (
        <div
            className="form-group custom-picker"
            ref={popupRef}
        >
            <label>{label}</label>

            <button
                type="button"
                className="date-picker-trigger"
                onClick={() =>
                    isOpen ? setIsOpen(false) : openPicker()
                }
                aria-expanded={isOpen}
            >
                <span>
                    {value ? formatDateLabel(value) : "Select date"}
                </span>

                <span aria-hidden="true">▦</span>
            </button>

            {isOpen && (
                <div className="calendar-popup">

                    {/* Calendar header */}
                    <div className="calendar-header">

                        {pickerView === "days" && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => changeMonth(-1)}
                                    aria-label="Previous month"
                                >
                                    ‹
                                </button>

                                <div className="calendar-header-selection">
                                    <button
                                        type="button"
                                        className="calendar-header-select"
                                        onClick={() =>
                                            setPickerView("months")
                                        }
                                    >
                                        {visibleMonth.toLocaleDateString(
                                            "en-IN",
                                            { month: "long" }
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        className="calendar-header-select"
                                        onClick={() =>
                                            setPickerView("years")
                                        }
                                    >
                                        {year}
                                        <span>▾</span>
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => changeMonth(1)}
                                    aria-label="Next month"
                                >
                                    ›
                                </button>
                            </>
                        )}

                        {pickerView !== "days" && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setPickerView("days")}
                                    aria-label="Back to calendar"
                                >
                                    ‹
                                </button>

                                <strong>
                                    {pickerView === "years"
                                        ? "Select Year"
                                        : "Select Month"}
                                </strong>

                                <button
                                    type="button"
                                    onClick={() => setPickerView("days")}
                                    aria-label="Close selection"
                                >
                                    ×
                                </button>
                            </>
                        )}

                    </div>

                    {/* Year selection */}
                    {pickerView === "years" && (
                        <div className="calendar-year-grid">
                            {years.map((itemYear) => (
                                <button
                                    type="button"
                                    key={itemYear}
                                    className={
                                        itemYear === year
                                            ? "calendar-option selected"
                                            : "calendar-option"
                                    }
                                    onClick={() =>
                                        selectYear(itemYear)
                                    }
                                >
                                    {itemYear}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Month selection */}
                    {pickerView === "months" && (
                        <div className="calendar-month-grid">
                            {months.map((itemMonth) => (
                                <button
                                    type="button"
                                    key={itemMonth.value}
                                    className={
                                        itemMonth.value === month
                                            ? "calendar-option selected"
                                            : "calendar-option"
                                    }
                                    onClick={() =>
                                        selectMonth(itemMonth.value)
                                    }
                                >
                                    {itemMonth.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Date selection */}
                    {pickerView === "days" && (
                        <>
                            <div className="calendar-grid">

                                {[
                                    "Mon",
                                    "Tue",
                                    "Wed",
                                    "Thu",
                                    "Fri",
                                    "Sat",
                                    "Sun",
                                ].map((day) => (
                                    <span
                                        className="calendar-weekday"
                                        key={day}
                                    >
                                        {day}
                                    </span>
                                ))}

                                {calendarCells.map((day, index) => {
                                    if (!day) {
                                        return (
                                            <span
                                                className="calendar-empty"
                                                key={`empty-${index}`}
                                            />
                                        );
                                    }

                                    const dateString = formatLocalDate(
                                        new Date(year, month, day)
                                    );

                                    const isSelected =
                                        value === dateString;

                                    const isToday =
                                        today === dateString;

                                    return (
                                        <button
                                            type="button"
                                            key={dateString}
                                            className={[
                                                "calendar-day",
                                                isSelected ? "selected" : "",
                                                isToday ? "today" : "",
                                            ]
                                                .filter(Boolean)
                                                .join(" ")}
                                            onClick={() =>
                                                selectDate(dateString)
                                            }
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="calendar-footer">
                                <button
                                    type="button"
                                    onClick={() =>
                                        selectDate(today)
                                    }
                                >
                                    Today
                                </button>

                                <button
                                    type="button"
                                    onClick={clearDate}
                                >
                                    Clear
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

/* ---------------- CUSTOM TIME PICKER ---------------- */

function to12HourTime(value) {
    if (!value) {
        return {
            hour: "9",
            minute: "00",
            period: "AM",
        };
    }

    const [hours, minutes] = value.split(":").map(Number);

    return {
        hour: String(hours % 12 || 12),
        minute: String(minutes).padStart(2, "0"),
        period: hours >= 12 ? "PM" : "AM",
    };
}

function to24HourTime(hour, minute, period) {
    let hours = Number(hour);

    if (period === "AM" && hours === 12) {
        hours = 0;
    } else if (period === "PM" && hours !== 12) {
        hours += 12;
    }

    return `${String(hours).padStart(2, "0")}:${minute}`;
}


function TimePicker({ label, value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState(() => to12HourTime(value));

    const popupRef = useRef(null);

    // Close time picker when clicking outside.
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (event) => {
            if (
                popupRef.current &&
                !popupRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener(
                "mousedown",
                handleOutsideClick
            );
        };
    }, [isOpen]);

    const openPicker = () => {
        setSelected(to12HourTime(value));
        setIsOpen((previous) => !previous);
    };

    const confirmTime = () => {
        onChange(
            to24HourTime(
                selected.hour,
                selected.minute,
                selected.period
            )
        );
        setIsOpen(false);
    };

    const clearTime = () => {
        onChange("");
        setIsOpen(false);
    };

    const displayTime = value
        ? (() => {
            const time = to12HourTime(value);
            return `${time.hour}:${time.minute} ${time.period}`;
        })()
        : "Select time";

    return (
        <div
            className="form-group custom-picker"
            ref={popupRef}
        >
            <label>{label}</label>

            <button
                type="button"
                className="date-picker-trigger"
                onClick={openPicker}
                aria-expanded={isOpen}
            >
                <span>{displayTime}</span>
                <span aria-hidden="true">◷</span>
            </button>

            {isOpen && (
                <div className="time-picker-popup">
                    <div className="time-picker-columns">
                        <div className="time-picker-column">
                            <span>Hour</span>

                            <div>
                                {Array.from(
                                    { length: 12 },
                                    (_, index) => String(index + 1)
                                ).map((hour) => (
                                    <button
                                        type="button"
                                        key={hour}
                                        className={
                                            selected.hour === hour
                                                ? "time-picker-option selected"
                                                : "time-picker-option"
                                        }
                                        onClick={() =>
                                            setSelected((previous) => ({
                                                ...previous,
                                                hour,
                                            }))
                                        }
                                    >
                                        {hour}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="time-picker-column">
                            <span>Minute</span>

                            <div>
                                {Array.from(
                                    { length: 60 },
                                    (_, index) =>
                                        String(index).padStart(2, "0")
                                ).map((minute) => (
                                    <button
                                        type="button"
                                        key={minute}
                                        className={
                                            selected.minute === minute
                                                ? "time-picker-option selected"
                                                : "time-picker-option"
                                        }
                                        onClick={() =>
                                            setSelected((previous) => ({
                                                ...previous,
                                                minute,
                                            }))
                                        }
                                    >
                                        {minute}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="time-picker-column">
                            <span>AM / PM</span>

                            <div>
                                {["AM", "PM"].map((period) => (
                                    <button
                                        type="button"
                                        key={period}
                                        className={
                                            selected.period === period
                                                ? "time-picker-option selected"
                                                : "time-picker-option"
                                        }
                                        onClick={() =>
                                            setSelected((previous) => ({
                                                ...previous,
                                                period,
                                            }))
                                        }
                                    >
                                        {period}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="time-picker-actions">
                        <button
                            type="button"
                            onClick={clearTime}
                        >
                            Clear
                        </button>

                        <button
                            type="button"
                            onClick={confirmTime}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


/* ---------------- MAIN TASK FORM ---------------- */

function TaskForm({
                      onTaskCreated,
                      initialTask = null,
                      onTaskUpdated,
                      onCancel,
                  }) {
    const isEditMode = Boolean(initialTask);

    const [formData, setFormData] = useState(
        () => getInitialFormData(initialTask)
    );

    const [scheduleType, setScheduleType] = useState("SINGLE");
    const [selectedWeekdays, setSelectedWeekdays] = useState([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
    ]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        setFormData(getInitialFormData(initialTask));
        setError("");
        setSuccess("");
    }, [initialTask]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        setFormData((previousData) => ({
            ...previousData,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const updateFormField = (name, value) => {
        setFormData((previousData) => ({
            ...previousData,
            [name]: value,
        }));
    };

    const toggleWeekday = (weekday) => {
        setSelectedWeekdays((previous) =>
            previous.includes(weekday)
                ? previous.filter((day) => day !== weekday)
                : [...previous, weekday]
        );
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError("");
        setSuccess("");

        if (!formData.title.trim()) {
            setError("Task title is required.");
            return;
        }

        if (
            formData.startTime &&
            formData.endTime &&
            formData.endTime <= formData.startTime
        ) {
            setError("End time must be later than start time.");
            return;
        }

        if (isEditMode && !formData.taskDate) {
            setError("Please select a task date.");
            return;
        }

        if (!isEditMode && scheduleType === "SINGLE" && !formData.taskDate) {
            setError("Please select a task date.");
            return;
        }

        if (!isEditMode && scheduleType !== "SINGLE") {
            if (!formData.startDate || !formData.endDate) {
                setError("Please select both start and end dates.");
                return;
            }

            if (formData.endDate < formData.startDate) {
                setError("End date cannot be before start date.");
                return;
            }
        }

        if (
            !isEditMode &&
            scheduleType === "CUSTOM" &&
            selectedWeekdays.length === 0
        ) {
            setError("Please select at least one weekday.");
            return;
        }

        const commonPayload = {
            title: formData.title.trim(),
            description: formData.description,
            startTime: formData.startTime || null,
            endTime: formData.endTime || null,
            completed: formData.completed,
            important: formData.important,
            category: formData.category,
        };

        try {
            setLoading(true);

            if (isEditMode) {
                if (!onTaskUpdated) {
                    throw new Error("Task update handler is unavailable.");
                }

                await onTaskUpdated(initialTask.id, {
                    ...commonPayload,
                    taskDate: formData.taskDate,
                });

                setSuccess("Task updated successfully!");
            } else if (scheduleType === "SINGLE") {
                const savedTask = await createTask({
                    ...commonPayload,
                    taskDate: formData.taskDate,
                });

                if (onTaskCreated) {
                    onTaskCreated(savedTask);
                }

                setFormData(getInitialFormData(null));
                setSuccess("Task created successfully!");
            } else {
                const savedTasks = await createRecurringTasks({
                    ...commonPayload,
                    scheduleType,
                    taskDate: null,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    selectedWeekdays:
                        scheduleType === "CUSTOM"
                            ? selectedWeekdays
                            : [],
                });

                if (onTaskCreated) {
                    savedTasks.forEach((task) => onTaskCreated(task));
                }

                setFormData(getInitialFormData(null));
                setScheduleType("SINGLE");

                setSuccess(
                    `Created ${savedTasks.length} tasks successfully!`
                );
            }
        } catch (saveError) {
            console.error("Task save error:", saveError);
            setError(saveError.message || "Unable to save task.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="task-form-section">
            <div className="task-form-heading">
                <div>
                    <h2>
                        {isEditMode ? "Edit Task" : "Create New Task"}
                    </h2>

                    <p>
                        {isEditMode
                            ? "Update your task details."
                            : "Plan your work and stay productive."}
                    </p>
                </div>
            </div>

            <form className="task-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="title">Task Title *</label>

                    <input
                        id="title"
                        name="title"
                        type="text"
                        placeholder="Enter your task title"
                        value={formData.title}
                        onChange={handleChange}
                        maxLength={150}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">Description</label>

                    <textarea
                        id="description"
                        name="description"
                        placeholder="Describe your task..."
                        value={formData.description}
                        onChange={handleChange}
                        rows={3}
                    />
                </div>

                {!isEditMode && (
                    <div className="form-group">
                        <label htmlFor="scheduleType">Schedule</label>

                        <select
                            id="scheduleType"
                            value={scheduleType}
                            onChange={(event) =>
                                setScheduleType(event.target.value)
                            }
                        >
                            <option value="SINGLE">Single task</option>
                            <option value="DAILY">Every day</option>
                            <option value="WEEKDAYS">Weekdays (Mon–Fri)</option>
                            <option value="CUSTOM">Custom weekdays</option>
                        </select>
                    </div>
                )}

                {isEditMode || scheduleType === "SINGLE" ? (
                    <div className="form-row">
                        <CalendarDatePicker
                            label="Task Date *"
                            value={formData.taskDate}
                            onChange={(value) =>
                                updateFormField("taskDate", value)
                            }
                        />

                        <div className="form-group">
                            <label htmlFor="category">Category</label>

                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                            >
                                <option value="Personal">Personal</option>
                                <option value="Work">Work</option>
                                <option value="Study">Study</option>
                                <option value="Health">Health</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="date-range-row">
                            <CalendarDatePicker
                                label="Start Date *"
                                value={formData.startDate}
                                onChange={(value) =>
                                    updateFormField("startDate", value)
                                }
                            />

                            <CalendarDatePicker
                                label="End Date *"
                                value={formData.endDate}
                                onChange={(value) =>
                                    updateFormField("endDate", value)
                                }
                            />
                        </div>

                        {scheduleType === "CUSTOM" && (
                            <div className="form-group">
                                <label>Select Weekdays *</label>

                                <div className="weekday-selector">
                                    {WEEKDAYS.map((weekday) => (
                                        <button
                                            type="button"
                                            key={weekday.value}
                                            className={
                                                selectedWeekdays.includes(
                                                    weekday.value
                                                )
                                                    ? "weekday-chip selected"
                                                    : "weekday-chip"
                                            }
                                            onClick={() =>
                                                toggleWeekday(weekday.value)
                                            }
                                        >
                                            {weekday.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="category">Category</label>

                            <select
                                id="category"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                            >
                                <option value="Personal">Personal</option>
                                <option value="Work">Work</option>
                                <option value="Study">Study</option>
                                <option value="Health">Health</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </>
                )}

                <div className="form-row">
                    <TimePicker
                        label="Start Time"
                        value={formData.startTime}
                        onChange={(value) =>
                            updateFormField("startTime", value)
                        }
                    />

                    <TimePicker
                        label="End Time"
                        value={formData.endTime}
                        onChange={(value) =>
                            updateFormField("endTime", value)
                        }
                    />
                </div>

                <label className="important-checkbox">
                    <input
                        type="checkbox"
                        name="important"
                        checked={formData.important}
                        onChange={handleChange}
                    />
                    <span>Mark as important</span>
                </label>

                {error && <p className="form-error">{error}</p>}
                {success && <p className="form-success">{success}</p>}

                <div className="task-form-actions">
                    <button
                        className="create-task-button"
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Saving..."
                            : isEditMode
                                ? "Save Changes"
                                : "Create Task"}
                    </button>

                    {isEditMode && (
                        <button
                            type="button"
                            className="task-form-cancel-button"
                            onClick={onCancel}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </section>
    );
}

export default TaskForm;