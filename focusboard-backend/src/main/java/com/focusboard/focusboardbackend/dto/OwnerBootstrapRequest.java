package com.focusboard.focusboardbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OwnerBootstrapRequest {

    @NotBlank(message = "Bootstrap secret is required")
    @Size(max = 200, message = "Invalid bootstrap secret")
    private String secret;
}