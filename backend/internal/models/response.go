package models

// APIResponse is the standard response wrapper
type APIResponse struct {
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
	Meta    *Meta       `json:"meta,omitempty"`
}

// Meta contains pagination information
type Meta struct {
	CurrentPage int   `json:"current_page"`
	PerPage     int   `json:"per_page"`
	TotalPages  int   `json:"total_pages"`
	TotalCount  int64 `json:"total_count"`
}

// ErrorResponse is the standard error response
type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// ErrorDetail contains error information
type ErrorDetail struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details []ValidationError `json:"details,omitempty"`
}

// ValidationError contains field-level validation errors
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// NewAPIResponse creates a new API response
func NewAPIResponse(data interface{}, message string) *APIResponse {
	return &APIResponse{
		Data:    data,
		Message: message,
	}
}

// NewPaginatedResponse creates a paginated API response
func NewPaginatedResponse(data interface{}, page, perPage int, totalCount int64) *APIResponse {
	totalPages := int(totalCount) / perPage
	if int(totalCount)%perPage > 0 {
		totalPages++
	}

	return &APIResponse{
		Data: data,
		Meta: &Meta{
			CurrentPage: page,
			PerPage:     perPage,
			TotalPages:  totalPages,
			TotalCount:  totalCount,
		},
	}
}

// NewErrorResponse creates a new error response
func NewErrorResponse(code, message string) *ErrorResponse {
	return &ErrorResponse{
		Error: ErrorDetail{
			Code:    code,
			Message: message,
		},
	}
}

// NewValidationErrorResponse creates a validation error response
func NewValidationErrorResponse(details []ValidationError) *ErrorResponse {
	return &ErrorResponse{
		Error: ErrorDetail{
			Code:    "VALIDATION_ERROR",
			Message: "Validation failed",
			Details: details,
		},
	}
}
