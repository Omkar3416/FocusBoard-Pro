package com.focusboard.focusboardbackend.dto;

import com.focusboard.focusboardbackend.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AccountDeletionResponse {

    private Long id;
    private String name;
    private String email;
    private UserRole role;
    private boolean enabled;
    private LocalDateTime deletionRequestedAt;
    private LocalDateTime deletionScheduledAt;
}