package com.focusboard.focusboardbackend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
@Import(FirebaseTestConfig.class)
class FocusboardBackendApplicationTests {

    @Test
    void contextLoads() {
    }

}