#!/bin/bash
# =============================================================================
# NEXT PDF - Automated API Testing Script (Bash)
# =============================================================================
# Tests all API endpoints documented in docs/api.md
# 
# Usage: ./api-test.sh [BASE_URL]
# Example: ./api-test.sh http://localhost:3000/api/v1
# =============================================================================

set -e

# Configuration
BASE_URL="${1:-http://localhost:8080/api/v1}"
ACCESS_TOKEN=""
REFRESH_TOKEN_COOKIE=""
USER_ID=""
FOLDER_ID=""
FILE_ID=""
UPLOAD_ID=""
SESSION_ID=""
AVATAR_UPLOAD_ID=""

# Test user credentials
TEST_EMAIL="test-$(date +%s)@example.com"
TEST_PASSWORD="testpassword123"
TEST_FULLNAME="Test User"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BLUE}=============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=============================================================================${NC}"
}

print_test() {
    echo ""
    echo -e "${CYAN}-----------------------------------------------------------------------------${NC}"
    echo -e "${CYAN}TEST: $1${NC}"
    echo -e "${CYAN}-----------------------------------------------------------------------------${NC}"
}

print_info() {
    echo -e "${YELLOW}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ PASSED: $1${NC}"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

print_failure() {
    echo -e "${RED}✗ FAILED: $1${NC}"
    echo -e "${RED}  Expected: $2${NC}"
    echo -e "${RED}  Got: $3${NC}"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

pretty_json() {
    echo "$1" | python3 -m json.tool 2>/dev/null || echo "$1"
}

# Make HTTP request
# Usage: make_request METHOD ENDPOINT [DATA] [AUTH] [CONTENT_TYPE]
make_request() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local auth="${4:-none}"
    local content_type="${5:-application/json}"
    
    local url="${BASE_URL}${endpoint}"
    local headers=(-H "Content-Type: $content_type")
    
    echo -e "${YELLOW}Request:${NC}"
    echo "  Method: $method"
    echo "  URL: $url"
    
    if [ "$auth" = "auth" ] && [ -n "$ACCESS_TOKEN" ]; then
        headers+=(-H "Authorization: Bearer $ACCESS_TOKEN")
        echo "  Auth: Bearer Token"
    fi
    
    if [ -n "$REFRESH_TOKEN_COOKIE" ]; then
        headers+=(-b "refresh_token=$REFRESH_TOKEN_COOKIE")
    fi
    
    if [ -n "$data" ]; then
        echo "  Body:"
        pretty_json "$data" | sed 's/^/    /'
    fi
    
    local response
    local http_code
    
    case "$method" in
        GET)
            response=$(curl -s -w "\n%{http_code}" -X GET "$url" "${headers[@]}" -c -)
            ;;
        POST)
            if [ -n "$data" ]; then
                response=$(curl -s -w "\n%{http_code}" -X POST "$url" "${headers[@]}" -d "$data" -c -)
            else
                response=$(curl -s -w "\n%{http_code}" -X POST "$url" "${headers[@]}" -c -)
            fi
            ;;
        PUT)
            response=$(curl -s -w "\n%{http_code}" -X PUT "$url" "${headers[@]}" -d "$data" -c -)
            ;;
        PATCH)
            response=$(curl -s -w "\n%{http_code}" -X PATCH "$url" "${headers[@]}" -d "$data" -c -)
            ;;
        DELETE)
            response=$(curl -s -w "\n%{http_code}" -X DELETE "$url" "${headers[@]}" -c -)
            ;;
    esac
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d' | grep -v "^#" | head -n -1 || echo "$response" | sed '$d')
    
    # Extract refresh token from cookie if present
    local new_cookie=$(echo "$response" | grep "refresh_token" | awk '{print $7}' | head -1)
    if [ -n "$new_cookie" ]; then
        REFRESH_TOKEN_COOKIE="$new_cookie"
    fi
    
    echo ""
    echo -e "${YELLOW}Response:${NC}"
    echo "  Status Code: $http_code"
    echo "  Body:"
    pretty_json "$body" | sed 's/^/    /'
    
    LAST_HTTP_CODE="$http_code"
    LAST_RESPONSE="$body"
}

check_status() {
    local expected="$1"
    local test_name="$2"
    
    if [ "$LAST_HTTP_CODE" = "$expected" ]; then
        print_success "$test_name (HTTP $expected)"
        return 0
    else
        print_failure "$test_name" "HTTP $expected" "HTTP $LAST_HTTP_CODE"
        return 1
    fi
}

