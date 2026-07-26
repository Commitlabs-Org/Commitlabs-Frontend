# Commitments Export & Reporting UX Flow

##  Overview
This document defines the UX flow for **exporting commitment data and sharing summary views** in the CommitLabs platform.

The goal is to provide a clear, safe, and intuitive export experience while respecting user permissions and data privacy.

##  Entry Points
Users can access export via:
- Commitments dashboard
- Marketplace / commitments table
- Individual commitment detail page


##  Export Modal Flow

### 1. Export Trigger State
User clicks:
- "Export " button

Opens modal with options.

---

### 2. Export Configuration

####  Data Selection
- All commitments (default)
- Selected commitments
- Year

####  Date Range
- Last 7 days
- Last 30 days
- Yaer

####  Format
- CSV (default)
- JSON (future-ready option - disabled for now)


### 3. Permissions & Privacy Notice
Displayed inside modal:

> “Sensitive data notice. Ensure you have permission to access and share this financial information.”

##  Export Action States

### Loading State
- Button disabled
- Spinner + text: “Preparing  export…”


### Success State
Toast message:
“Export ready — commitlabs_export_jan_dec_2025.csv · 2,847 records”

### Error State
“Export failed. Please try again or contact support.”

##  UX Notes
- Keep modal lightweight and fast
- Default to safest permissions
- Avoid overwhelming users with advanced settings
- Prioritize clarity over customization
