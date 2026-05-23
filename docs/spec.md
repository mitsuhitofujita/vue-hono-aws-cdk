# Specification

## Technology Stack

| Category                | Technology                                                    |
| ----------------------- | ------------------------------------------------------------- |
| Cloud Platform          | AWS                                                           |
| Authentication          | Amazon Cognito                                                |
| Authentication Provider | Google only (no email authentication or other providers)      |
| Frontend                | CloudFront + S3 + Vue.js (static file delivery)               |
| Backend                 | CloudFront + API Gateway (Cognito Authorizer) + Lambda + Hono |
| Language                | TypeScript                                                    |
| IaC                     | AWS CDK (TypeScript)                                          |
| Runtime                 | Node.js (Lambda)                                              |
| E2E Testing             | Playwright (TypeScript)                                       |
| Browser                 | Google Chrome (or Chromium-based derivatives) only            |
| Package Manager         | pnpm (workspaces for frontend, backend, and E2E)              |
| Data Storage            | DynamoDB                                                      |
| Linter                  | oxlint                                                        |
| CSS Framework           | Tailwind CSS v4 + shadcn-vue                                  |
| Build Tool              | Vite                                                          |

A single CloudFront distribution is used with path-based routing, eliminating the need for CORS.

## Authentication Strategy

The frontend acquires authentication credentials; the backend only validates them.
Token management is handled by the Amplify Auth module.
Cognito Authorizer is used.

## Development Environment

Each developer provisions their own cloud resource environment.
Deployments are made using CDK under a name separate from the production environment.
This environment can be freely destroyed and recreated.

## CDK Stack Strategy

Stacks are separated by update frequency:

- Resources that are essentially static once created (e.g., S3 buckets).
- Resources that change rarely and require caution when modified (e.g., DynamoDB tables).
- Resources that are updated frequently (e.g., Lambda functions).

## Testing Strategy (Testing Honeycomb)

- Feature tests (most): Run in a local environment that includes DynamoDB (provided by the development environment).
- E2E tests: Run against the cloud environment using Playwright.
- Unit tests (fewest): Logic verification using test stubs.

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

- Logical name: 物品 (Item)
- Physical name: `item`

Attributes:

- Item name
- Purchase date (year and month)
- Purchase price
- Disposal date (year and month)

## Page Layout

### Global Header

- Not displayed on the home page.
- Left: Application title.
- Right (authenticated): Account image (circular).
  - Tapping the account image slides a navigation menu in from right to left.

### Global Footer

- Displayed on all pages.
- Center: Application title only.

## Pages

### `/` Home Page

- Title: "TOCOOP"
  - Subtitle: "COST PER MONTH TRACKER"
- Brief description (in English):
  - "Track the real cost of your purchases."
  - "See how value grows over time."
- Unauthenticated:
  - Sign-in form.
    - Since only Google authentication is supported, only a Sign in with Google button is displayed.
- Authenticated:
  - Account info:
    - Image
    - Display name
  - Link button to the item list page:
    - Gift icon and label "ITEMS"
  - Sign-out link button:
    - Exit icon (or simply an outward-pointing icon) and label "SIGN OUT"
- Centered on the screen.

### `/items` Item List Page

- Paginated.
- Add button:
  - Icon and label "ADD"
  - Rectangular shape
  - Plus icon
  - Placed above the list, below the list title "ITEMS"
- Displays items in a list with:
  - Item name
  - Purchase date (year and month)
- Sorted by purchase date in descending order (newest first).

### `/items/create` Item Create Page

- Item name input field
- Purchase price input field
- Purchase date input field (year and month)
- Apply button:
  - Check icon and label "APPLY"

### `/items/{itemId}` Item Detail Page

- Item name
- Purchase price
- Purchase date (year and month)
- Average fixed cost
  - Calculated on each page access.
  - If the disposal date is not set, the cost is calculated for the current month.
  - If the disposal date is set, the cost is calculated for the disposal month.
- Edit button:
  - Icon and label "EDIT"
  - Rectangular shape
  - Pencil icon
  - Placed below the item information

### `/items/{itemId}/edit` Item Edit Page

- Item name input field
- Purchase price input field
- Purchase date input field (year and month)
- Disposal date input field (year and month)
- Apply button:
  - Check icon and label "APPLY"
- Delete button:
  - Trash icon and label "DELETE"

## REST API Endpoints

| Method | Path             | Description       |
| ------ | ---------------- | ----------------- |
| GET    | `/api/items`     | List items        |
| GET    | `/api/items/:id` | Get a single item |
| POST   | `/api/items`     | Create an item    |
| PUT    | `/api/items/:id` | Update an item    |
| DELETE | `/api/items/:id` | Delete an item    |

## Undecided

- CI/CD strategy