extract_json() {
    echo "$1" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data$2)" 2>/dev/null || echo ""
}

# =============================================================================
# 1. AUTHENTICATION TESTS
# =============================================================================

test_auth() {
    print_header "1. AUTHENTICATION TESTS"
    
    # -------------------------------------------------------------------------
    # POST /auth/register - Register new user
    # -------------------------------------------------------------------------
    print_test "POST /auth/register - Register new user"
    print_info "Description: Creates a new user account"
    print_info "Authentication: None"
    print_info "Request Body: email, password, full_name"
    
    make_request "POST" "/auth/register" "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\",
        \"full_name\": \"$TEST_FULLNAME\"
    }"
    check_status "201" "Register new user"
    USER_ID=$(extract_json "$LAST_RESPONSE" "['data']['id']")
    
    # Error: Email already exists (409)
    print_test "POST /auth/register - Error: Email already exists"
    print_info "Description: Attempt to register with existing email"
    print_info "Expected: 409 Conflict with EMAIL_EXISTS error"
    
    make_request "POST" "/auth/register" "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\",
        \"full_name\": \"$TEST_FULLNAME\"
    }"
    check_status "409" "Email already exists error"
    
    # Error: Validation failed (422)
    print_test "POST /auth/register - Error: Validation failed"
    print_info "Description: Invalid email format and short password"
    print_info "Expected: 422 Unprocessable Entity with VALIDATION_ERROR"
    
    make_request "POST" "/auth/register" "{
        \"email\": \"invalid-email\",
        \"password\": \"short\",
        \"full_name\": \"\"
    }"
    check_status "422" "Validation error"
    
    # -------------------------------------------------------------------------
    # POST /auth/login - Login
    # -------------------------------------------------------------------------
    print_test "POST /auth/login - Authenticate user"
    print_info "Description: Login with email and password, returns access token"
    print_info "Authentication: None"
    print_info "Request Body: email, password"
    print_info "Response: access_token, token_type, expires_in, user object"
    print_info "Sets HttpOnly cookie: refresh_token"
    
    make_request "POST" "/auth/login" "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }"
    check_status "200" "Login successful"
    ACCESS_TOKEN=$(extract_json "$LAST_RESPONSE" "['data']['access_token']")
    
    # Error: Invalid credentials (401)
    print_test "POST /auth/login - Error: Invalid credentials"
    print_info "Description: Wrong password"
    print_info "Expected: 401 Unauthorized with INVALID_CREDENTIALS"
    
    make_request "POST" "/auth/login" "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"wrongpassword\"
    }"
    check_status "401" "Invalid credentials error"
    
    # -------------------------------------------------------------------------
    # POST /auth/refresh - Refresh token
    # -------------------------------------------------------------------------
    print_test "POST /auth/refresh - Refresh access token"
    print_info "Description: Get new access token using refresh token cookie"
    print_info "Authentication: None (uses HttpOnly cookie)"
    print_info "Response: New access_token with token rotation"
    
    make_request "POST" "/auth/refresh"
    check_status "200" "Token refresh"
    ACCESS_TOKEN=$(extract_json "$LAST_RESPONSE" "['data']['access_token']")
    
    # -------------------------------------------------------------------------
    # GET /auth/sessions - List sessions
    # -------------------------------------------------------------------------
    print_test "GET /auth/sessions - List active sessions"
    print_info "Description: Returns all active sessions for current user"
    print_info "Authentication: Required (Bearer token)"
    print_info "Response: Array of sessions with device_info, ip_address, is_current"
    
    make_request "GET" "/auth/sessions" "" "auth"
    check_status "200" "List sessions"
    SESSION_ID=$(extract_json "$LAST_RESPONSE" "['data'][0]['id']")
}

# =============================================================================
# 2. USER TESTS
# =============================================================================

