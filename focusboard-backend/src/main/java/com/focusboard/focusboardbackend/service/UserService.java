
package com.focusboard.focusboardbackend.service;

import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.enums.UserRole;
import com.focusboard.focusboardbackend.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;

    @Value("${app.security.admin-email:}")
    private String adminEmail;

    // Register a new user or return an existing user
    public AppUser registerOrGetUser(
            String firebaseUid,
            String email,
            String name
    ) {

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);

        // Check whether this Firebase account already exists
        return userRepository.findByFirebaseUid(firebaseUid)
                .map(user -> {

                    if (!user.isEnabled()) {
                        throw new IllegalStateException(
                                "Your account has been disabled"
                        );
                    }

                    return user;
                })
                .orElseGet(() -> createNewUser(
                        firebaseUid,
                        normalizedEmail,
                        name
                ));
    }

    // Create a new application user
    private AppUser createNewUser(
            String firebaseUid,
            String email,
            String name
    ) {

        // Prevent duplicate email registration with another Firebase UID
        if (userRepository.existsByEmail(email)) {
            throw new IllegalStateException(
                    "An account with this email already exists"
            );
        }

        AppUser user = new AppUser();

        user.setFirebaseUid(firebaseUid);
        user.setEmail(email);
        user.setName(name);

        // Only the configured administrator email receives ADMIN
        if (!adminEmail.isBlank()
                && adminEmail.trim().equalsIgnoreCase(email)) {

            user.setRole(UserRole.ADMIN);

        } else {

            user.setRole(UserRole.USER);
        }

        user.setEnabled(true);

        return userRepository.save(user);
    }

    // Find an application user using Firebase UID
    @Transactional(readOnly = true)
    public AppUser getUserByFirebaseUid(String firebaseUid) {

        AppUser user = userRepository.findByFirebaseUid(firebaseUid)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "User not found"
                        )
                );

        if (!user.isEnabled()) {
            throw new IllegalStateException(
                    "Your account has been disabled"
            );
        }

        return user;
    }

    // Find a user by database ID
    @Transactional(readOnly = true)
    public AppUser getUserById(Long userId) {

        return userRepository.findById(userId)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "User not found with ID: " + userId
                        )
                );
    }
}
