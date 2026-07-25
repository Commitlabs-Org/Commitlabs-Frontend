import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExperienceSection } from "../ExperienceSection";

// Mock IntersectionObserver for framer-motion's whileInView
const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(),
  unobserve: vi.fn(),
}));
vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

describe("ExperienceSection", () => {
  it("renders non-placeholder links for action cards", () => {
    render(<ExperienceSection />);
    
    // Test View on Github link
    const githubLink = screen.getByText(/View on Github/i).closest("a");
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute("href");
    expect(githubLink?.getAttribute("href")).not.toBe("#");
    expect(githubLink?.getAttribute("href")).toBe("https://github.com/muhsar27/Commitlabs-Frontend");
    
    // Test Read Docs link
    const docsLink = screen.getByText(/Read Docs/i).closest("a");
    expect(docsLink).toBeInTheDocument();
    expect(docsLink).toHaveAttribute("href");
    expect(docsLink?.getAttribute("href")).not.toBe("#");
    expect(docsLink?.getAttribute("href")).toBe("/docs");
    
    // Test Get in Touch link
    const contactLink = screen.getByText(/Get in Touch/i).closest("a");
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute("href");
    expect(contactLink?.getAttribute("href")).not.toBe("#");
    expect(contactLink?.getAttribute("href")).toBe("mailto:hello@commitlabs.com");
  });
});