test_users() {
    print_header "2. USER TESTS"
    
    # -------------------------------------------------------------------------
    # GET /me - Get current user profile
    # -------------------------------------------------------------------------
    print_test "GET /me - Get current user profile"
    print_info "Description: Returns authenticated user's profile information"
    print_info "Authentication: Required (Bearer token)"
    print_info "Response: id, email, full_name, avatar_url, is_active, timestamps"
    
    make_request "GET" "/me" "" "auth"
    check_status "200" "Get user profile"
    
    # Error: Unauthorized (401)
    print_test "GET /me - Error: Unauthorized"
    print_info "Description: Request without valid token"
    print_info "Expected: 401 Unauthorized"
    
    local saved_token="$ACCESS_TOKEN"
    ACCESS_TOKEN="invalid_token"
    make_request "GET" "/me" "" "auth"
    check_status "401" "Unauthorized error"
    ACCESS_TOKEN="$saved_token"
    
    # -------------------------------------------------------------------------
    # PATCH /me - Update profile
    # -------------------------------------------------------------------------
    print_test "PATCH /me - Update user profile"
    print_info "Description: Update full_name and/or avatar_url"
    print_info "Authentication: Required (Bearer token)"
    print_info "Request Body: full_name (optional), avatar_url (optional)"
    
    make_request "PATCH" "/me" "{
        \"full_name\": \"Updated Test User\"
    }" "auth"
    check_status "200" "Update profile"
    
    # -------------------------------------------------------------------------
    # PATCH /me/password - Change password
    # -------------------------------------------------------------------------
    print_test "PATCH /me/password - Change password"
    print_info "Description: Change user's password"
    print_info "Authentication: Required (Bearer token)"
    print_info "Request Body: current_password, new_password, new_password_confirmation"
    
    make_request "PATCH" "/me/password" "{
        \"current_password\": \"$TEST_PASSWORD\",
        \"new_password\": \"newpassword456\",
        \"new_password_confirmation\": \"newpassword456\"
    }" "auth"
    check_status "200" "Change password"
    TEST_PASSWORD="newpassword456"
    
    # Error: Invalid current password (400)
    print_test "PATCH /me/password - Error: Invalid current password"
    print_info "Description: Wrong current password"
    print_info "Expected: 400 Bad Request with INVALID_PASSWORD"
    
    make_request "PATCH" "/me/password" "{
        \"current_password\": \"wrongpassword\",
        \"new_password\": \"anotherpassword\",
        \"new_password_confirmation\": \"anotherpassword\"
    }" "auth"
    check_status "400" "Invalid password error"
    
    # Error: Password mismatch (422)
    print_test "PATCH /me/password - Error: Password confirmation mismatch"
    print_info "Description: new_password and confirmation don't match"
    print_info "Expected: 422 Unprocessable Entity with VALIDATION_ERROR"
    
    make_request "PATCH" "/me/password" "{
        \"current_password\": \"$TEST_PASSWORD\",
        \"new_password\": \"newpassword789\",
        \"new_password_confirmation\": \"differentpassword\"
    }" "auth"
    check_status "422" "Password mismatch error"
}

# =============================================================================
# 3. FOLDER TESTS
# =============================================================================

