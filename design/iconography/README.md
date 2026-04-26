# Iconography System — Risk & Status Indicators

##  Purpose

This module defines a **consistent iconography system** for representing **risk and status indicators** across the CommitLabs product.

The goal is to ensure that every status is:

* Instantly recognizable
* Visually consistent
* Unambiguous across all UI contexts

---

##  Scope

This system covers the following statuses:

* **Active**
* **At Risk**
* **Violation**
* **Settled**
* **Early Exit**

Each status includes:

* Icon definition
* Color mapping
* Tooltip copy
* Usage rules

---

## What’s Included

### 1. Icon Set

* Standardized icons built on a consistent grid
* Unified stroke style and visual language
* Optimized for small sizes (16px, 20px, 24px)

### 2. Status Badge System

Reusable **Badge/Status component** with:

* Icon (left)
* Label (right)
* Auto layout structure
* Pill shape (rounded)

Variants include:

* Active
* At Risk
* Violation
* Settled
* Early Exit

### 3. Meaning Mapping (Source of Truth)

A structured mapping table defining:

* Icon
* Status name
* Visual logic (shape meaning)
* Color usage
* Tooltip copy
* When to use


### 4. Usage Examples

Demonstrations of icons in real UI:

* Data tables (status column)
* Modal warnings / alerts
* Inline indicators
* Size scaling validation


##  Design Principles

* **Clarity over decoration**
* **One meaning per icon** (no reuse across different states)
* **Color + shape redundancy** (not color-only communication)
* **Consistency across product surfaces**
* **Accessibility at small sizes**

## System Rules

* Base icon size: **16px**
* Container sizes: **16px / 20px / 24px**
* Stroke: **consistent across all icons**
* Corner style: **aligned with product UI (rounded)**
* Default style: **outline-based icons**

### Color Behavior

* Default → inherits text color
* Active → semantic color applied
* Disabled → muted/low contrast


## Tooltip Copy

Each icon includes a short, clear tooltip:

* Avoid technical jargon
* Keep under 8–10 words
* Focus on meaning, not system language


##  Design QA

To ensure clarity and usability:

* Validate recognition at small sizes (16px)
* Test icons without labels (can users still understand?)
* Check contrast and accessibility
* Ensure no visual overlap between meanings
* Review consistency across all variants


##  Figma Reference

👉 https://www.figma.com/design/FKyXpRNPTR5QJWw5fEC3pd/CommitLabs-Design-System?node-id=0-1&t=kzHpvETuD9dTmQTr-1 


##  Notes

* UI/UX deliverable only (no implementation code)
* Designed for scalability across dashboards, tables, and modals
* Works alongside existing export & reporting UX patterns

