package com.focusboard.focusboardbackend.controller;

import com.focusboard.focusboardbackend.dto.UserResponse;
import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.focusboard.focusboardbackend.dto.PromoteUserRequest;
import com.focusboard.focusboardbackend.dto.UpdateUserStatusRequest;
import com.focusboard.focusboardbackend.dto.AccountDeletionResponse;
import jakarta.validation.Valid;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // Get all registered users (OWNER and ADMIN only)
    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers(
            @AuthenticationPrincipal AppUser currentUser
    ) {

        List<UserResponse> users =
                userService.getAllUsers(currentUser);

        return ResponseEntity.ok(users);
    }
    // Promote a regular USER to ADMIN (OWNER and ADMIN only)
    @PostMapping("/promote")
    public ResponseEntity<UserResponse> promoteUserToAdmin(
            @AuthenticationPrincipal AppUser currentUser,
            @Valid @RequestBody PromoteUserRequest request
    ) {

        UserResponse updatedUser =
                userService.promoteUserToAdmin(
                        currentUser,
                        request.getUserId()
                );

        return ResponseEntity.ok(updatedUser);
    }

    // Enable or disable a USER or ADMIN account.
    @PatchMapping("/{userId}/status")
    public ResponseEntity<UserResponse> updateUserStatus(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserStatusRequest request
    ) {
        UserResponse updatedUser = userService.updateUserStatus(
                currentUser,
                userId,
                request.getEnabled()
        );

        return ResponseEntity.ok(updatedUser);
    }
    @PostMapping("/{userId}/deletion")
    public ResponseEntity<AccountDeletionResponse> requestAccountDeletion(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long userId
    ) {
        AccountDeletionResponse response =
                userService.requestAccountDeletion(currentUser, userId);

        return ResponseEntity.ok(response);
    }
    @DeleteMapping("/{userId}/deletion")
    public ResponseEntity<AccountDeletionResponse> cancelAccountDeletion(
            @AuthenticationPrincipal AppUser currentUser,
            @PathVariable Long userId
    ) {
        AccountDeletionResponse response =
                userService.cancelAccountDeletion(currentUser, userId);

        return ResponseEntity.ok(response);
    }
}