test_folders() {
    print_header "3. FOLDER TESTS"
    
    # -------------------------------------------------------------------------
    # POST /folders - Create folder
    # -------------------------------------------------------------------------
    print_test "POST /folders - Create new folder"
    print_info "Description: Create a new folder at root level"
    print_info "Authentication: Required (Bearer token)"
    print_info "Request Body: name (required), parent_id (optional, null for root)"
    print_info "Response: id, name, parent_id, path, depth, sort_order, created_at"
    
    make_request "POST" "/folders" "{
        \"name\": \"Test Folder\"
    }" "auth"
    check_status "201" "Create folder"
    FOLDER_ID=$(extract_json "$LAST_RESPONSE" "['data']['id']")
    
    # Create subfolder
    print_test "POST /folders - Create subfolder"
    print_info "Description: Create a folder inside another folder"
    print_info "Request Body: name, parent_id (UUID of parent folder)"
    
    make_request "POST" "/folders" "{
        \"name\": \"Subfolder\",
        \"parent_id\": \"$FOLDER_ID\"
    }" "auth"
    check_status "201" "Create subfolder"
    local SUBFOLDER_ID=$(extract_json "$LAST_RESPONSE" "['data']['id']")
    
    # Error: Folder name exists (409)
    print_test "POST /folders - Error: Folder name already exists"
    print_info "Description: Create folder with duplicate name in same parent"
    print_info "Expected: 409 Conflict with FOLDER_EXISTS"
    
    make_request "POST" "/folders" "{
        \"name\": \"Test Folder\"
    }" "auth"
    check_status "409" "Folder exists error"
    
    # Error: Parent not found (404)
    print_test "POST /folders - Error: Parent folder not found"
    print_info "Description: Create folder with non-existent parent_id"
    print_info "Expected: 404 Not Found with PARENT_NOT_FOUND"
    
    make_request "POST" "/folders" "{
        \"name\": \"Orphan Folder\",
        \"parent_id\": \"00000000-0000-0000-0000-000000000000\"
    }" "auth"
    check_status "404" "Parent not found error"
    
    # -------------------------------------------------------------------------
    # GET /folders/tree - Get folder tree
    # -------------------------------------------------------------------------
    print_test "GET /folders/tree - Get folder tree structure"
    print_info "Description: Returns complete folder hierarchy for user"
    print_info "Authentication: Required (Bearer token)"
    print_info "Query Parameters:"
    print_info "  - include_files (boolean, default: false)"
    print_info "  - include_counts (boolean, default: true)"
    print_info "Response: Nested array of folders with children"
    
    make_request "GET" "/folders/tree?include_counts=true" "" "auth"
    check_status "200" "Get folder tree"
    
    # -------------------------------------------------------------------------
    # PUT /folders/:id - Rename folder
    # -------------------------------------------------------------------------
    print_test "PUT /folders/:id - Rename folder"
    print_info "Description: Update folder name"
    print_info "Authentication: Required (Bearer token)"
    print_info "Path Parameters: id (UUID)"
    print_info "Request Body: name (required)"
    
    make_request "PUT" "/folders/$FOLDER_ID" "{
        \"name\": \"Renamed Folder\"
    }" "auth"
    check_status "200" "Rename folder"
    
    # Error: Folder not found (404)
    print_test "PUT /folders/:id - Error: Folder not found"
    print_info "Description: Rename non-existent folder"
    print_info "Expected: 404 Not Found with FOLDER_NOT_FOUND"
    
    make_request "PUT" "/folders/00000000-0000-0000-0000-000000000000" "{
        \"name\": \"New Name\"
    }" "auth"
    check_status "404" "Folder not found error"
    
    # -------------------------------------------------------------------------
    # PATCH /folders/:id/move - Move folder
    # -------------------------------------------------------------------------
    print_test "PATCH /folders/:id/move - Move folder"
    print_info "Description: Move folder to different parent (drag-and-drop)"
    print_info "Authentication: Required (Bearer token)"
    print_info "Path Parameters: id (UUID of folder to move)"
    print_info "Request Body: parent_id (UUID or null), sort_order (integer)"
    
    # Create another folder to move into
    make_request "POST" "/folders" "{
        \"name\": \"Target Folder\"
    }" "auth"
    local TARGET_FOLDER_ID=$(extract_json "$LAST_RESPONSE" "['data']['id']")
    
    make_request "PATCH" "/folders/$SUBFOLDER_ID/move" "{
        \"parent_id\": \"$TARGET_FOLDER_ID\",
        \"sort_order\": 0
    }" "auth"
    check_status "200" "Move folder"
    
    # Move to root
    print_test "PATCH /folders/:id/move - Move folder to root"
    print_info "Description: Move folder to root level (parent_id: null)"
    
    make_request "PATCH" "/folders/$SUBFOLDER_ID/move" "{
        \"parent_id\": null,
        \"sort_order\": 1
    }" "auth"
    check_status "200" "Move folder to root"
    
    # Error: Cannot move into itself (400)
    print_test "PATCH /folders/:id/move - Error: Cannot move into itself"
    print_info "Description: Attempt to move folder into itself"
    print_info "Expected: 400 Bad Request with INVALID_MOVE"
    
    make_request "PATCH" "/folders/$FOLDER_ID/move" "{
        \"parent_id\": \"$FOLDER_ID\"
    }" "auth"
    check_status "400" "Invalid move error"
}

# =============================================================================
# 4. FILE TESTS
# =============================================================================

