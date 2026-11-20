
package com.focusboard.focusboardbackend.security;

import com.focusboard.focusboardbackend.entity.AppUser;
import com.focusboard.focusboardbackend.service.UserService;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class FirebaseAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log =
            LoggerFactory.getLogger(FirebaseAuthenticationFilter.class);

    private final FirebaseAuth firebaseAuth;
    private final UserService userService;

    public FirebaseAuthenticationFilter(
            FirebaseApp firebaseApp,
            UserService userService
    ) {
        this.firebaseAuth = FirebaseAuth.getInstance(firebaseApp);
        this.userService = userService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authorizationHeader =
                request.getHeader(HttpHeaders.AUTHORIZATION);

        String requestPath = request.getRequestURI();

        if (authorizationHeader == null ||
                !authorizationHeader.startsWith("Bearer ")) {

            log.warn("No Firebase Bearer token for {} {}",
                    request.getMethod(), requestPath);

            filterChain.doFilter(request, response);
            return;
        }

        String idToken = authorizationHeader.substring(7).trim();

        if (idToken.isEmpty()) {
            log.warn("Empty Firebase token for {}",
                    requestPath);

            response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Firebase ID token is missing"
            );
            return;
        }

        FirebaseToken decodedToken;

        // Step 1: Verify Firebase token
        try {

            decodedToken = firebaseAuth.verifyIdToken(idToken);

            log.info("Firebase token verified for {}",
                    requestPath);

        } catch (FirebaseAuthException exception) {

            log.error("Firebase token verification failed for {}: {}",
                    requestPath,
                    exception.getMessage());

            SecurityContextHolder.clearContext();

            response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Invalid or expired Firebase ID token"
            );
            return;
        }

        String firebaseUid = decodedToken.getUid();
        String email = decodedToken.getEmail();

        boolean emailVerified = Boolean.TRUE.equals(
                decodedToken.getClaims().get("email_verified")
        );

        // Step 2: Validate email
        if (email == null || email.isBlank() || !emailVerified) {

            log.warn("Firebase account rejected for {}: missing or unverified email",
                    requestPath);

            response.sendError(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "A verified email address is required"
            );
            return;
        }

        String displayName = decodedToken.getName();

        if (displayName == null || displayName.isBlank()) {
            displayName = email.split("@")[0];
        }

        AppUser appUser;

        // Step 3: Find or register application user
        try {

            appUser = userService.registerOrGetUser(
                    firebaseUid,
                    email,
                    displayName
            );

            log.info("Application user accepted. Role={}, Enabled={}",
                    appUser.getRole(),
                    appUser.isEnabled());

        } catch (IllegalStateException exception) {

            log.warn("Application user rejected for {}: {}",
                    requestPath,
                    exception.getMessage());

            SecurityContextHolder.clearContext();

            response.sendError(
                    HttpServletResponse.SC_FORBIDDEN,
                    exception.getMessage()
            );
            return;
        }

        // Step 4: Set Spring Security authentication
        String role = "ROLE_" + appUser.getRole().name();

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        appUser,
                        null,
                        List.of(new SimpleGrantedAuthority(role))
                );

        SecurityContextHolder.getContext()
                .setAuthentication(authentication);

        log.info("Spring Security authentication established. Role={}",
                role);

        // Step 5: Continue request without converting downstream
        // IllegalStateException exceptions into authentication 403 errors.
        filterChain.doFilter(request, response);

        log.info("Request completed: {} {} Status={}",
                request.getMethod(),
                requestPath,
                response.getStatus());
    }
}
