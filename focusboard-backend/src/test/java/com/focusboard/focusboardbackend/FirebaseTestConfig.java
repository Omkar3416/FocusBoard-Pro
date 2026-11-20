package com.focusboard.focusboardbackend;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import java.time.Instant;
import java.util.Date;

@TestConfiguration
public class FirebaseTestConfig {

    @Bean(destroyMethod = "delete")
    public FirebaseApp firebaseApp() {

        AccessToken testAccessToken = new AccessToken(
                "test-access-token",
                Date.from(Instant.now().plusSeconds(3600))
        );

        GoogleCredentials testCredentials =
                GoogleCredentials.create(testAccessToken);

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(testCredentials)
                .setProjectId("focusboard-test")
                .build();

        return FirebaseApp.initializeApp(
                options,
                "focusboard-test"
        );
    }
}