test_files() {
    print_header "4. FILE TESTS"
    
    # -------------------------------------------------------------------------
    # POST /files/upload/presign - Get presigned upload URL
    # -------------------------------------------------------------------------
    print_test "POST /files/upload/presign - Get presigned upload URL"
    print_info "Description: Request presigned URL for direct upload to MinIO"
    print_info "Authentication: Required (Bearer token)"
    print_info "Request Body:"
    print_info "  - filename (string, required)"
    print_info "  - file_size (integer, required, max 26214400 bytes)"
    print_info "  - content_type (string, required, must be application/pdf)"
    print_info "  - folder_id (UUID, optional)"
    print_info "Response: upload_id, presigned_url, storage_path, expires_at, headers"
    
    make_request "POST" "/files/upload/presign" "{
        \"filename\": \"test-document.pdf\",
        \"file_size\": 1048576,
        \"content_type\": \"application/pdf\",
        \"folder_id\": \"$FOLDER_ID\"
    }" "auth"
    check_status "200" "Get presigned URL"
    UPLOAD_ID=$(extract_json "$LAST_RESPONSE" "['data']['upload_id']")
    
    # Error: Invalid file type (400)
    print_test "POST /files/upload/presign - Error: Invalid file type"
    print_info "Description: Attempt to upload non-PDF file"
    print_info "Expected: 400 Bad Request with INVALID_FILE_TYPE"
    
    make_request "POST" "/files/upload/presign" "{
        \"filename\": \"document.docx\",
        \"file_size\": 1048576,
        \"content_type\": \"application/vnd.openxmlformats-officedocument.wordprocessingml.document\"
    }" "auth"
    check_status "400" "Invalid file type error"
    
    # Error: File too large (400)
    print_test "POST /files/upload/presign - Error: File too large"
    print_info "Description: File exceeds 25 MB limit"
    print_info "Expected: 400 Bad Request with FILE_TOO_LARGE"
    
    make_request "POST" "/files/upload/presign" "{
        \"filename\": \"large-file.pdf\",
        \"file_size\": 30000000,
        \"content_type\": \"application/pdf\"
    }" "auth"
    check_status "400" "File too large error"
    
    # Error: Folder not found (404)
    print_test "POST /files/upload/presign - Error: Folder not found"
    print_info "Description: Upload to non-existent folder"
    print_info "Expected: 404 Not Found with FOLDER_NOT_FOUND"
    
    make_request "POST" "/files/upload/presign" "{
        \"filename\": \"test.pdf\",
        \"file_size\": 1048576,
        \"content_type\": \"application/pdf\",
        \"folder_id\": \"00000000-0000-0000-0000-000000000000\"
    }" "auth"
    check_status "404" "Folder not found error"
    
    # -------------------------------------------------------------------------
    # POST /files/upload/confirm - Confirm upload
    # -------------------------------------------------------------------------
    print_test "POST /files/upload/confirm - Confirm upload (will fail without actual upload)"
    print_info "Description: Confirm file upload after uploading to MinIO"
    print_info "Authentication: Required (Bearer token)"
    print_info "Request Body: upload_id (UUID from presign response)"
    print_info "Response: File object with status 'uploaded'"
    print_info "Note: This will fail as we haven't actually uploaded to MinIO"
    
    make_request "POST" "/files/upload/confirm" "{
        \"upload_id\": \"$UPLOAD_ID\"
    }" "auth"
    # This will likely fail with FILE_NOT_IN_STORAGE since we didn't actually upload
    echo "  (Expected to fail without actual MinIO upload)"
    
    # Error: Upload not found (400)
    print_test "POST /files/upload/confirm - Error: Upload not found"
    print_info "Description: Confirm with invalid upload_id"
    print_info "Expected: 400 Bad Request with UPLOAD_NOT_FOUND"
    
    make_request "POST" "/files/upload/confirm" "{
        \"upload_id\": \"00000000-0000-0000-0000-000000000000\"
    }" "auth"
    check_status "400" "Upload not found error"
    
    # -------------------------------------------------------------------------
    # GET /files - List files
    # -------------------------------------------------------------------------
    print_test "GET /files - List files"
    print_info "Description: List files with optional filtering and pagination"
    print_info "Authentication: Required (Bearer token)"
    print_info "Query Parameters:"
    print_info "  - folder_id (UUID, filter by folder)"
    print_info "  - status (string: uploaded, pending, processing, completed, failed)"
    print_info "  - search (string, search by filename)"
    print_info "  - sort (string: filename, -filename, uploaded_at, -uploaded_at, file_size, -file_size)"
    print_info "  - page (integer, default: 1)"
    print_info "  - limit (integer, default: 20, max: 50)"
    print_info "Response: Paginated array of files with meta"
    
    make_request "GET" "/files?page=1&limit=20&sort=-uploaded_at" "" "auth"
    check_status "200" "List files"
    
    # List with filters
    print_test "GET /files - List files with filters"
    print_info "Description: Filter by folder and status"
    
    make_request "GET" "/files?folder_id=$FOLDER_ID&status=uploaded" "" "auth"
    check_status "200" "List files with filters"
    
    # Search files
    print_test "GET /files - Search files"
    print_info "Description: Search files by filename"
    
    make_request "GET" "/files?search=test" "" "auth"
    check_status "200" "Search files"
}

# =============================================================================
# 5. SUMMARY TESTS
# =============================================================================

