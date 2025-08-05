# Glossary

Definitions of technical terms, business concepts, and acronyms used throughout Ventry documentation and application.

## A

### ABC Analysis

A method of categorizing inventory items based on their importance, typically by annual consumption value. 'A' items are high-value with tight control, 'B' items are moderate, and 'C' items are low-value with simple controls.

### Access Token

A credential used to access protected resources. In Ventry, JWT tokens serve as access tokens for API authentication.

### Active Organization

The currently selected organization context for a user who belongs to multiple organizations.

### Adjustment

A manual correction to inventory quantities, typically done during cycle counts or to correct discrepancies.

### API (Application Programming Interface)

A set of protocols and tools for building software applications. Ventry provides REST and tRPC APIs.

### API Key

A unique identifier used to authenticate requests to the Ventry API.

### Audit Log

A chronological record of system activities, including who performed what action and when.

### Authentication

The process of verifying the identity of a user or system.

### Authorization

The process of determining what permissions an authenticated user has.

## B

### Backorder

An order for an item that is temporarily out of stock, to be fulfilled when stock becomes available.

### Barcode

A machine-readable representation of data, used for quick item identification. Ventry supports various barcode formats.

### Base URL

The root address of an API endpoint, e.g., `https://api.ventry.app`.

### Batch

A specific production run or shipment of items, often tracked with lot numbers.

### Batch Processing

Processing multiple records or transactions together rather than individually.

### Bearer Token

An authentication token sent in the HTTP Authorization header as "Bearer {token}".

### Bill of Materials (BOM)

A list of raw materials, components, and quantities needed to manufacture a product.

### Bin Location

A specific storage location within a warehouse, typically identified by aisle, rack, and bin numbers.

### Business Logic

The rules and processes that define how business operations work within the system.

## C

### Cache

Temporary storage of frequently accessed data for improved performance.

### Carrier

A shipping company that transports goods (e.g., FedEx, UPS, DHL).

### Category

A classification group for organizing similar items.

### Client ID

A public identifier for applications accessing the Ventry API.

### Cloud Storage

Remote storage services like AWS S3 used for files and backups.

### Commodity Code

A standardized numerical classification of traded products (e.g., HS codes).

### Consignment

Inventory owned by a supplier but stored at the customer's location.

### Cookie

Small data files stored by web browsers, used for maintaining sessions in Ventry.

### CORS (Cross-Origin Resource Sharing)

A mechanism that allows restricted resources to be requested from another domain.

### Cost of Goods Sold (COGS)

The direct costs attributable to the production or purchase of goods sold.

### Cycle Count

A periodic counting of inventory to verify accuracy without doing a full physical inventory.

## D

### Dashboard

A visual display of key metrics and KPIs in real-time.

### Data Model

The structure and relationships of data entities in the system.

### Database Migration

The process of moving or upgrading database schemas while preserving data.

### Dead Stock

Inventory that hasn't sold and is unlikely to sell in the future.

### Demand Forecasting

Predicting future customer demand based on historical data and trends.

### Deprecation

The process of phasing out features or API endpoints.

### Dimension

Physical measurements (length, width, height) of items or packages.

### Docker

Container platform used for packaging and deploying Ventry backend services.

### Domain Model

The conceptual model of business entities and their relationships.

### Dropdown

A UI element that displays a list of options when clicked.

### Dual-User Pattern

Security pattern where different database users have different permission levels.

## E

### EAN (European Article Number)

A barcode standard used globally for marking retail goods.

### Economic Order Quantity (EOQ)

The optimal order quantity that minimizes total inventory costs.

### Endpoint

A specific URL where an API can be accessed.

### Entity

A distinct object in the system (e.g., Item, Order, Customer).

### Environment Variable

Configuration values set outside the application code.

### ERP (Enterprise Resource Planning)

Integrated management software for core business processes.

### ESM (ECMAScript Modules)

