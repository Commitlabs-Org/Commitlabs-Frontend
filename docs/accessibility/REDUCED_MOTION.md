# Global Reduced Motion Policy

CommitLabs is committed to providing an accessible, high-performance web experience for all users. This document outlines the global **prefers-reduced-motion** policy implemented across the frontend application.

---

## 📌 Overview

Animations and transitions (parallax scrolling, scaling, modals, loading states, and starfields) can cause discomfort, distraction, or performance degradation for users with vestibular disorders, low-end devices, or personal preferences. 

Our policy guarantees that when a user requests reduced motion via their operating system settings, the application automatically neutralizes or dampens all visual motion globally.

---

## 🛠️ Implementation Details

The policy utilizes a dual approach to cover both **framer-motion** components and **CSS transitions/animations**.

### 1. Framer Motion Integration
The entire application tree is wrapped under the `MotionConfig` provider with the `reducedMotion="user"` directive in the root layout.

- **Wrapper Component**: [MotionProvider](https://github.com/Commitlabs-Org/Commitlabs-Frontend/blob/master//src/components/MotionProvider.tsx)
- **Root Usage**: Incorporated inside [RootLayout](https://github.com/Commitlabs-Org/Commitlabs-Frontend/blob/master//src/app/layout.tsx#L98-L107) to cover all sub-pages, modals, and landing sections.
- **Behavior**: Framer Motion automatically respects the user's OS preference, disabling or simplification of physical coordinate/parallax transitions.

### 2. Global CSS Overrides
To neutralize animations defined in stylesheets or third-party CSS, we added a global media query at the end of [globals.css](https://github.com/Commitlabs-Org/Commitlabs-Frontend/blob/master//src/app/globals.css):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

This overrides all layout transitions and CSS keyframe animations globally, setting their duration to a negligible value (`0.01ms`) to ensure layout stability without breaking Javascript callbacks relying on transition/animation lifecycle events (like `onTransitionEnd`).

---

## 🧪 Testing

We assert the correctness of this policy using unit testing:

- **Unit Test**: [MotionProvider.test.tsx](https://github.com/Commitlabs-Org/Commitlabs-Frontend/blob/master//src/components/__tests__/MotionProvider.test.tsx) asserts that the client provider correctly passes `reducedMotion="user"` down to the `MotionConfig` component.
- **Coverage**: 100% code coverage on the added provider component.
