
package com.focusboard.focusboardbackend.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record TaskDeletionResponse(
        UUID batchId,
        int deletedCount,
        LocalDateTime expiresAt
) {
}
