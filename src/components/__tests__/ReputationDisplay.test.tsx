/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ReputationDisplay } from '@/components/ReputationDisplay';

// Color tokens returned by getScoreColor for each tier.
const GREEN = 'text-[#00C950]'; // score >= 90
const BLUE = 'text-[#51A2FF]'; // score >= 75
const ORANGE = 'text-[#FF8904]'; // score < 75

function renderDisplay(
  props: Partial<React.ComponentProps<typeof ReputationDisplay>> = {},
) {
  return render(
    <ReputationDisplay
      score={90}
      totalCommitments={12}
      successRate={98}
      {...props}
    />,
  );
}

// The score is rendered as `{score}/100` inside a single span, so the span's
// text content is e.g. "90/100".
function getScoreText(score: number) {
  return screen.getByText(`${score}/100`);
}

describe('ReputationDisplay', () => {
  describe('score-tier coloring', () => {
    it('uses green for a score of exactly 90 (lower bound of the green tier)', () => {
      renderDisplay({ score: 90 });
      expect(getScoreText(90)).toHaveClass(GREEN);
    });

    it('uses green for a perfect score of 100', () => {
      renderDisplay({ score: 100 });
      expect(getScoreText(100)).toHaveClass(GREEN);
    });

    it('uses blue at 89, just below the green threshold', () => {
      renderDisplay({ score: 89 });
      expect(getScoreText(89)).toHaveClass(BLUE);
    });

    it('uses blue for a score of exactly 75 (lower bound of the blue tier)', () => {
      renderDisplay({ score: 75 });
      expect(getScoreText(75)).toHaveClass(BLUE);
    });

    it('uses orange at 74, just below the blue threshold', () => {
      renderDisplay({ score: 74 });
      expect(getScoreText(74)).toHaveClass(ORANGE);
    });

    it('uses orange for a score of 0', () => {
      renderDisplay({ score: 0 });
      expect(getScoreText(0)).toHaveClass(ORANGE);
    });

    it('applies the tier color to the decorative star icon as well as the score text', () => {
      const { container } = renderDisplay({ score: 90 });
      // The Star is the first SVG; it shares the score's tier color class.
      const star = container.querySelector('svg');
      expect(star).not.toBeNull();
      expect(star).toHaveClass(GREEN);
    });
  });

  describe('track-record and reliability stats', () => {
    it('renders the score out of 100', () => {
      renderDisplay({ score: 82 });
      expect(screen.getByText('82/100')).toBeInTheDocument();
    });

    it('renders total commitments with the "Total" label', () => {
      renderDisplay({ totalCommitments: 12 });
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Track Record')).toBeInTheDocument();
    });

    it('renders the success rate as a percentage with the "Success" label', () => {
      renderDisplay({ successRate: 98 });
      expect(screen.getByText('98%')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Reliability')).toBeInTheDocument();
    });

    it('renders zero commitments without breaking', () => {
      renderDisplay({ totalCommitments: 0 });
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    it('renders a 100% success rate', () => {
      renderDisplay({ successRate: 100 });
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('root element and className', () => {
    it('applies an optional className to the root element', () => {
      const { container } = renderDisplay({ className: 'custom-reputation' });
      expect(container.firstChild).toHaveClass('custom-reputation');
    });

    it('renders the base root classes even without a className', () => {
      const { container } = renderDisplay();
      const root = container.firstChild as HTMLElement;
      expect(root).toHaveClass('rounded-xl');
      // No trailing className means no stray extra class is appended.
      expect(root.className).not.toMatch(/undefined/);
    });

    it('renders the section heading', () => {
      renderDisplay();
      expect(screen.getByText('Seller Reputation')).toBeInTheDocument();
    });
  });

  describe('decorative icons', () => {
    it('renders decorative lucide-react icons without interfering with text queries', () => {
      const { container } = renderDisplay({
        score: 75,
        totalCommitments: 5,
        successRate: 80,
      });

      // Star + History + ShieldCheck are present as inert SVGs...
      expect(container.querySelectorAll('svg')).toHaveLength(3);

      // ...and none of them prevent the stats text from being queryable.
      expect(screen.getByText('75/100')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });
});
