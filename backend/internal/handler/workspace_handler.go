package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/middleware"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/service"
)

type WorkspaceHandler struct {
	workspaceService *service.WorkspaceService
}

func NewWorkspaceHandler(workspaceService *service.WorkspaceService) *WorkspaceHandler {
	return &WorkspaceHandler{workspaceService: workspaceService}
}

func (h *WorkspaceHandler) Create(c *fiber.Ctx) error {
	var req models.CreateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("VALIDATION_ERROR", "Invalid request body"))
	}

	if req.Name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "name", Message: "Workspace name is required"},
		}))
	}

	userID := middleware.GetUserID(c)
	workspace, err := h.workspaceService.CreateWorkspace(c.Context(), userID, req.Name)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to create workspace"))
	}

	return c.Status(fiber.StatusCreated).JSON(models.NewAPIResponse(workspace.ToResponse("owner"), "Workspace created successfully"))
}

func (h *WorkspaceHandler) Update(c *fiber.Ctx) error {
	workspaceIDStr := c.Params("id")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("INVALID_ID", "Invalid workspace ID"))
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("VALIDATION_ERROR", "Invalid request body"))
	}

	if req.Name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "name", Message: "Workspace name is required"},
		}))
	}

	userID := middleware.GetUserID(c)
	workspace, err := h.workspaceService.UpdateWorkspace(c.Context(), userID, workspaceID, req.Name)
	if err != nil {
		if errStr := err.Error(); errStr == "FORBIDDEN" { // Assuming service returns this or we check struct
			return c.Status(fiber.StatusForbidden).JSON(models.NewErrorResponse("FORBIDDEN", "Only the owner can update the workspace"))
		}
		// Better error handling for custom errors would be ideal, but for now generic
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to update workspace"))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(workspace.ToResponse("owner"), "Workspace updated successfully"))
}

func (h *WorkspaceHandler) Join(c *fiber.Ctx) error {
	var req models.JoinWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("VALIDATION_ERROR", "Invalid request body"))
	}

	if req.InviteCode == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "invite_code", Message: "Invite code is required"},
		}))
	}

	userID := middleware.GetUserID(c)
	workspace, err := h.workspaceService.JoinWorkspace(c.Context(), userID, req.InviteCode)
	if err != nil {
		if err == service.ErrInviteCodeInvalid {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse("INVALID_CODE", "Invalid invite code"))
		}
		if err == service.ErrAlreadyMember {
			return c.Status(fiber.StatusConflict).JSON(models.NewErrorResponse("ALREADY_MEMBER", "You are already a member of this workspace"))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to join workspace"))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(workspace.ToResponse("member"), "Joined workspace successfully"))
}

func (h *WorkspaceHandler) List(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	workspaces, err := h.workspaceService.GetUserWorkspaces(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to list workspaces"))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(workspaces, ""))
}

func (h *WorkspaceHandler) GetMembers(c *fiber.Ctx) error {
	workspaceIDStr := c.Params("id")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("INVALID_ID", "Invalid workspace ID"))
	}

	// Verify access (User must be a member to see other members)
	userID := middleware.GetUserID(c)
	_, err = h.workspaceService.VerifyMemberAccess(c.Context(), workspaceID, userID)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(models.NewErrorResponse("FORBIDDEN", "You do not have access to this workspace"))
	}

	// For now, implementing simple member count logic or list logic could be added here
	// This endpoint was planned but ListByUserID is the primary one for now.
	// Returning not implemented or simple success for now to unblock.
	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(nil, "Member list coming soon"))
}
