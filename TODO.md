# TODO - fonts self-hosting (#781)

- [ ] Create branch `performance/next-font-self-host` and apply edits
- [x] Update `src/app/layout.tsx` to load Inter + Roboto Mono via `next/font/google`
- [x] Remove remote Google Fonts CSS `@import` from `src/app/globals.css`
- [x] Ensure Tailwind font variables remain correct (`--font-roboto`) without overriding Next font variables
- [x] Add regression test asserting `src/app/globals.css` contains no `fonts.googleapis.com` imports
- [x] Update `docs/FRONTEND_ARCHITECTURE.md` documenting the change

- [ ] Run `npm test` and `npm run lint` and confirm coverage thresholds (blocked in this environment due to PowerShell execution policy)



