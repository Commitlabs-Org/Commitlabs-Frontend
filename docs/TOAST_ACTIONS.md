# Toast Actions

`ToastProvider` supports one optional action per toast. Use it for a short follow-up such as undoing a reversible local change or sending the user to a related view.

```tsx
const toast = useToast();

toast.success({
  title: 'Listing cancelled',
  description: 'The listing is no longer visible in the marketplace.',
  action: {
    label: 'Undo',
    onClick: () => restoreListing(),
  },
});
```

Actions dismiss their toast after the handler runs by default. Set `dismiss: false` when the toast should remain visible after the action.

```tsx
toast.info({
  title: 'Export ready',
  action: {
    label: 'View',
    dismiss: false,
    onClick: () => router.push('/exports/latest'),
  },
});
```

Auto-dismiss timers continue to use each toast's configured `duration`, and they pause while the toast is hovered or contains keyboard focus.
