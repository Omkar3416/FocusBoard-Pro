
package com.focusboard.focusboardbackend.service;

import com.focusboard.focusboardbackend.dto.RecurringTaskRequest;
import com.focusboard.focusboardbackend.dto.TaskRequest;
import com.focusboard.focusboardbackend.dto.TaskResponse;
import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.entity.Task;
import com.focusboard.focusboardbackend.repository.TaskRepository;
import com.focusboard.focusboardbackend.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;
import com.focusboard.focusboardbackend.dto.TaskDeletionResponse;
import java.time.LocalDateTime;
import com.focusboard.focusboardbackend.dto.OldTasksDeletionPreviewResponse;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    // Create a single task
    public TaskResponse createTask(Long userId, TaskRequest request) {

        AppUser user = getUserById(userId);

        Task task = new Task();

        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setTaskDate(request.taskDate());
        task.setStartTime(request.startTime());
        task.setEndTime(request.endTime());
        task.setCompleted(request.completed());
        task.setImportant(request.important());
        task.setCategory(request.category());
        task.setUser(user);

        task.setScheduleType("SINGLE");

        Task savedTask = taskRepository.save(task);

        return mapToResponse(savedTask);
    }

    // Create multiple independent tasks using a recurrence schedule
    public List<TaskResponse> createRecurringTasks(
            Long userId,
            RecurringTaskRequest request
    ) {

        AppUser user = getUserById(userId);

        String scheduleType = request.scheduleType()
                .trim()
                .toUpperCase(Locale.ROOT);

        List<LocalDate> taskDates = new ArrayList<>();

        LocalDate scheduleStartDate = null;
        LocalDate scheduleEndDate = null;

        List<DayOfWeek> selectedWeekdays =
                request.selectedWeekdays() == null
                        ? List.of()
                        : request.selectedWeekdays();

        if ("SINGLE".equals(scheduleType)) {

            if (request.taskDate() == null) {
                throw new IllegalArgumentException(
                        "Task date is required for SINGLE schedule"
                );
            }

            taskDates.add(request.taskDate());

            scheduleStartDate = request.taskDate();
            scheduleEndDate = request.taskDate();

        } else {

            scheduleStartDate = request.startDate();
            scheduleEndDate = request.endDate();

            if (scheduleStartDate == null || scheduleEndDate == null) {
                throw new IllegalArgumentException(
                        "Start date and end date are required"
                );
            }

            if (scheduleEndDate.isBefore(scheduleStartDate)) {
                throw new IllegalArgumentException(
                        "End date cannot be before start date"
                );
            }

            if ("CUSTOM".equals(scheduleType)) {

                if (selectedWeekdays.isEmpty()) {
                    throw new IllegalArgumentException(
                            "Select at least one weekday for CUSTOM schedule"
                    );
                }

            } else if (!"DAILY".equals(scheduleType)
                    && !"WEEKDAYS".equals(scheduleType)) {

                throw new IllegalArgumentException(
                        "Invalid schedule type: " + scheduleType
                );
            }

            for (LocalDate date = scheduleStartDate;
                 !date.isAfter(scheduleEndDate);
                 date = date.plusDays(1)) {

                DayOfWeek day = date.getDayOfWeek();

                boolean shouldCreate;

                switch (scheduleType) {

                    case "DAILY" -> shouldCreate = true;

                    case "WEEKDAYS" -> shouldCreate =
                            day != DayOfWeek.SATURDAY
                                    && day != DayOfWeek.SUNDAY;

                    case "CUSTOM" -> shouldCreate =
                            selectedWeekdays.contains(day);

                    default -> shouldCreate = false;
                }

                if (shouldCreate) {
                    taskDates.add(date);
                }
            }
        }

        if (taskDates.isEmpty()) {
            throw new IllegalArgumentException(
                    "No task dates were generated for this schedule"
            );
        }

        // One UUID identifies all occurrences in this schedule.
        // SINGLE tasks do not need a recurrence group.
        UUID recurrenceGroupId = "SINGLE".equals(scheduleType)
                ? null
                : UUID.randomUUID();

        String weekdaysValue = "CUSTOM".equals(scheduleType)
                ? selectedWeekdays.stream()
                .map(DayOfWeek::name)
                .collect(Collectors.joining(","))
                : null;

        List<Task> tasks = new ArrayList<>();

        for (LocalDate date : taskDates) {

            Task task = new Task();

            task.setTitle(request.title());
            task.setDescription(request.description());
            task.setTaskDate(date);
            task.setStartTime(request.startTime());
            task.setEndTime(request.endTime());
            task.setCompleted(request.completed());
            task.setImportant(request.important());
            task.setCategory(request.category());
            task.setUser(user);

            // Recurrence metadata
            task.setRecurrenceGroupId(recurrenceGroupId);
            task.setScheduleType(scheduleType);
            task.setScheduleStartDate(scheduleStartDate);
            task.setScheduleEndDate(scheduleEndDate);
            task.setSelectedWeekdays(weekdaysValue);

            tasks.add(task);
        }

        return taskRepository.saveAll(tasks)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // Get all tasks belonging to a user
    @Transactional(readOnly = true)
    public List<TaskResponse> getAllTasks(Long userId) {

        return taskRepository
                .findAllByUser_IdOrderByTaskDateAscStartTimeAsc(userId)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // Get tasks for a particular date
    @Transactional(readOnly = true)
    public List<TaskResponse> getTasksByDate(
            Long userId,
            LocalDate taskDate
    ) {

        return taskRepository
                .findAllByUser_IdAndTaskDateOrderByStartTimeAsc(
                        userId,
                        taskDate
                )
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    // Get one task belonging to a user
    @Transactional(readOnly = true)
    public TaskResponse getTaskById(Long taskId, Long userId) {

        Task task = getTaskByIdAndUser(taskId, userId);

        return mapToResponse(task);
    }

    // Update an existing task
    public TaskResponse updateTask(
            Long taskId,
            Long userId,
            TaskRequest request
    ) {

        Task task = getTaskByIdAndUser(taskId, userId);

        task.setTitle(request.title());
        task.setDescription(request.description());
        task.setTaskDate(request.taskDate());
        task.setStartTime(request.startTime());
        task.setEndTime(request.endTime());
        task.setCompleted(request.completed());
        task.setImportant(request.important());
        task.setCategory(request.category());

        Task updatedTask = taskRepository.save(task);

        return mapToResponse(updatedTask);
    }


    // Temporarily delete only the selected task occurrence
    public TaskDeletionResponse deleteTask(Long taskId, Long userId) {

        Task task = getTaskByIdAndUser(taskId, userId);

        return temporarilyDeleteTasks(List.of(task));
    }

    // Temporarily delete all active occurrences in a recurring series
    public TaskDeletionResponse deleteTaskSeries(
            Long taskId,
            Long userId
    ) {

        Task task = getTaskByIdAndUser(taskId, userId);

        if (task.getRecurrenceGroupId() == null) {
            return temporarilyDeleteTasks(List.of(task));
        }

        List<Task> seriesTasks =
                taskRepository
                        .findAllByRecurrenceGroupIdAndUser_IdAndDeletedAtIsNull(
                                task.getRecurrenceGroupId(),
                                userId
                        );

        if (seriesTasks.isEmpty()) {
            throw new EntityNotFoundException("No active tasks found in this series");
        }

        return temporarilyDeleteTasks(seriesTasks);
    }

    // Preview active tasks older than five days before deletion.
    @Transactional(readOnly = true)
    public OldTasksDeletionPreviewResponse previewOldTasksDeletion(
            Long userId
    ) {

        LocalDate cutoffDate = LocalDate.now(
                ZoneId.of("Asia/Kolkata")
        ).minusDays(5);

        List<Task> oldTasks =
                taskRepository.findAllActiveTasksOlderThan(
                        userId,
                        cutoffDate
                );

        if (oldTasks.isEmpty()) {
            return new OldTasksDeletionPreviewResponse(
                    cutoffDate,
                    0,
                    null,
                    null
            );
        }

        LocalDate oldestTaskDate = oldTasks.get(0).getTaskDate();

        LocalDate newestTaskDate =
                oldTasks.get(oldTasks.size() - 1).getTaskDate();

        return new OldTasksDeletionPreviewResponse(
                cutoffDate,
                oldTasks.size(),
                oldestTaskDate,
                newestTaskDate
        );
    }


    // Temporarily delete all active tasks older than five days.
    public TaskDeletionResponse deleteOldTasks(Long userId) {

        LocalDate cutoffDate = LocalDate.now(
                ZoneId.of("Asia/Kolkata")
        ).minusDays(5);

        List<Task> oldTasks =
                taskRepository.findAllActiveTasksOlderThan(
                        userId,
                        cutoffDate
                );

        if (oldTasks.isEmpty()) {
            throw new IllegalStateException(
                    "No eligible old tasks found for deletion"
            );
        }

        return temporarilyDeleteTasks(oldTasks);
    }

    // Apply one deletion batch to the selected tasks
    private TaskDeletionResponse temporarilyDeleteTasks(
            List<Task> tasks
    ) {

        LocalDateTime deletedAt = LocalDateTime.now();
        LocalDateTime expiresAt = deletedAt.plusMinutes(5);
        UUID batchId = UUID.randomUUID();

        for (Task task : tasks) {
            task.setDeletedAt(deletedAt);
            task.setDeletionBatchId(batchId);
        }

        taskRepository.saveAll(tasks);

        return new TaskDeletionResponse(
                batchId,
                tasks.size(),
                expiresAt
        );
    }

    // Restore tasks from a deletion batch within five minutes
    public int undoDeletion(UUID batchId, Long userId) {

        List<Task> deletedTasks =
                taskRepository
                        .findAllByDeletionBatchIdAndUser_IdAndDeletedAtIsNotNull(
                                batchId,
                                userId
                        );

        if (deletedTasks.isEmpty()) {
            throw new EntityNotFoundException(
                    "Deletion batch not found or already permanently deleted"
            );
        }

        LocalDateTime expiresAt =
                deletedTasks.get(0).getDeletedAt().plusMinutes(5);

        if (!LocalDateTime.now().isBefore(expiresAt)) {
            throw new IllegalStateException(
                    "The five-minute undo period has expired"
            );
        }

        for (Task task : deletedTasks) {
            task.setDeletedAt(null);
            task.setDeletionBatchId(null);
        }

        taskRepository.saveAll(deletedTasks);

        return deletedTasks.size();
    }


    private AppUser getUserById(Long userId) {

        return userRepository.findById(userId)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "User not found with ID: " + userId
                        )
                );
    }

    private Task getTaskByIdAndUser(Long taskId, Long userId) {

        return taskRepository.findByIdAndUser_Id(taskId, userId)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "Task not found with ID: " + taskId
                        )
                );
    }

    // Convert database entity into API response
    private TaskResponse mapToResponse(Task task) {

        List<String> weekdays = task.getSelectedWeekdays() == null
                || task.getSelectedWeekdays().isBlank()
                ? List.of()
                : Arrays.asList(
                task.getSelectedWeekdays().split(",")
        );

        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getTaskDate(),
                task.getStartTime(),
                task.getEndTime(),
                task.isCompleted(),
                task.isImportant(),
                task.getCategory(),
                task.getUser().getId(),
                task.getCreatedAt(),
                task.getUpdatedAt(),

                task.getRecurrenceGroupId(),
                task.getScheduleType(),
                task.getScheduleStartDate(),
                task.getScheduleEndDate(),
                weekdays
        );
    }
}
