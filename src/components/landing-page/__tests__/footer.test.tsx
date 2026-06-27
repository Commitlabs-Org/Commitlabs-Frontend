// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "@/components/landing-page/Footer";

// ---------------------------------------------------------------------------
// Fixtures mirroring the real, hardcoded data inside Footer.tsx.
//
// Footer.tsx does not accept props - all link/social data is defined as
// module-level constants inside the component file itself. So instead of
// passing in fixtures, these arrays exist here purely so test expectations
// read clearly and stay in one place if the real data ever changes.
// ---------------------------------------------------------------------------

const resourceLinks = [
    { label: "Documentation", href: "#" },
    { label: "Whitepaper", href: "#" },
    { label: "GitHub", href: "https://github.com/commitlabs" },
    { label: "Blog", href: "#" },
];

const communityLinks = [
    { label: "Twitter", href: "#" },
    { label: "Discord", href: "#" },
    { label: "Telegram", href: "#" },
    { label: "Forum", href: "#" },
];

// The social icon row at the bottom of the footer (distinct from the
// "Community" link group above, which just lists plain text links).
const socialIconLabels = ["Twitter", "GitHub", "Forum"];

// ---------------------------------------------------------------------------
// Helper: the social icon row shares accessible names ("Twitter", "GitHub",
// "Forum") with the plain text links in the Resources/Community groups
// above it. To avoid ambiguous queries, every social-icon assertion below
// scopes its lookup to this row specifically, found via the bottom bar that
// contains the copyright text.
// ---------------------------------------------------------------------------

function getSocialIconsContainer(): HTMLElement {
    const copyright = screen.getByText(/© 2026 CommitLabs\. Licensed under MIT\./i);
    const bottomBar = copyright.parentElement as HTMLElement;
    return within(bottomBar).getByRole("link", { name: "Twitter" })
        .parentElement as HTMLElement;
}

describe("Footer", () => {
    // -----------------------------------------------------------------------
    // Link groups: headings + correct hrefs
    // -----------------------------------------------------------------------

    describe("Resources link group", () => {
        it("renders the Resources heading", () => {
            render(<Footer />);

            expect(
                screen.getByRole("heading", { name: "Resources" }),
            ).toBeInTheDocument();
        });

        it("renders all Resources links with their correct hrefs", () => {
            render(<Footer />);

            const nav = screen.getByRole("navigation", { name: "Resources" });

            resourceLinks.forEach(({ label, href }) => {
                const link = within(nav).getByRole("link", { name: label });
                expect(link).toHaveAttribute("href", href);
            });
        });
    });

    describe("Community link group", () => {
        it("renders the Community heading", () => {
            render(<Footer />);

            expect(
                screen.getByRole("heading", { name: "Community" }),
            ).toBeInTheDocument();
        });

        it("renders all Community links with their correct hrefs", () => {
            render(<Footer />);

            const nav = screen.getByRole("navigation", { name: "Community" });

            communityLinks.forEach(({ label, href }) => {
                const link = within(nav).getByRole("link", { name: label });
                expect(link).toHaveAttribute("href", href);
            });
        });
    });

    // -----------------------------------------------------------------------
    // External link safety (tabnabbing)
    //
    // IMPORTANT: in the real component, the "Resources" and "Community"
    // link-group links (including the one genuinely external link -
    // "GitHub" in Resources, pointing to https://github.com/commitlabs) are
    // rendered with next/link and carry NO target="_blank" or
    // rel="noopener noreferrer" attributes. Only the social-icon row at the
    // bottom of the footer (a separate set of plain <a> tags) carries those
    // safety attributes. We assert the real, current behavior of both
    // groups rather than assuming the safety attributes are present
    // everywhere the issue implies.
    // -----------------------------------------------------------------------

    describe("external link safety attributes", () => {
        it("does NOT add target/rel safety attributes to the external GitHub link in the Resources group", () => {
            render(<Footer />);

            const nav = screen.getByRole("navigation", { name: "Resources" });
            const githubLink = within(nav).getByRole("link", { name: "GitHub" });

            expect(githubLink).toHaveAttribute(
                "href",
                "https://github.com/commitlabs",
            );
            expect(githubLink).not.toHaveAttribute("target");
            expect(githubLink).not.toHaveAttribute("rel");
        });

        it("adds target=_blank and rel=noopener noreferrer to every social icon link", () => {
            render(<Footer />);

            const socialIcons = getSocialIconsContainer();

            socialIconLabels.forEach((label) => {
                const link = within(socialIcons).getByRole("link", { name: label });
                expect(link).toHaveAttribute("target", "_blank");
                expect(link).toHaveAttribute("rel", "noopener noreferrer");
            });
        });

        it("points each social icon link at its real external href", () => {
            render(<Footer />);

            const socialIcons = getSocialIconsContainer();

            expect(
                within(socialIcons).getByRole("link", { name: "Twitter" }),
            ).toHaveAttribute("href", "https://twitter.com/commitlabs");
            expect(
                within(socialIcons).getByRole("link", { name: "GitHub" }),
            ).toHaveAttribute("href", "https://github.com/commitlabs");
        });
    });

    // -----------------------------------------------------------------------
    // Social icons: render + accessible labeling
    //
    // NOTE: the icons themselves (FaTwitter, FaGithub, the custom ForumIcon
    // svg) carry no aria-hidden attribute in the real component. Instead,
    // the *link* wrapping each icon carries an aria-label (e.g.
    // aria-label="Twitter"), which is the correct accessible pattern - the
    // link is what gets announced, and its icon is treated as part of that
    // single accessible name rather than needing its own aria-hidden flag.
    // We test the labeling that's actually there.
    // -----------------------------------------------------------------------

    describe("social icons", () => {
        it("renders exactly three social icon links: Twitter, GitHub, Forum", () => {
            render(<Footer />);

            const socialIcons = getSocialIconsContainer();

            socialIconLabels.forEach((label) => {
                expect(
                    within(socialIcons).getByRole("link", { name: label }),
                ).toBeInTheDocument();
            });
        });

        it("labels each social icon link via aria-label matching its name", () => {
            render(<Footer />);

            const socialIcons = getSocialIconsContainer();

            socialIconLabels.forEach((label) => {
                const link = within(socialIcons).getByRole("link", { name: label });
                expect(link).toHaveAttribute("aria-label", label);
            });
        });

        it("renders an svg icon inside each social link", () => {
            render(<Footer />);

            const socialIcons = getSocialIconsContainer();

            socialIconLabels.forEach((label) => {
                const link = within(socialIcons).getByRole("link", { name: label });
                expect(link.querySelector("svg")).toBeInTheDocument();
            });
        });

        it("renders the Forum icon as an inline svg with the expected viewBox", () => {
            render(<Footer />);

            const socialIcons = getSocialIconsContainer();
            const forumLink = within(socialIcons).getByRole("link", { name: "Forum" });
            const svg = forumLink.querySelector("svg");

            expect(svg).toHaveAttribute("viewBox", "0 0 40 40");
        });
    });

    // -----------------------------------------------------------------------
    // Static / branding content
    // -----------------------------------------------------------------------

    describe("branding and legal content", () => {
        it("renders the CommitLabs brand name linking to the homepage", () => {
            render(<Footer />);

            const brandLink = screen.getByRole("link", { name: /commitlabs/i });
            expect(brandLink).toHaveAttribute("href", "/");
        });

        it("renders the copyright / license line", () => {
            render(<Footer />);

            expect(
                screen.getByText(/© 2026 CommitLabs\. Licensed under MIT\./i),
            ).toBeInTheDocument();
        });
    });
});
