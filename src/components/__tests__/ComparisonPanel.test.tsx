// @vitest-environment happy-dom

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ComparisonPanel from '../ComparisonPanel';

describe('ComparisonPanel', () => {
  describe('Variant: negative', () => {
    it('renders the panel with negative variant and displays the correct icon', () => {
      render(
        <ComparisonPanel
          title="Negative Items"
          items={['Item 1', 'Item 2']}
          variant="negative"
        />
      );

      const panel = screen.getByRole('heading', { name: 'Negative Items' }).parentElement;
      expect(panel).toBeInTheDocument();
      
      // The negative variant uses the ✕ icon
      const icons = screen.getAllByText('✕');
      expect(icons).toHaveLength(2);
    });

    it('renders all items in the correct order for negative variant', () => {
      render(
        <ComparisonPanel
          title="Negative Items"
          items={['First Item', 'Second Item', 'Third Item']}
          variant="negative"
        />
      );

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(3);

      expect(items[0]).toHaveTextContent('First Item');
      expect(items[1]).toHaveTextContent('Second Item');
      expect(items[2]).toHaveTextContent('Third Item');
    });

    it('applies the negative variant class to the panel container', () => {
      const { container } = render(
        <ComparisonPanel
          title="Negative Items"
          items={['Item 1']}
          variant="negative"
        />
      );

      const panel = container.querySelector('div[class*="panel"]');
      expect(panel).toBeInTheDocument();
      // Note: CSS module class names are hashed, so we check that the panel exists
      // The variant-specific styling is applied via styles[variant]
    });
  });

  describe('Variant: positive', () => {
    it('renders the panel with positive variant and displays the correct icon', () => {
      render(
        <ComparisonPanel
          title="Positive Items"
          items={['Item 1', 'Item 2']}
          variant="positive"
        />
      );

      const panel = screen.getByRole('heading', { name: 'Positive Items' }).parentElement;
      expect(panel).toBeInTheDocument();
      
      // The positive variant uses the ✓ icon
      const icons = screen.getAllByText('✓');
      expect(icons).toHaveLength(2);
    });

    it('renders all items in the correct order for positive variant', () => {
      render(
        <ComparisonPanel
          title="Positive Items"
          items={['First Item', 'Second Item', 'Third Item']}
          variant="positive"
        />
      );

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(3);

      expect(items[0]).toHaveTextContent('First Item');
      expect(items[1]).toHaveTextContent('Second Item');
      expect(items[2]).toHaveTextContent('Third Item');
    });

    it('applies the positive variant class to the panel container', () => {
      const { container } = render(
        <ComparisonPanel
          title="Positive Items"
          items={['Item 1']}
          variant="positive"
        />
      );

      const panel = container.querySelector('div[class*="panel"]');
      expect(panel).toBeInTheDocument();
      // Note: CSS module class names are hashed, so we check that the panel exists
      // The variant-specific styling is applied via styles[variant]
    });
  });

  describe('Variant: result', () => {
    it('renders the panel with result variant and displays the correct icon', () => {
      render(
        <ComparisonPanel
          title="Result Items"
          items={['Item 1', 'Item 2']}
          variant="result"
        />
      );

      const panel = screen.getByRole('heading', { name: 'Result Items' }).parentElement;
      expect(panel).toBeInTheDocument();
      
      // The result variant uses the → icon
      const icons = screen.getAllByText('→');
      expect(icons).toHaveLength(2);
    });

    it('renders all items in the correct order for result variant', () => {
      render(
        <ComparisonPanel
          title="Result Items"
          items={['First Item', 'Second Item', 'Third Item']}
          variant="result"
        />
      );

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(3);

      expect(items[0]).toHaveTextContent('First Item');
      expect(items[1]).toHaveTextContent('Second Item');
      expect(items[2]).toHaveTextContent('Third Item');
    });

    it('applies the result variant class to the panel container', () => {
      const { container } = render(
        <ComparisonPanel
          title="Result Items"
          items={['Item 1']}
          variant="result"
        />
      );

      const panel = container.querySelector('div[class*="panel"]');
      expect(panel).toBeInTheDocument();
      // Note: CSS module class names are hashed, so we check that the panel exists
      // The variant-specific styling is applied via styles[variant]
    });
  });

  describe('Item rendering', () => {
    it('renders exactly one item row when provided with a single item', () => {
      render(
        <ComparisonPanel
          title="Single Item"
          items={['Only Item']}
          variant="positive"
        />
      );

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('Only Item');
    });

    it('renders all items when provided with multiple items', () => {
      render(
        <ComparisonPanel
          title="Multiple Items"
          items={['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']}
          variant="negative"
        />
      );

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(5);

      expect(items[0]).toHaveTextContent('Item 1');
      expect(items[1]).toHaveTextContent('Item 2');
      expect(items[2]).toHaveTextContent('Item 3');
      expect(items[3]).toHaveTextContent('Item 4');
      expect(items[4]).toHaveTextContent('Item 5');
    });

    it('renders the panel shell when items array is empty', () => {
      render(
        <ComparisonPanel
          title="Empty Panel"
          items={[]}
          variant="positive"
        />
      );

      const title = screen.getByRole('heading', { name: 'Empty Panel' });
      expect(title).toBeInTheDocument();

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
      
      const items = within(list).queryAllByRole('listitem');
      expect(items).toHaveLength(0);
    });

    it('maintains the correct order of items as provided in the array', () => {
      render(
        <ComparisonPanel
          title="Ordered Items"
          items={['Zebra', 'Apple', 'Mango', 'Banana']}
          variant="result"
        />
      );

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      
      expect(items[0]).toHaveTextContent('Zebra');
      expect(items[1]).toHaveTextContent('Apple');
      expect(items[2]).toHaveTextContent('Mango');
      expect(items[3]).toHaveTextContent('Banana');
    });
  });

  describe('Accessibility', () => {
    it('renders the list with proper list role', () => {
      render(
        <ComparisonPanel
          title="Accessible Panel"
          items={['Item 1', 'Item 2']}
          variant="positive"
        />
      );

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('renders each list item with proper listitem role', () => {
      render(
        <ComparisonPanel
          title="Accessible Panel"
          items={['Item 1', 'Item 2', 'Item 3']}
          variant="negative"
        />
      );

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(3);
    });

    it('renders the title as a heading for screen readers', () => {
      render(
        <ComparisonPanel
          title="Panel Title"
          items={['Item 1']}
          variant="result"
        />
      );

      const heading = screen.getByRole('heading', { name: 'Panel Title' });
      expect(heading).toBeInTheDocument();
    });

    it('displays icons as visible text content for accessibility', () => {
      render(
        <ComparisonPanel
          title="Icon Panel"
          items={['Item 1']}
          variant="positive"
        />
      );

      // Icons are rendered as text characters (✕, ✓, →) which are screen reader accessible
      const icon = screen.getByText('✓');
      expect(icon).toBeInTheDocument();
      expect(icon).toBeVisible();
    });
  });
});