test_summaries() {
    print_header "5. SUMMARY TESTS"
    
    # -------------------------------------------------------------------------
    # GET /summary-styles - Get available styles
    # -------------------------------------------------------------------------
    print_test "GET /summary-styles - Get available summary styles"
    print_info "Description: Returns list of available summary styles with descriptions"
    print_info "Authentication: Required (Bearer token)"
    print_info "Response: Array of styles with id, name, description, example_output"
    print_info "Available styles:"
    print_info "  - bullet_points: Concise bullet-point format"
    print_info "  - paragraph: Flowing paragraph narrative"
    print_info "  - detailed: Comprehensive detailed analysis"
    print_info "  - executive: Executive summary with key takeaways"
    print_info "  - academic: Academic/research style"
    
    make_request "GET" "/summary-styles" "" "auth"
    check_status "200" "Get summary styles"
    
    # Note: The following tests require an actual file to exist
    # We'll use a placeholder file_id for demonstration
    local DEMO_FILE_ID="00000000-0000-0000-0000-000000000001"
    
    # -------------------------------------------------------------------------
    # GET /summaries/:file_id - Get summary
    # -------------------------------------------------------------------------
    print_test "GET /summaries/:file_id - Get summary for file"
    print_info "Description: Get current summary for a file"
    print_info "Authentication: Required (Bearer token)"
    print_info "Path Parameters: file_id (UUID)"
    print_info "Query Parameters: version (integer, optional, default: latest)"
    print_info "Response varies by file status:"
    print_info "  - completed: Full summary object"
    print_info "  - processing: Status message"
    print_info "  - no_summary: Prompt to generate"
    print_info "  - failed: Error message"
    
    make_request "GET" "/summaries/$DEMO_FILE_ID" "" "auth"
    # Will return 404 since file doesn't exist
    echo "  (Expected 404 - demo file doesn't exist)"
    
    # -------------------------------------------------------------------------
    # GET /summaries/:file_id/history - Get summary history
    # -------------------------------------------------------------------------
    print_test "GET /summaries/:file_id/history - Get summary version history"
    print_info "Description: Get all summary versions for a file"
    print_info "Authentication: Required (Bearer token)"
    print_info "Path Parameters: file_id (UUID)"
    print_info "Response: Array of summary versions with metadata"
    
    make_request "GET" "/summaries/$DEMO_FILE_ID/history" "" "auth"
    echo "  (Expected 404 - demo file doesn't exist)"
    
    # -------------------------------------------------------------------------
    # POST /summaries/:file_id/generate - Generate summary
    # -------------------------------------------------------------------------
    print_test "POST /summaries/:file_id/generate - Generate summary"
    print_info "Description: Request on-demand summary generation"
    print_info "Authentication: Required (Bearer token)"
    print_info "Path Parameters: file_id (UUID)"
    print_info "Request Body:"
    print_info "  - style (string, required): bullet_points, paragraph, detailed, executive, academic"
    print_info "  - custom_instructions (string, optional, max 500 chars)"
    print_info "Response: job_id, status, style, custom_instructions"
    
    make_request "POST" "/summaries/$DEMO_FILE_ID/generate" "{
        \"style\": \"bullet_points\",
        \"custom_instructions\": \"Focus on key findings and methodology\"
    }" "auth"
    echo "  (Expected 404 - demo file doesn't exist)"
    
    # Error: Invalid style (400)
    print_test "POST /summaries/:file_id/generate - Error: Invalid style"
    print_info "Description: Use invalid summary style"
    print_info "Expected: 400 Bad Request with INVALID_STYLE"
    
    make_request "POST" "/summaries/$DEMO_FILE_ID/generate" "{
        \"style\": \"invalid_style\"
    }" "auth"
    echo "  (Will return 404 for file, but would return 400 for invalid style)"
    
    # Error: Instructions too long (422)
    print_test "POST /summaries/:file_id/generate - Error: Instructions too long"
    print_info "Description: custom_instructions exceeds 500 characters"
    print_info "Expected: 422 Unprocessable Entity with VALIDATION_ERROR"
    
    local long_instructions=$(printf 'x%.0s' {1..600})
    make_request "POST" "/summaries/$DEMO_FILE_ID/generate" "{
        \"style\": \"bullet_points\",
        \"custom_instructions\": \"$long_instructions\"
    }" "auth"
    echo "  (Will return 404 for file, but would return 422 for long instructions)"
}

# =============================================================================
# 6. AVATAR UPLOAD TESTS
# =============================================================================