Modern JavaScript module system used throughout Ventry.

### ETL (Extract, Transform, Load)

Process of moving data between systems with transformation.

### Event-Driven

Architecture pattern where actions trigger events that other parts respond to.

### Expiration Date

The date after which an item should not be used or sold.

## F

### Feature Flag

A toggle to enable/disable functionality without code changes.

### FIFO (First In, First Out)

Inventory valuation method where oldest items are used first.

### Fiscal Year

A 12-month period used for accounting purposes.

### Foreign Key

A database field that links to the primary key of another table.

### Fulfillment

The process of receiving, processing, and delivering customer orders.

### Full-Stack

Referring to both frontend and backend development capabilities.

## G

### Git

Version control system used for Ventry source code management.

### GraphQL

A query language for APIs (not currently used in Ventry, which uses tRPC).

### Gross Margin

The difference between revenue and cost of goods sold.

### GTIN (Global Trade Item Number)

A unique identifier for trade items developed by GS1.

## H

### Hash

A fixed-size result of a one-way mathematical function, used for passwords.

### Header

1. HTTP headers contain metadata about requests/responses
2. Column headers in tables and reports

### Heartbeat

A periodic signal to indicate a system is functioning.

### Hook

1. React Hooks for state management
2. Webhook endpoints for event notifications

### HTTP Status Code

Numeric codes indicating the result of an HTTP request (e.g., 200 OK, 404 Not Found).

## I

### Idempotent

An operation that produces the same result regardless of how many times it's performed.

### Inbound

Goods or shipments coming into a warehouse.

### Index

1. Database indexes for query performance
2. Array position in programming

### Integration Test

Tests that verify multiple components work together correctly.

### Inventory

The goods and materials a business holds for resale or production.

### Inventory Turnover

A ratio showing how many times inventory is sold and replaced over a period.

### Invoice

A commercial document listing goods/services and amounts owed.

### ISO 8601

International standard for date and time representation (e.g., 2024-01-20T10:30:00Z).

## J

### JWT (JSON Web Token)

A compact, URL-safe means of representing claims between two parties.

### Job Queue

A list of background tasks waiting to be processed.

### Join

A database operation combining rows from multiple tables.

### JSON (JavaScript Object Notation)

A lightweight data interchange format used throughout Ventry APIs.

## K

### Kanban

A visual system for managing work as it moves through a process.

### Key Performance Indicator (KPI)

A measurable value demonstrating business effectiveness.

### Kit

A collection of items bundled together as a single unit.

## L

### Landing Cost

The total cost of a product once it has arrived at the buyer's location.

### Lead Time

The time between initiating and completing a process.

### LIFO (Last In, First Out)

Inventory valuation method where newest items are used first.

### Line Item

An individual item line on an order or invoice.

### Location

A specific place where inventory is stored within a warehouse.

### Lot Number

An identification number assigned to a particular quantity or lot of material.

### Low Stock Alert

A notification when inventory falls below a defined threshold.

## M

### Master Data

Core business data that is shared across the organization.

### Materialized View

A database object containing query results for performance.

### Middleware

Software that acts as a bridge between an operating system and applications.

### Migration

Moving data or systems from one environment to another.

### Min/Max

Minimum and maximum inventory levels for automatic reordering.

### Modal

A dialog box that appears on top of the main content.

### Multi-Organization

Supporting multiple separate organizations in a single system instance.

### Multi-Tenant

Software architecture where a single instance serves multiple customers.

### Mutation

In tRPC, an operation that modifies data.

## N

### Namespace

A container for a set of identifiers to avoid naming conflicts.

### Next.js

The React framework used for Ventry's frontend.

### Node.js

JavaScript runtime used for Ventry's backend services.

### Normalization

Organizing data to reduce redundancy and improve integrity.

### Notification

Alerts sent to users about important events or actions needed.

## O

### OAuth

An open standard for authorization between applications.

### On-Hand Quantity

