## Project Summary

- Full-stack cannabis store platform with distinct customer and manager experiences, backed by a Node.js/Express API.
- Monorepo with three workspaces:
	- server: REST API + Socket.io services
	- customer-portal: React PWA for shoppers
	- manager-portal: React PWA for staff/admin workflows

## Customer Portal (React PWA)

- Product discovery by category (flower, concentrates, edibles) with product detail viewing.
- Cart and checkout flow that submits orders through the API.
- Order history and profile management.
- Real-time chat with managers for support and ordering assistance.
- PWA support for installability and offline-ready assets.

## Manager Portal (React PWA)

- Product management (CRUD) across categories:
	- Bulk flower (weight-based pricing)
	- Packaged flower (fixed weight/price)
	- Concentrates (base product with multiple strains)
	- Edibles (type, THC content, pricing)
- Price tier management for bulk flower weight/price matrices.
- Order management with order detail views and fulfillment tracking.
- User management for customers and staff.
- Invite link generation and QR code distribution for onboarding customers.
- Real-time chat dashboard with unread indicators, typing signals, and read receipts.

## Real-time & Messaging

- Socket.io for chat, notifications, typing indicators, and read receipts.
- Conversation model with per-role unread counters and last-message metadata.
- Order messages supported as a dedicated message type.

## API Server (Node.js/Express)

- REST endpoints for auth, users, products, price tiers, orders, and chat.
- JWT access/refresh token flow with role-based access control.
- MongoDB/Mongoose models for users, products, orders, invites, conversations, and messages.
- File upload pipeline using Multer with configurable size limits and upload storage.
- CORS configured for local and tunnel URLs for both portals.

## UI/State/Tooling

- React 18 + React Router for routing and protected routes.
- Chakra UI for component styling and theming.
- React Query for server state and caching.
- React Hook Form for form management and validation.
- Zustand for lightweight global state (auth, chat, cart).

## Development Scripts

- Root scripts to install all workspaces and run server + portals concurrently.
- Vite dev servers for customer (3000) and manager (3001) portals.
- Express dev server on port 5000 with a health check endpoint for orchestration.
