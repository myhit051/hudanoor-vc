## ADDED Requirements

### Requirement: Employee Authentication
The system SHALL require all users to authenticate with an Employee ID and a 4-6 digit PIN before accessing any feature.

#### Scenario: Successful login
- **WHEN** a user enters a valid Employee ID and correct PIN
- **THEN** the system returns a JWT token stored in localStorage
- **AND** the user is redirected to the Dashboard

#### Scenario: Failed login
- **WHEN** a user enters an invalid Employee ID or incorrect PIN
- **THEN** the system displays an error message
- **AND** the user remains on the Login page

#### Scenario: Session expired
- **WHEN** the JWT token has expired (after 30 days)
- **THEN** the system redirects the user to the Login page

#### Scenario: Unauthenticated access
- **WHEN** a user tries to access any page without a valid JWT token
- **THEN** the system redirects the user to the Login page

### Requirement: Admin User Management
The system SHALL provide an Admin Panel accessible only by users with role=admin, allowing management of user accounts.

#### Scenario: Admin creates a new user
- **WHEN** admin enters employee_id, name, PIN, role, and selects allowed menus
- **THEN** the system creates a user record in the `users` table with a hashed PIN
- **AND** the new user can log in immediately

#### Scenario: Admin updates user permissions
- **WHEN** admin changes the allowed_menus of an existing user
- **THEN** the user's sidebar menu updates on their next page load
- **AND** the user cannot access routes they no longer have permission for

#### Scenario: Admin disables a user
- **WHEN** admin sets a user to inactive
- **THEN** the user cannot log in anymore
- **AND** any existing JWT tokens for that user are rejected

#### Scenario: Non-admin access attempt
- **WHEN** a user with role=employee tries to access the Admin Panel
- **THEN** the system redirects them to the Dashboard

### Requirement: Menu-Level Access Control
The system SHALL filter sidebar menu items based on the authenticated user's `allowed_menus` configuration, hiding menus the user is not permitted to access.

#### Scenario: Employee with limited menus
- **WHEN** a user with allowed_menus=["dashboard", "sales-entry"] logs in
- **THEN** the sidebar shows only "Dashboard" and "บันทึกยอดขาย"
- **AND** navigating to other routes (e.g., /settings) redirects to Dashboard

#### Scenario: Admin user
- **WHEN** a user with role=admin logs in
- **THEN** all menu items are visible including the Admin Panel
- **AND** the user can access all routes

### Requirement: Recorded By Tracking
The system SHALL automatically record the authenticated user's name as `recorded_by` for every sales order and stock receiving entry. The recorded_by field SHALL be read-only and locked to the current user.

#### Scenario: Employee records a sale
- **WHEN** an authenticated employee submits a sales order
- **THEN** the `recorded_by` field is set to the employee's name from their JWT token
- **AND** the field is not editable in the UI

#### Scenario: Viewing history shows recorder
- **WHEN** a user views the sales history table
- **THEN** each row shows the name of the person who recorded it
- **AND** records without a recorder (legacy data) show "-"

### Requirement: User Identity Display
The system SHALL display the current user's name and a logout button in the sidebar footer area.

#### Scenario: User identity shown
- **WHEN** a user is logged in
- **THEN** their name and role are displayed at the bottom of the sidebar
- **AND** a logout button is available