The physical quantity of an item currently in stock.

### Operational Excellence

The execution of business strategy consistently and reliably.

### Order

A request to purchase or sell goods.

### Order Fulfillment

The complete process from order placement to delivery.

### Organization

A company or business entity using Ventry.

### Outbound

Goods or shipments leaving a warehouse.

### Overhead

Indirect costs not directly tied to production.

## P

### Packing List

A document listing the contents of a shipment.

### Pagination

Dividing content into discrete pages for easier navigation.

### Payload

The data carried by a request or response.

### Permissions

Authorization rules determining what actions a user can perform.

### Pick List

A document listing items to be collected from warehouse locations.

### PostgreSQL

The relational database system used by Ventry.

### Prisma

The ORM (Object-Relational Mapping) tool used in Ventry.

### Procurement

The process of finding and acquiring goods and services.

### Purchase Order (PO)

A document sent to suppliers to order products.

## Q

### QR Code

A two-dimensional barcode that can store more data than traditional barcodes.

### Quantity on Hand

The total amount of inventory physically present.

### Query

A request for data from a database or API.

### Queue

A line of items waiting to be processed in order.

### Quick Ratio

A liquidity ratio measuring ability to meet short-term obligations.

## R

### Rate Limiting

Controlling the number of requests a user can make in a time period.

### RBAC (Role-Based Access Control)

Access control based on user roles rather than individual permissions.

### Receipt

1. The act of receiving goods into inventory
2. A document confirming a transaction

### Reconciliation

Comparing two sets of records to ensure consistency.

### Redis

In-memory data structure store used for caching in Ventry.

### Refactor

Restructuring code without changing its external behavior.

### Reorder Point

The inventory level at which a new order should be placed.

### REST (Representational State Transfer)

Architectural style for designing networked applications.

### RLS (Row-Level Security)

Database security feature restricting row access based on user context.

### Rollback

Reverting changes to a previous state.

### Route

A URL pattern that maps to specific functionality.

## S

### SaaS (Software as a Service)

Software delivery model where applications are hosted centrally.

### Safety Stock

Extra inventory held to prevent stockouts.

### Schema

The structure of a database or data format.

### SDK (Software Development Kit)

Tools for building applications for a specific platform.

### Serial Number

A unique identifier assigned to individual items.

### Session

A period of interaction between a user and the system.

### Shipment

A collection of goods being transported together.

### SKU (Stock Keeping Unit)

A unique identifier for each distinct product.

### SLA (Service Level Agreement)

A commitment between a service provider and customer.

### Slug

A URL-friendly version of a string, typically used in web addresses.

### SMTP (Simple Mail Transfer Protocol)

Protocol for sending email messages.

### SSL/TLS

Cryptographic protocols for secure communication.

### Stock Movement

Any transaction that changes inventory quantities.

### Subscription

A recurring payment model for accessing services.

### Supplier

A company that provides goods or services.

## T

### Tag

A label attached to items for categorization or identification.

### Tax Rule

Configuration defining how taxes are calculated.

### Tenant

An organization in a multi-tenant system.

### Thread

A sequence of program execution or conversation.

### Threshold

A level or point at which something triggers.

### Throughput

The amount of material or items passing through a system.

### Timestamp

A sequence of characters identifying when an event occurred.

### Token

A piece of data representing authorization or identity.

### Transaction

A unit of work performed against a database.

### tRPC

Type-safe RPC framework used for Ventry's API.

### Turnover

How quickly inventory is sold and replaced.

### Two-Factor Authentication (2FA)

Security method requiring two forms of identification.

### TypeScript

Typed superset of JavaScript used throughout Ventry.

## U

### Unit of Measure (UOM)

Standard quantities used for measurement (e.g., each, dozen, kilogram).

### Unique Constraint

Database rule ensuring values in a column are unique.

### UPC (Universal Product Code)

A barcode symbology widely used in North America.

