
package com.focusboard.focusboardbackend.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record TaskResponse(

        Long id,

        String title,

        String description,

        LocalDate taskDate,

        LocalTime startTime,

        LocalTime endTime,

        boolean completed,

        boolean important,

        String category,

        Long userId,

        LocalDateTime createdAt,

        LocalDateTime updatedAt,

        // Recurrence information
        UUID recurrenceGroupId,

        String scheduleType,

        LocalDate scheduleStartDate,

        LocalDate scheduleEndDate,

        List<String> selectedWeekdays

) {
}