test_avatar_upload() {
    print_header "6. AVATAR UPLOAD TESTS"
    
    # -------------------------------------------------------------------------
    # POST /uploads/avatar/presign - Get presigned URL for avatar
    # -------------------------------------------------------------------------
    print_test "POST /uploads/avatar/presign - Get presigned URL for avatar upload"
    print_info "Description: Request presigned URL for avatar image upload"
    print_info "Authentication: Required (Bearer token)"
    print_info "Request Body:"
    print_info "  - filename (string, required)"
    print_info "  - file_size (integer, required, max 5 MB)"
    print_info "  - content_type (string, required: image/jpeg, image/png, image/webp)"
    print_info "Response: upload_id, presigned_url, expires_at"
    
    make_request "POST" "/uploads/avatar/presign" "{
        \"filename\": \"avatar.jpg\",
        \"file_size\": 204800,
        \"content_type\": \"image/jpeg\"
    }" "auth"
    check_status "200" "Get avatar presigned URL"
    AVATAR_UPLOAD_ID=$(extract_json "$LAST_RESPONSE" "['data']['upload_id']")
    
    # Error: Invalid content type (400)
    print_test "POST /uploads/avatar/presign - Error: Invalid content type"
    print_info "Description: Attempt to upload non-image file"
    print_info "Expected: 400 Bad Request with INVALID_FILE_TYPE"
    
    make_request "POST" "/uploads/avatar/presign" "{
        \"filename\": \"avatar.gif\",
        \"file_size\": 204800,
        \"content_type\": \"image/gif\"
    }" "auth"
    check_status "400" "Invalid avatar type error"
    
    # Error: File too large (400)
    print_test "POST /uploads/avatar/presign - Error: Avatar too large"
    print_info "Description: Avatar exceeds 5 MB limit"
    print_info "Expected: 400 Bad Request with FILE_TOO_LARGE"
    
    make_request "POST" "/uploads/avatar/presign" "{
        \"filename\": \"large-avatar.jpg\",
        \"file_size\": 10000000,
        \"content_type\": \"image/jpeg\"
    }" "auth"
    check_status "400" "Avatar too large error"
    
    # -------------------------------------------------------------------------
    # POST /uploads/avatar/confirm - Confirm avatar upload
    # -------------------------------------------------------------------------
    print_test "POST /uploads/avatar/confirm - Confirm avatar upload"
    print_info "Description: Confirm avatar upload and update user profile"
    print_info "Authentication: Required (Bearer token)"
    print_info "Request Body: upload_id (UUID from presign response)"
    print_info "Response: avatar_url"
    print_info "Note: This will fail as we haven't actually uploaded to MinIO"
    
    make_request "POST" "/uploads/avatar/confirm" "{
        \"upload_id\": \"$AVATAR_UPLOAD_ID\"
    }" "auth"
    echo "  (Expected to fail without actual MinIO upload)"
    
    # Error: Upload not found (400)
    print_test "POST /uploads/avatar/confirm - Error: Upload not found"
    print_info "Description: Confirm with invalid upload_id"
    print_info "Expected: 400 Bad Request with UPLOAD_NOT_FOUND"
    
    make_request "POST" "/uploads/avatar/confirm" "{
        \"upload_id\": \"00000000-0000-0000-0000-000000000000\"
    }" "auth"
    check_status "400" "Avatar upload not found error"
}

# =============================================================================
# 7. SESSION MANAGEMENT TESTS
# =============================================================================

test_sessions() {
    print_header "7. SESSION MANAGEMENT TESTS"
    
    # Create additional session by logging in again
    print_test "Create additional session"
    print_info "Description: Login again to create second session"
    
    make_request "POST" "/auth/login" "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }"
    check_status "200" "Create second session"
    ACCESS_TOKEN=$(extract_json "$LAST_RESPONSE" "['data']['access_token']")
    
    # -------------------------------------------------------------------------
    # GET /auth/sessions - List all sessions
    # -------------------------------------------------------------------------
    print_test "GET /auth/sessions - List all sessions"
    print_info "Description: Returns all active sessions for current user"
    print_info "Authentication: Required (Bearer token)"
    print_info "Response: Array of sessions with:"
    print_info "  - id (UUID)"
    print_info "  - device_info (string)"
    print_info "  - ip_address (string)"
    print_info "  - created_at (timestamp)"
    print_info "  - last_active_at (timestamp)"
    print_info "  - is_current (boolean)"
    
    make_request "GET" "/auth/sessions" "" "auth"
    check_status "200" "List all sessions"
    
    # Get a non-current session ID for revocation test
    local OTHER_SESSION_ID=$(extract_json "$LAST_RESPONSE" "['data'][1]['id']" 2>/dev/null || echo "")
    
    # -------------------------------------------------------------------------
    # DELETE /auth/sessions/:session_id - Revoke session
    # -------------------------------------------------------------------------
    if [ -n "$OTHER_SESSION_ID" ] && [ "$OTHER_SESSION_ID" != "" ]; then
        print_test "DELETE /auth/sessions/:session_id - Revoke specific session"
        print_info "Description: Revoke a specific session (logout from that device)"
        print_info "Authentication: Required (Bearer token)"
        print_info "Path Parameters: session_id (UUID)"
        print_info "Note: Cannot revoke current session"
        
        make_request "DELETE" "/auth/sessions/$OTHER_SESSION_ID" "" "auth"
        check_status "200" "Revoke session"
    fi
    
    # Error: Session not found (404)
    print_test "DELETE /auth/sessions/:session_id - Error: Session not found"
    print_info "Description: Revoke non-existent session"
    print_info "Expected: 404 Not Found with SESSION_NOT_FOUND"
    
    make_request "DELETE" "/auth/sessions/00000000-0000-0000-0000-000000000000" "" "auth"
    check_status "404" "Session not found error"
}

