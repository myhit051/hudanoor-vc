## ADDED Requirements

### Requirement: Order Grouping
The system SHALL group sales order items into orders using a unique `order_id`. All items submitted in a single batch (cart) SHALL share the same order_id.

#### Scenario: Batch submission creates an order
- **WHEN** a user submits a cart with 3 items
- **THEN** all 3 items are saved with the same `order_id` (format: `ORD-YYYYMMDD-NNN`)
- **AND** the order_id sequence increments per day

#### Scenario: Single item submission
- **WHEN** a user submits a cart with 1 item
- **THEN** the item is saved with a unique `order_id`

### Requirement: Order Summary Display
The system SHALL display a summary of the most recent orders (5-10) on the Sales Entry page, grouped by order_id.

#### Scenario: Viewing recent orders
- **WHEN** a user is on the Sales Entry page
- **THEN** the page shows the 10 most recent orders
- **AND** each order shows: order_id, date, number of items, total amount, and recorder name

#### Scenario: Expanding an order
- **WHEN** a user clicks on an order in the summary
- **THEN** the order expands to show individual item details (product, SKU, quantity, price, discount)

#### Scenario: Legacy data without order_id
- **WHEN** sales records exist without an order_id (created before this feature)
- **THEN** those records are shown individually in the history table as before
- **AND** they are NOT grouped into the order summary section
