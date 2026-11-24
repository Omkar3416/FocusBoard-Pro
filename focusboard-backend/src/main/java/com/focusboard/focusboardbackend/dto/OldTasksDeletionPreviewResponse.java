package com.focusboard.focusboardbackend.dto;

import java.time.LocalDate;

public record OldTasksDeletionPreviewResponse(

        LocalDate cutoffDate,

        int taskCount,

        LocalDate oldestTaskDate,

        LocalDate newestTaskDate

) {
}