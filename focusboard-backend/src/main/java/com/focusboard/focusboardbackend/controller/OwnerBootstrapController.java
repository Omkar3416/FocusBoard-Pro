package com.focusboard.focusboardbackend.controller;

import com.focusboard.focusboardbackend.dto.OwnerBootstrapRequest;
import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.service.OwnerBootstrapService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/owner")
@RequiredArgsConstructor
public class OwnerBootstrapController {

    private final OwnerBootstrapService ownerBootstrapService;

    // Perform one-time initial OWNER provisioning
    @PostMapping("/bootstrap")
    public ResponseEntity<Void> bootstrapOwner(
            @AuthenticationPrincipal AppUser currentUser,
            @Valid @RequestBody OwnerBootstrapRequest request
    ) {

        ownerBootstrapService.bootstrapOwner(
                currentUser,
                request.getSecret()
        );

        return ResponseEntity.noContent().build();
    }
}