### Upstream/Downstream

Earlier/later stages in a process or supply chain.

### URL (Uniform Resource Locator)

The address of a web resource.

### User Interface (UI)

The visual elements users interact with.

### UUID (Universally Unique Identifier)

A 128-bit number used to identify information.

## V

### Validation

Checking data meets required format and business rules.

### Variable

A storage location with an associated name and value.

### Variance

The difference between expected and actual values.

### Vendor

Another term for supplier.

### Version Control

Managing changes to documents, code, or other collections.

### View

1. A database view presenting data in a specific way
2. A page or screen in the user interface

### Void

To cancel or make invalid (e.g., void an order).

### Volume

1. Physical space occupied by items
2. Quantity of transactions or data

## W

### Warehouse

A building for storing goods.

### Warehouse Management System (WMS)

Software for managing warehouse operations.

### Webhook

HTTP callbacks triggered by specific events.

### Weight

The heaviness of an item, important for shipping calculations.

### Widget

A component of a user interface.

### Workflow

A sequence of steps to complete a business process.

### Workspace

1. Development environment configuration
2. Monorepo package organization

## X

### XML (eXtensible Markup Language)

A markup language for encoding documents.

### XSS (Cross-Site Scripting)

A security vulnerability in web applications.

## Y

### YAML

A human-readable data serialization format.

### Yield

1. The amount produced by a process
2. JavaScript keyword for generator functions

## Z

### Zero Stock

Having no inventory on hand for an item.

### Zone

A designated area within a warehouse.

### z-index

CSS property controlling element stacking order.

### Zod

TypeScript-first schema validation library used in Ventry.

## Acronyms Quick Reference

- **API**: Application Programming Interface
- **CORS**: Cross-Origin Resource Sharing
- **COGS**: Cost of Goods Sold
- **ERP**: Enterprise Resource Planning
- **FIFO**: First In, First Out
- **JWT**: JSON Web Token
- **KPI**: Key Performance Indicator
- **LIFO**: Last In, First Out
- **ORM**: Object-Relational Mapping
- **PO**: Purchase Order
- **RBAC**: Role-Based Access Control
- **REST**: Representational State Transfer
- **RLS**: Row-Level Security
- **SaaS**: Software as a Service
- **SDK**: Software Development Kit
- **SKU**: Stock Keeping Unit
- **SLA**: Service Level Agreement
- **SMTP**: Simple Mail Transfer Protocol
- **SSL**: Secure Sockets Layer
- **TLS**: Transport Layer Security
- **UOM**: Unit of Measure
- **UPC**: Universal Product Code
- **UUID**: Universally Unique Identifier
- **WMS**: Warehouse Management System
- **XSS**: Cross-Site Scripting

## Domain-Specific Terms

### Ventry-Specific

- **Active Organization**: Current organization context for multi-org users
- **Organization Member**: User with access to an organization
- **Stock Movement**: Any inventory quantity change
- **Direct Caller**: Testing utility for tRPC procedures
- **Organization Scope**: Data filtering by organization context
- **Dual-User Pattern**: RLS implementation with two database users

### Industry-Specific

- **3PL**: Third-Party Logistics provider
- **Cross-Docking**: Moving goods directly from inbound to outbound
- **Drop Shipping**: Shipping directly from supplier to customer
- **Just-In-Time (JIT)**: Inventory strategy minimizing stock
- **Kitting**: Assembling individual items into kits
- **Perpetual Inventory**: Continuously updated inventory records
- **Pick and Pack**: Selecting and packaging items for shipment
- **Putaway**: Placing received goods in storage locations
- **Shrinkage**: Loss of inventory due to theft, damage, or error
- **Slotting**: Organizing warehouse locations for efficiency

## Next Steps

1. Bookmark this glossary for quick reference
2. Suggest new terms via GitHub issues
3. Use consistent terminology in documentation
4. Refer to specific terms when asking for help
