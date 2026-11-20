package com.focusboard.focusboardbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record RecurringTaskRequest(

        @NotBlank(message = "Schedule type is required")
        String scheduleType,

        @NotBlank(message = "Task title is required")
        @Size(max = 150, message = "Title cannot exceed 150 characters")
        String title,

        String description,

        // Used for SINGLE schedule
        LocalDate taskDate,

        // Used for DAILY, WEEKDAYS and CUSTOM schedules
        LocalDate startDate,

        LocalDate endDate,

        LocalTime startTime,

        LocalTime endTime,

        boolean completed,

        boolean important,

        @Size(max = 50, message = "Category cannot exceed 50 characters")
        String category,

        // Used only for CUSTOM schedule
        List<DayOfWeek> selectedWeekdays

) {
}