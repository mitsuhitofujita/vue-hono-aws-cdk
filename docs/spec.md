# Specification

## Technology Stack

| Category | Technology |
|---|---|
| Cloud Platform | AWS |
| Authentication | Amazon Cognito |
| Authentication Provider | Google only (no email authentication or other providers) |
| Frontend Hosting | CloudFront + S3 (static file delivery with Vue.js) |
| Backend | CloudFront + API Gateway (Cognito Authorizer) + Lambda + Hono |
| Language | TypeScript |
| IaC | AWS CDK (TypeScript) |
| Runtime | Node.js (Lambda) |
| E2E Testing | Playwright (TypeScript) |
| Supported Browser | Google Chrome (or Chromium-based derivatives) only |
| Package Manager | pnpm (workspaces for frontend, backend, and E2E) |
| Data Storage | DynamoDB |
| Linter | oxlint |
| CSS Framework | Tailwind CSS v4 + shadcn-vue |
| Build Tool | Vite |

A single CloudFront distribution is used with path-based routing, eliminating the need for CORS.

## Authentication Strategy

The frontend acquires authentication credentials. The backend only validates them.
Token management is handled by the Amplify Auth module.
Cognito Authorizer is used for backend authorization.

## Development Environment

Each developer provisions their own cloud resource environment.
Deployments are made using CDK under a name separate from the production environment.
This environment can be freely destroyed and recreated.

## CDK Stack Strategy

Stacks are separated by update frequency:

- **Rarely changed**: Resources that are essentially static once created (e.g., S3 buckets).
- **Infrequently changed**: Resources that change rarely and require caution when modified (e.g., DynamoDB tables).
- **Frequently changed**: Resources that are updated often (e.g., Lambda functions).

## Testing Strategy (Testing Honeycomb)

- **Feature tests** (most): Run in a local environment that includes DynamoDB (provided by the development environment).
- **E2E tests**: Run against the cloud environment using Playwright.
- **Unit tests** (fewest): Logic verification using test stubs.

## Directory Structure

- `./apps/frontend`
    - Static web application
    - Vue.js
    - Authentication
- `./apps/backend`
    - Data persistence to the data store
    - Data retrieval from the data store
- `./tests/e2e`
    - E2E tests using Playwright
- `./infra/cdk`
    - IaC using CDK
    - Provisions per-developer cloud resources for verification

## Frontend-Backend Communication

- Protocol: REST API
- Format: JSON

## Entities

### Item

| | |
|---|---|
| Logical Name | Item (物品) |
| Physical Name | `item` |

#### Attributes

| Attribute | Description |
|---|---|
| Item Name | Name of the purchased item |
| Purchase Date | Year and month of purchase |
| Purchase Price | Price paid for the item |
| Disposal Date | Year and month of disposal |

## Page Layout

### Global Header

- Not displayed on the home page.
- Left: Application title.
- Right (authenticated): Account name.
    - Tapping the account name slides a navigation menu in from right to left.

### Global Footer

- Displayed on all pages.
- Center: Application title only.

## Pages

### `/` Home Page

- Title: "TOCOOP"
    - Subtitle: "COST PER MONTH TRACKER"
- A brief description in English:
    - "Track the real cost of your purchases."
    - "See how value grows over time."
- **Unauthenticated**:
    - Sign in with Google button only (since only Google authentication is supported).
- **Authenticated**:
    - Profile image
    - Display name
    - Link button to the item list page
    - Sign-out link button
- Centered on the screen.

### `/items` Item List Page

- Paginated.
- Displays items in a list with:
    - Item name
    - Purchase date (year and month)
- Sorted by purchase date in descending order (newest first).
- Add button:
    - Icon only (no text label)
    - Circular shape
    - Plus icon

### `/items/create` Item Create Page

- Item name input field
- Purchase price input field
- Purchase date input field (year and month)
- Update button (text label)
- Delete button (text label)

### `/items/{itemId}` Item Detail Page

- Item name
- Purchase price
- Purchase date (year and month)
- Average fixed cost for the current month
    - Calculated on each page access.
- Edit button:
    - Icon only (no text label)
    - Circular shape
    - Pencil icon

### `/items/{itemId}/edit` Item Edit Page

- Item name input field
- Purchase price input field
- Purchase date input field (year and month)
- Disposal date input field (year and month)
- Update button (text label)
- Delete button (text label)

## REST API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/items` | List items |
| POST | `/api/items` | Create an item |
| PUT | `/api/items/:id` | Update an item |
| DELETE | `/api/items/:id` | Delete an item |

## Undecided

- CI/CD strategy