# =============================================================================
# 8. CLEANUP & LOGOUT TESTS
# =============================================================================

test_cleanup() {
    print_header "8. CLEANUP & LOGOUT TESTS"
    
    # -------------------------------------------------------------------------
    # DELETE /folders/:id - Delete folder
    # -------------------------------------------------------------------------
    print_test "DELETE /folders/:id - Delete folder"
    print_info "Description: Delete folder and all its contents"
    print_info "Authentication: Required (Bearer token)"
    print_info "Path Parameters: id (UUID)"
    print_info "Response: 204 No Content"
    
    if [ -n "$FOLDER_ID" ]; then
        make_request "DELETE" "/folders/$FOLDER_ID" "" "auth"
        check_status "204" "Delete folder"
    fi
    
    # Error: Folder not found (404)
    print_test "DELETE /folders/:id - Error: Folder not found"
    print_info "Description: Delete non-existent folder"
    print_info "Expected: 404 Not Found with FOLDER_NOT_FOUND"
    
    make_request "DELETE" "/folders/00000000-0000-0000-0000-000000000000" "" "auth"
    check_status "404" "Folder not found error"
    
    # -------------------------------------------------------------------------
    # POST /auth/logout-all - Logout from all devices
    # -------------------------------------------------------------------------
    print_test "POST /auth/logout-all - Logout from all devices"
    print_info "Description: Revoke all refresh tokens for user"
    print_info "Authentication: Required (Bearer token)"
    print_info "Response: sessions_terminated count"
    
    make_request "POST" "/auth/logout-all" "" "auth"
    check_status "200" "Logout all"
    
    # Re-login for final logout test
    make_request "POST" "/auth/login" "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }"
    ACCESS_TOKEN=$(extract_json "$LAST_RESPONSE" "['data']['access_token']")
    
    # -------------------------------------------------------------------------
    # POST /auth/logout - Logout current session
    # -------------------------------------------------------------------------
    print_test "POST /auth/logout - Logout current session"
    print_info "Description: Revoke current refresh token"
    print_info "Authentication: Required (Bearer token)"
    print_info "Response: Success message"
    print_info "Clears refresh_token cookie"
    
    make_request "POST" "/auth/logout" "" "auth"
    check_status "200" "Logout"
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

print_summary() {
    print_header "TEST SUMMARY"
    echo ""
    echo -e "Base URL: ${CYAN}$BASE_URL${NC}"
    echo -e "Test User: ${CYAN}$TEST_EMAIL${NC}"
    echo ""
    echo -e "Total Tests: ${CYAN}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}=============================================================================${NC}"
        echo -e "${GREEN}ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}=============================================================================${NC}"
    else
        echo -e "${RED}=============================================================================${NC}"
        echo -e "${RED}SOME TESTS FAILED${NC}"
        echo -e "${RED}=============================================================================${NC}"
    fi
}

main() {
    echo ""
    echo -e "${BLUE}=============================================================================${NC}"
    echo -e "${BLUE}NEXT PDF - API Testing Script${NC}"
    echo -e "${BLUE}=============================================================================${NC}"
    echo ""
    echo "Base URL: $BASE_URL"
    echo "Test Email: $TEST_EMAIL"
    echo ""
    echo "Starting tests..."
    
    # Run all test suites
    test_auth
    test_users
    test_folders
    test_files
    test_summaries
    test_avatar_upload
    test_sessions
    test_cleanup
    
    # Print summary
    print_summary
    
    # Exit with appropriate code
    if [ $FAILED_TESTS -gt 0 ]; then
        exit 1
    fi
    exit 0
}

# Run main function
main "$@"
